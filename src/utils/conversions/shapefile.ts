/**
 * Shapefile conversion utilities
 */

// @ts-ignore - shpjs has no type definitions
import shpjs from "shpjs";
// @ts-ignore - shp-write has no type definitions
import * as shpWriteModule from "shp-write";
// @ts-ignore - shp-write zip function type is not defined
const shpZip = (shpWriteModule as any).zip || shpWriteModule.zip;
import JSZip from "jszip";
import { 
  detectEncodingFromDbf
} from "../dbfEncoding";
import { readPrjFileWithEncoding } from "./prjEncoding";
import { normalizeEncodingForParsedbf } from "./encodingUtils";

/**
 * Convert Shapefile (ZIP) to GeoJSON
 * Using shpjs library with individual file objects
 * shpjs handles encoding conversion based on CPG file
 */
export async function shapefileToGeoJSON(
  zipBuffer: ArrayBuffer
): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(zipBuffer);
    
    // Find .shp file
    const shpFiles = Object.keys(zip.files).filter(name => 
      name.toLowerCase().endsWith('.shp')
    );
    
    if (shpFiles.length === 0) {
      throw new Error('No .shp file found in ZIP');
    }
    
    // Use the first .shp file found
    const baseName = shpFiles[0].replace(/\.shp$/i, '');
    
    // Get individual files
    const shpFile = zip.file(`${baseName}.shp`);
    const dbfFile = zip.file(`${baseName}.dbf`);
    const cpgFile = zip.file(`${baseName}.cpg`);
    
    if (!shpFile) {
      throw new Error(`Could not find ${baseName}.shp in ZIP`);
    }
    
    // DBF file is required in Shapefile
    if (!dbfFile) {
      throw new Error(`Could not find ${baseName}.dbf in ZIP`);
    }
    
    // Prepare object for shpjs
    const shapefileObject: any = {
      shp: await shpFile.async('arraybuffer'),
      dbf: await dbfFile.async('arraybuffer') // DBF is required
    };
    
    // Add PRJ file if exists (optional)
    // PRJ files are typically ASCII-only WKT format, so read as UTF-8
    const prjText = await readPrjFileWithEncoding(zip, baseName);
    if (prjText) {
      shapefileObject.prj = prjText;
    }
    
    // Set CPG encoding for parsedbf
    if (cpgFile) {
      let cpgEncoding = await cpgFile.async('string');
      cpgEncoding = normalizeEncodingForParsedbf(cpgEncoding);
      shapefileObject.cpg = cpgEncoding;
    } else {
      // CPG doesn't exist, detect from DBF (DBF is required)
      const dbfBuffer = await dbfFile.async('arraybuffer');
      let encoding = detectEncodingFromDbf(dbfBuffer);
      encoding = normalizeEncodingForParsedbf(encoding);
      shapefileObject.cpg = encoding;
    }
    
    // Try conversion with PRJ, if it fails, retry without PRJ
    let geojson;
    try {
      geojson = await shpjs(shapefileObject);
    } catch (error) {
      // If conversion fails and PRJ file exists, try without PRJ
      if (prjText) {
        const shapefileObjectWithoutPrj = { ...shapefileObject };
        delete shapefileObjectWithoutPrj.prj;
        geojson = await shpjs(shapefileObjectWithoutPrj);
      } else {
        // Re-throw error if PRJ wasn't the issue
        throw error;
      }
    }
    const featureCollection: GeoJSON.FeatureCollection = Array.isArray(geojson)
      ? geojson[0]
      : geojson;
    
    // Ensure it's a FeatureCollection
    if (!featureCollection || featureCollection.type !== 'FeatureCollection') {
      throw new Error('Invalid GeoJSON format returned from shpjs');
    }
    
    return JSON.stringify(featureCollection);
  } catch (error) {
    throw new Error(
      `Failed to convert Shapefile to GeoJSON: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Convert GeoJSON to Shapefile (ZIP)
 */
export async function geoJSONToShapefile(
  geojson: string | GeoJSON.FeatureCollection
): Promise<ArrayBuffer> {
  try {
    // Parse GeoJSON if string
    const geojsonObj: any =
      typeof geojson === "string"
        ? JSON.parse(geojson)
        : geojson;

    // Ensure GeoJSON is a FeatureCollection
    if (geojsonObj.type !== 'FeatureCollection') {
      throw new Error('GeoJSON must be a FeatureCollection');
    }

    // Ensure features array exists
    if (!Array.isArray(geojsonObj.features)) {
      throw new Error('GeoJSON must have a features array');
    }

    const cleanedFeatures = geojsonObj.features.map((feature: any) => {
      return {
        type: feature.type,
        geometry: feature.geometry,
        properties: { ...feature.properties }
      };
    });

    // Filter features by geometry type and group them
    const pointFeatures = cleanedFeatures.filter(
      (f: any) => f.geometry && f.geometry.type === 'Point'
    );
    const lineFeatures = cleanedFeatures.filter(
      (f: any) => f.geometry && (f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString')
    );
    const polygonFeatures = cleanedFeatures.filter(
      (f: any) => f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')
    );

    try {
      const featureCollection = { type: 'FeatureCollection', features: cleanedFeatures };
      const zipResult = shpZip(featureCollection, {
        types: {
          point: pointFeatures.length > 0 ? 'points' : undefined,
          line: lineFeatures.length > 0 ? 'lines' : undefined,
          polygon: polygonFeatures.length > 0 ? 'polygons' : undefined,
        },
      });

      if (zipResult instanceof Buffer) {
        return zipResult.buffer.slice(zipResult.byteOffset, zipResult.byteOffset + zipResult.byteLength);
      } else if (zipResult instanceof ArrayBuffer) {
        return zipResult;
      } else if (zipResult && typeof zipResult.buffer === 'object') {
        return zipResult.buffer.slice(zipResult.byteOffset, zipResult.byteOffset + zipResult.byteLength);
      } else {
        throw new Error(`shp-write zip function returned unexpected type: ${typeof zipResult}`);
      }
    } catch (error) {
      throw new Error(
        `Failed to convert GeoJSON to Shapefile using shp-write: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  } catch (error) {
    throw new Error(
      `Failed to convert GeoJSON to Shapefile: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export async function reformatShapefile(
  zipBuffer: ArrayBuffer
): Promise<ArrayBuffer> {
  return zipBuffer;
}

