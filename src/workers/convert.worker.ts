/**
 * Conversion Worker - Handles file format conversion in a WebWorker
 */

import { InputFormat } from "../utils/detectFormat";
import { shapefileToGeoJSON, geoJSONToShapefile, reformatShapefile } from "../utils/conversions/shapefile";
import { geoJSONToKML, geoJSONToCSVExport, reformatGeoJSON } from "../utils/conversions/geojson";
import { csvToGeoJSON, reformatCSV } from "../utils/conversions/csv";
import { kmlToGeoJSON, reformatKML } from "../utils/conversions/kml";
import { tilesToZip } from "../utils/conversions/pbf";

export type OutputFormat =
  | "geojson"
  | "shapefile"
  | "kml"
  | "pbf-zip"
  | "csv";

export interface ConvertRequest {
  inputFormat: InputFormat;
  outputFormat: OutputFormat;
  file: ArrayBuffer; // Original file binary
  cachedGeoJSON?: string; // Cached GeoJSON from geometry type detection (for Shapefile/KML)
  pbfOptions?: {
    minZoom: number;
    maxZoom: number;
    layerName: string;
  };
}

export interface ConvertResponse {
  success: boolean;
  data?: ArrayBuffer | string; // zip, shp(zip), kml, gpx, geojson string
  filename?: string; // Recommended filename (e.g., "tiles_pbf.zip")
  mimeType?: string; // e.g., "application/zip", "application/vnd.google-earth.kml+xml"
  error?: string;
}

async function handleCSVToGeoJSON(csvText: string): Promise<ConvertResponse> {
  try {
    const geojson = await csvToGeoJSON(csvText);
    return {
      success: true,
      data: geojson,
      filename: "converted.geojson",
      mimeType: "application/geo+json",
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : String(error),
    };
  }
}

async function handleGeoJSONToShapefile(
  geojson: string
): Promise<ConvertResponse> {
  try {
    const zipBuffer = await geoJSONToShapefile(geojson);
    return {
      success: true,
      data: zipBuffer,
      filename: "converted.zip",
      mimeType: "application/zip",
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : String(error),
    };
  }
}

async function handleGeoJSONToKML(geojson: string): Promise<ConvertResponse> {
  try {
    const kml = geoJSONToKML(geojson);
    return {
      success: true,
      data: kml,
      filename: "converted.kml",
      mimeType: "application/vnd.google-earth.kml+xml",
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : String(error),
    };
  }
}

let wasmModule: any = null;
let wasmInitialized = false;

async function initializeWasm(): Promise<void> {
  if (wasmInitialized && wasmModule) return;

  try {
    wasmModule = await import("../wasm/vector_tile_core.js");
    
    if (!wasmModule || !wasmModule.default) {
      throw new Error("WASM module default export not found");
    }
    
    await wasmModule.default();
    wasmInitialized = true;
  } catch (error) {
    throw new Error(
      `Failed to initialize WASM: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

async function handleGeoJSONToPBFZip(
  geojson: string,
  options: { minZoom: number; maxZoom: number; layerName: string }
): Promise<ConvertResponse> {
  try {
    // Initialize WASM
    await initializeWasm();

    if (!wasmModule || !wasmModule.generate_pbf_tiles) {
      throw new Error("WASM module not properly initialized");
    }

    const geojsonBytes = new TextEncoder().encode(geojson);

    // Validate zoom levels
    if (options.minZoom < 0 || options.minZoom > 24 || options.maxZoom < 0 || options.maxZoom > 24) {
      throw new Error("Zoom levels must be between 0 and 24");
    }

    if (options.minZoom > options.maxZoom) {
      throw new Error("Minimum zoom must be less than or equal to maximum zoom");
    }

    const result = wasmModule.generate_pbf_tiles(
      geojsonBytes,
      options.minZoom,
      options.maxZoom,
      options.layerName
    );

    const tiles: Array<{ path: string; data: Uint8Array }> = [];
    const tileCount = result.count();

    for (let i = 0; i < tileCount; i++) {
      const path = result.get_path(i);
      const data = result.get_data(i);

      if (path && data) {
        tiles.push({ path, data });
      }
    }

    const metadata = result.get_metadata();
    let bounds: [number, number, number, number] | undefined;
    let center: [number, number] | undefined;

    if (metadata && metadata.bounds) {
      bounds = metadata.bounds;
    }
    if (metadata && metadata.center) {
      center = metadata.center;
    }

    if (result.free) {
      result.free();
    }
    const zipBuffer = await tilesToZip(tiles, {
      minZoom: options.minZoom,
      maxZoom: options.maxZoom,
      layerName: options.layerName,
      bounds,
      center,
    });

    return {
      success: true,
      data: zipBuffer,
      filename: "tiles_pbf.zip",
      mimeType: "application/zip",
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : String(error),
    };
  }
}

// Normalize GeoJSON: Expand MultiLineString/MultiPolygon for WASM compatibility
function normalizeGeoJSONForPBF(geojson: string): string {
  try {
    const geojsonObj = JSON.parse(geojson) as GeoJSON.FeatureCollection;
    
    if (geojsonObj.type !== 'FeatureCollection' || !Array.isArray(geojsonObj.features)) {
      return geojson;
    }
    
    const normalizedFeatures: GeoJSON.Feature[] = [];
    
    for (const feature of geojsonObj.features) {
      if (!feature.geometry) continue;
      
      const geometryType = feature.geometry.type;
      
      if (geometryType === 'MultiLineString') {
        const coordinates = (feature.geometry as GeoJSON.MultiLineString).coordinates;
        for (const lineCoords of coordinates) {
          normalizedFeatures.push({
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: lineCoords,
            },
            properties: { ...feature.properties },
          });
        }
      } else if (geometryType === 'MultiPolygon') {
        const coordinates = (feature.geometry as GeoJSON.MultiPolygon).coordinates;
        for (const polygonCoords of coordinates) {
          normalizedFeatures.push({
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: polygonCoords,
            },
            properties: { ...feature.properties },
          });
        }
      } else {
        normalizedFeatures.push(feature);
      }
    }
    
    const normalized: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: normalizedFeatures,
    };
    
    return JSON.stringify(normalized);
  } catch (error) {
    return geojson;
  }
}

async function handleShapefileToPBFZip(
  zipBuffer: ArrayBuffer,
  options: { minZoom: number; maxZoom: number; layerName: string }
): Promise<ConvertResponse> {
  try {
    const geojson = await shapefileToGeoJSON(zipBuffer);
    const normalizedGeoJSON = normalizeGeoJSONForPBF(geojson);
    return handleGeoJSONToPBFZip(normalizedGeoJSON, options);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage,
    };
  }
}


export async function handleConvert(request: ConvertRequest): Promise<ConvertResponse> {
  const { inputFormat, outputFormat, file, cachedGeoJSON, pbfOptions } = request;

  try {
    if (
      (inputFormat === "geojson" && outputFormat === "geojson") ||
      (inputFormat === "csv" && outputFormat === "csv") ||
      (inputFormat === "kml" && outputFormat === "kml") ||
      (inputFormat === "shapefile" && outputFormat === "shapefile")
    ) {
      if (inputFormat === "geojson") {
        const geojsonText = new TextDecoder("utf-8", { fatal: false }).decode(file);
        const reformatted = reformatGeoJSON(geojsonText);
        return {
          success: true,
          data: reformatted,
          filename: "reformatted.geojson",
          mimeType: "application/geo+json",
        };
      } else if (inputFormat === "csv") {
        const csvText = new TextDecoder("utf-8", { fatal: false }).decode(file);
        const reformatted = reformatCSV(csvText);
        return {
          success: true,
          data: reformatted,
          filename: "reformatted.csv",
          mimeType: "text/csv",
        };
      } else if (inputFormat === "kml") {
        const kmlText = new TextDecoder("utf-8", { fatal: false }).decode(file);
        const reformatted = reformatKML(kmlText);
        return {
          success: true,
          data: reformatted,
          filename: "reformatted.kml",
          mimeType: "application/vnd.google-earth.kml+xml",
        };
      } else if (inputFormat === "shapefile") {
        const reformatted = await reformatShapefile(file);
        return {
          success: true,
          data: reformatted,
          filename: "reformatted.zip",
          mimeType: "application/zip",
        };
      }
    }

    if (inputFormat === "csv") {
      const csvText = new TextDecoder("utf-8", { fatal: false }).decode(file);

      switch (outputFormat) {
        case "geojson":
          return handleCSVToGeoJSON(csvText);
        case "kml": {
          const geojson = await csvToGeoJSON(csvText);
          return handleGeoJSONToKML(geojson);
        }
        case "shapefile": {
          const geojson = await csvToGeoJSON(csvText);
          return handleGeoJSONToShapefile(geojson);
        }
        case "pbf-zip": {
          if (!pbfOptions) {
            return {
              success: false,
              error: "PBF options (minZoom, maxZoom, layerName) are required",
            };
          }
          const geojson = await csvToGeoJSON(csvText);
          return handleGeoJSONToPBFZip(geojson, pbfOptions);
        }
        default:
          return {
            success: false,
            error: `Conversion from CSV to ${outputFormat} is not supported`,
          };
      }
    }

    if (inputFormat === "geojson") {
      const geojsonText = new TextDecoder("utf-8", { fatal: false }).decode(file);

      switch (outputFormat) {
        case "shapefile":
          return handleGeoJSONToShapefile(geojsonText);
        case "kml":
          return handleGeoJSONToKML(geojsonText);
        case "csv": {
          const csv = geoJSONToCSVExport(geojsonText);
          return {
            success: true,
            data: csv,
            filename: "converted.csv",
            mimeType: "text/csv",
          };
        }
        case "pbf-zip":
          if (!pbfOptions) {
            return {
              success: false,
              error: "PBF options (minZoom, maxZoom, layerName) are required",
            };
          }
          return handleGeoJSONToPBFZip(geojsonText, pbfOptions);
        default:
          return {
            success: false,
            error: `Unsupported output format: ${outputFormat}`,
          };
      }
    }

    if (inputFormat === "shapefile") {
      // Use cached GeoJSON if available to avoid reconversion
      const getGeoJSON = async () => {
        if (cachedGeoJSON) {
          return cachedGeoJSON;
        }
        return await shapefileToGeoJSON(file);
      };

      switch (outputFormat) {
        case "geojson": {
          const geojson = await getGeoJSON();
          return {
            success: true,
            data: geojson,
            filename: "converted.geojson",
            mimeType: "application/geo+json",
          };
        }
        case "kml": {
          const geojson = await getGeoJSON();
          return handleGeoJSONToKML(geojson);
        }
        case "csv": {
          const geojson = await getGeoJSON();
          const csv = geoJSONToCSVExport(geojson);
          return {
            success: true,
            data: csv,
            filename: "converted.csv",
            mimeType: "text/csv",
          };
        }
        case "pbf-zip":
          if (!pbfOptions) {
            return {
              success: false,
              error: "PBF options (minZoom, maxZoom, layerName) are required",
            };
          }
          if (cachedGeoJSON) {
            const normalizedGeoJSON = normalizeGeoJSONForPBF(cachedGeoJSON);
            return handleGeoJSONToPBFZip(normalizedGeoJSON, pbfOptions);
          }
          return handleShapefileToPBFZip(file, pbfOptions);
        default:
          return {
            success: false,
            error: `Unsupported output format: ${outputFormat}`,
          };
      }
    }

    if (inputFormat === "kml") {
      // Use cached GeoJSON if available to avoid reconversion
      const getGeoJSON = () => {
        if (cachedGeoJSON) {
          return cachedGeoJSON;
        }
        const kmlText = new TextDecoder("utf-8", { fatal: false }).decode(file);
        return kmlToGeoJSON(kmlText);
      };

      const kmlText = new TextDecoder("utf-8", { fatal: false }).decode(file);

      switch (outputFormat) {
        case "geojson": {
          const geojson = getGeoJSON();
          return {
            success: true,
            data: geojson,
            filename: "converted.geojson",
            mimeType: "application/geo+json",
          };
        }
        case "kml":
          const reformatted = reformatKML(kmlText);
          return {
            success: true,
            data: reformatted,
            filename: "reformatted.kml",
            mimeType: "application/vnd.google-earth.kml+xml",
          };
        case "csv": {
          const geojson = getGeoJSON();
          const csv = geoJSONToCSVExport(geojson);
          return {
            success: true,
            data: csv,
            filename: "converted.csv",
            mimeType: "text/csv",
          };
        }
        case "shapefile": {
          const geojson = getGeoJSON();
          return handleGeoJSONToShapefile(geojson);
        }
        case "pbf-zip": {
          if (!pbfOptions) {
            return {
              success: false,
              error: "PBF options (minZoom, maxZoom, layerName) are required",
            };
          }
          const geojson = getGeoJSON();
          return handleGeoJSONToPBFZip(geojson, pbfOptions);
        }
        default:
          return {
            success: false,
            error: `Unsupported output format: ${outputFormat}`,
          };
      }
    }

    if (inputFormat === "gpx") {
      return {
        success: false,
        error: "GPX input format is currently under consideration and not yet fully supported",
      };
    }

    return {
      success: false,
      error: `Unsupported input format: ${inputFormat}`,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : `Conversion failed: ${String(error)}`,
    };
  }
}

self.onmessage = async (event: MessageEvent<ConvertRequest>) => {
  const request = event.data;

  try {
    const response = await handleConvert(request);
    self.postMessage(response);
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : `Worker error: ${String(error)}`;
    
    self.postMessage({
      success: false,
      error: errorMessage,
    } as ConvertResponse);
  }
};

self.onerror = (event: ErrorEvent | Event | string) => {
  let errorMessage = 'Unknown error';
  if (typeof event === 'string') {
    errorMessage = event;
  } else if (event instanceof ErrorEvent) {
    errorMessage = event.message;
  } else if (event instanceof Error) {
    errorMessage = event.message;
  }
  self.postMessage({
    success: false,
    error: `Unhandled worker error: ${errorMessage}`,
  } as ConvertResponse);
};

