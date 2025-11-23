/**
 * Conversion Worker
 * Handles file format conversion in a WebWorker
 */

import { InputFormat } from "../utils/detectFormat";
import { shapefileToGeoJSON, geoJSONToShapefile, reformatShapefile } from "../utils/conversions/shapefile";
import { geoJSONToKML, shapefileToKML, geoJSONToCSVExport, reformatGeoJSON } from "../utils/conversions/geojson";
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

/**
 * Convert CSV text to GeoJSON string
 */
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

/**
 * Convert Shapefile ZIP to GeoJSON
 */
async function handleShapefileToGeoJSON(
  zipBuffer: ArrayBuffer
): Promise<ConvertResponse> {
  try {
    const geojson = await shapefileToGeoJSON(zipBuffer);
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

/**
 * Convert GeoJSON to Shapefile ZIP
 */
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

/**
 * Convert GeoJSON to KML
 */
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

/**
 * Convert Shapefile to KML
 */
async function handleShapefileToKML(
  zipBuffer: ArrayBuffer
): Promise<ConvertResponse> {
  try {
    const kml = await shapefileToKML(zipBuffer);
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


/**
 * Initialize WASM module for PBF conversion
 */
let wasmModule: any = null;
let wasmInitialized = false;

async function initializeWasm(): Promise<void> {
  if (wasmInitialized && wasmModule) return;

  try {
    // Import WASM module from local src/wasm directory
    // This ensures the module is bundled with the application
    wasmModule = await import("../wasm/vector_tile_core.js");
    
    if (!wasmModule || !wasmModule.default) {
      throw new Error("WASM module default export not found");
    }
    
    // Initialize WASM module
    // web-vector-tile-makerと同じ方法：引数なしで呼び出す
    // vite-plugin-wasmがWASMファイルのパスを自動的に解決する
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

/**
 * Convert GeoJSON to PBF ZIP
 */
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

    // Convert GeoJSON string to Uint8Array
    const geojsonBytes = new TextEncoder().encode(geojson);

    // Validate zoom levels
    if (options.minZoom < 0 || options.minZoom > 24 || options.maxZoom < 0 || options.maxZoom > 24) {
      throw new Error("Zoom levels must be between 0 and 24");
    }

    if (options.minZoom > options.maxZoom) {
      throw new Error("Minimum zoom must be less than or equal to maximum zoom");
    }

    // Generate PBF tiles using WASM
    const result = wasmModule.generate_pbf_tiles(
      geojsonBytes,
      options.minZoom,
      options.maxZoom,
      options.layerName
    );

    // Collect tiles
    const tiles: Array<{ path: string; data: Uint8Array }> = [];
    const tileCount = result.count();

    for (let i = 0; i < tileCount; i++) {
      const path = result.get_path(i);
      const data = result.get_data(i);

      if (path && data) {
        tiles.push({ path, data });
      }
    }

    // Get metadata for tiles.json
    const metadata = result.get_metadata();
    let bounds: [number, number, number, number] | undefined;
    let center: [number, number] | undefined;

    if (metadata && metadata.bounds) {
      bounds = metadata.bounds;
    }
    if (metadata && metadata.center) {
      center = metadata.center;
    }

    // Clean up WASM resources
    if (result.free) {
      result.free();
    }

    // Convert tiles to ZIP with metadata
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

/**
 * Convert Shapefile to PBF ZIP
 */
/**
 * Normalize GeoJSON: Convert MultiLineString to LineString, MultiPolygon to Polygon
 * WASM module doesn't support MultiLineString/MultiPolygon, so we need to expand them
 */
function normalizeGeoJSONForPBF(geojson: string): string {
  try {
    const geojsonObj = JSON.parse(geojson);
    
    if (geojsonObj.type !== 'FeatureCollection' || !Array.isArray(geojsonObj.features)) {
      return geojson; // Return as-is if not a FeatureCollection
    }
    
    const normalizedFeatures: any[] = [];
    
    for (const feature of geojsonObj.features) {
      if (!feature.geometry) continue;
      
      const geometryType = feature.geometry.type;
      
      if (geometryType === 'MultiLineString') {
        // Expand MultiLineString to multiple LineString features
        const coordinates = feature.geometry.coordinates;
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
        // Expand MultiPolygon to multiple Polygon features
        const coordinates = feature.geometry.coordinates;
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
        // Keep other geometry types as-is
        normalizedFeatures.push(feature);
      }
    }
    
    // Remove fileName property if it exists (shpjs adds this)
    const normalized: any = {
      type: 'FeatureCollection',
      features: normalizedFeatures,
    };
    if ('fileName' in geojsonObj) {
      // fileName is not part of GeoJSON spec, but we keep it for reference if needed
    }
    
    return JSON.stringify(normalized);
  } catch (error) {
    // If normalization fails, return original GeoJSON
    console.warn('[normalizeGeoJSONForPBF] Failed to normalize, using original:', error);
    return geojson;
  }
}

async function handleShapefileToPBFZip(
  zipBuffer: ArrayBuffer,
  options: { minZoom: number; maxZoom: number; layerName: string }
): Promise<ConvertResponse> {
  try {
    // First convert to GeoJSON
    const geojson = await shapefileToGeoJSON(zipBuffer);
    
    // Normalize GeoJSON: Convert MultiLineString/MultiPolygon to LineString/Polygon
    // WASM module doesn't support MultiLineString/MultiPolygon
    const normalizedGeoJSON = normalizeGeoJSONForPBF(geojson);
    
    // Then convert to PBF
    return handleGeoJSONToPBFZip(normalizedGeoJSON, options);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[ShapefileToPBF] Error:', errorMessage);
    if (error instanceof Error && error.stack) {
      console.error('[ShapefileToPBF] Stack:', error.stack);
    }
    return {
      success: false,
      error: errorMessage,
    };
  }
}


/**
 * Main conversion handler
 */
export async function handleConvert(request: ConvertRequest): Promise<ConvertResponse> {
  const { inputFormat, outputFormat, file, pbfOptions } = request;

  try {
    // Handle same format conversion (reformat)
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

    // Handle CSV input
    if (inputFormat === "csv") {
      const csvText = new TextDecoder("utf-8", { fatal: false }).decode(file);

      switch (outputFormat) {
        case "geojson":
          return handleCSVToGeoJSON(csvText);
        case "kml": {
          // CSV → GeoJSON → KML
          const geojson = await csvToGeoJSON(csvText);
          return handleGeoJSONToKML(geojson);
        }
        case "shapefile": {
          // CSV → GeoJSON → Shapefile
          const geojson = await csvToGeoJSON(csvText);
          return handleGeoJSONToShapefile(geojson);
        }
        case "pbf-zip": {
          // CSV → GeoJSON → PBF
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

    // Handle GeoJSON input
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

    // Handle Shapefile input
    if (inputFormat === "shapefile") {
      switch (outputFormat) {
        case "geojson":
          return handleShapefileToGeoJSON(file);
        case "kml":
          return handleShapefileToKML(file);
        case "csv": {
          // Shapefile → GeoJSON → CSV
          const geojson = await shapefileToGeoJSON(file);
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
          return handleShapefileToPBFZip(file, pbfOptions);
        default:
          return {
            success: false,
            error: `Unsupported output format: ${outputFormat}`,
          };
      }
    }

    // Handle KML input
    if (inputFormat === "kml") {
      const kmlText = new TextDecoder("utf-8", { fatal: false }).decode(file);

      switch (outputFormat) {
        case "geojson": {
          const geojson = kmlToGeoJSON(kmlText);
          return {
            success: true,
            data: geojson,
            filename: "converted.geojson",
            mimeType: "application/geo+json",
          };
        }
        case "kml":
          // Same format - reformat
          const reformatted = reformatKML(kmlText);
          return {
            success: true,
            data: reformatted,
            filename: "reformatted.kml",
            mimeType: "application/vnd.google-earth.kml+xml",
          };
        case "csv": {
          // KML → GeoJSON → CSV
          const geojson = kmlToGeoJSON(kmlText);
          const csv = geoJSONToCSVExport(geojson);
          return {
            success: true,
            data: csv,
            filename: "converted.csv",
            mimeType: "text/csv",
          };
        }
        case "shapefile": {
          // KML → GeoJSON → Shapefile
          const geojson = kmlToGeoJSON(kmlText);
          return handleGeoJSONToShapefile(geojson);
        }
        case "pbf-zip": {
          // KML → GeoJSON → PBF
          if (!pbfOptions) {
            return {
              success: false,
              error: "PBF options (minZoom, maxZoom, layerName) are required",
            };
          }
          const geojson = kmlToGeoJSON(kmlText);
          return handleGeoJSONToPBFZip(geojson, pbfOptions);
        }
        default:
          return {
            success: false,
            error: `Unsupported output format: ${outputFormat}`,
          };
      }
    }

    // Handle GPX input (not fully supported yet, but allow basic conversion)
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

// Worker message handler
self.onmessage = async (event: MessageEvent<ConvertRequest>) => {
  const request = event.data;

  try {
    const response = await handleConvert(request);
    self.postMessage(response);
  } catch (error) {
    self.postMessage({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : `Worker error: ${String(error)}`,
    } as ConvertResponse);
  }
};

// Worker ready notification
console.log("[Convert Worker] Ready");

