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

/**
 * Normalize encoding name for parsedbf (TextDecoder compatibility)
 * parsedbf uses TextDecoder, which supports encoding names like:
 * - 'Shift_JIS' (not 'CP932')
 * - 'windows-932' (for code page 932)
 * - 'UTF-8'
 * 
 * Note: 'SHIFT-JIS' (with hyphen) is not a valid label per WHATWG Encoding Standard
 */
function normalizeEncodingForParsedbf(encoding: string): string {
  const normalized = encoding.trim().toUpperCase();
  
  // Map common encoding names to TextDecoder compatible format
  const encodingMap: Record<string, string> = {
    'CP932': 'Shift_JIS',
    'SHIFT_JIS': 'Shift_JIS',
    // 'SHIFT-JIS' is removed - not a valid label per WHATWG Encoding Standard
    'SJIS': 'Shift_JIS',
    'WINDOWS-31J': 'Shift_JIS',
    'UTF-8': 'UTF-8',
    'UTF8': 'UTF-8',
    'ISO-8859-1': 'ISO-8859-1',
    'LATIN1': 'ISO-8859-1',
  };
  
  return encodingMap[normalized] || normalized;
}

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
    const prjFile = zip.file(`${baseName}.prj`);
    const cpgFile = zip.file(`${baseName}.cpg`);
    
    if (!shpFile) {
      throw new Error(`Could not find ${baseName}.shp in ZIP`);
    }
    
    // Prepare object for shpjs
    const shapefileObject: any = {
      shp: await shpFile.async('arraybuffer')
    };
    
    // Add DBF file if exists (no conversion, shpjs will handle it)
    if (dbfFile) {
      shapefileObject.dbf = await dbfFile.async('arraybuffer');
    }
    
    // Add PRJ file if exists
    if (prjFile) {
      shapefileObject.prj = await prjFile.async('arraybuffer');
    }
    
    // Handle CPG file (encoding specification)
    // If CPG file exists, use it; otherwise, detect encoding and create CPG file
    if (cpgFile) {
      // Use existing CPG file
      let cpgEncoding = await cpgFile.async('string');
      // Normalize encoding name for parsedbf (TextDecoder compatibility)
      cpgEncoding = normalizeEncodingForParsedbf(cpgEncoding);
      shapefileObject.cpg = cpgEncoding;
      console.log(`[DBF Encoding] Using existing CPG file: ${cpgEncoding}`);
    } else if (dbfFile) {
      // No CPG file, detect encoding and create CPG file for shpjs
      const dbfBuffer = await dbfFile.async('arraybuffer');
      let encoding = detectEncodingFromDbf(dbfBuffer);
      console.log(`[DBF Encoding] Auto-detected encoding: ${encoding}`);
      
      // Normalize encoding name for parsedbf (TextDecoder compatibility)
      encoding = normalizeEncodingForParsedbf(encoding);
      
      // Set CPG file so shpjs can handle encoding conversion
      // shpjs will use this CPG file to read DBF file with correct encoding
      shapefileObject.cpg = encoding;
      console.log(`[DBF Encoding] Setting CPG file to: ${encoding}`);
    }
    
    // Use shpjs with object format
    // shpjs will handle encoding conversion based on CPG file
    const geojson = await shpjs(shapefileObject);
    
    // shpjs returns GeoJSON FeatureCollection directly
    // If it's an array of FeatureCollections (multiple shapefiles in ZIP), take the first one
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

    // Clean up features - remove 'id' property from feature level if it exists
    // shp-write may have issues with certain properties
    const cleanedFeatures = geojsonObj.features.map((feature: any) => {
      const cleaned: any = {
        type: feature.type,
        geometry: feature.geometry,
        properties: { ...feature.properties }
      };
      // Remove 'id' from top level if it exists (keep it in properties)
      return cleaned;
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

    // Use shp-write's zip function which handles the conversion and zipping
    // shpZip returns a Buffer (Node.js) or ArrayBuffer (browser)
    try {
      const featureCollection = { type: 'FeatureCollection', features: cleanedFeatures };
      
      // shp-write's zip function returns a Buffer in Node.js or ArrayBuffer in browser
      const zipResult = shpZip(featureCollection, {
        types: {
          point: pointFeatures.length > 0 ? 'points' : undefined,
          line: lineFeatures.length > 0 ? 'lines' : undefined,
          polygon: polygonFeatures.length > 0 ? 'polygons' : undefined,
        },
      });

      // Convert Buffer to ArrayBuffer
      if (zipResult instanceof Buffer) {
        // Node.js Buffer
        return zipResult.buffer.slice(zipResult.byteOffset, zipResult.byteOffset + zipResult.byteLength);
      } else if (zipResult instanceof ArrayBuffer) {
        // Browser ArrayBuffer
        return zipResult;
      } else if (zipResult && typeof zipResult.buffer === 'object') {
        // Uint8Array or similar
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

/**
 * Reformat Shapefile (simply return input as-is)
 * For now, we skip actual reformatting and just return the input file
 */
export async function reformatShapefile(
  zipBuffer: ArrayBuffer
): Promise<ArrayBuffer> {
  // Simply return the input file as-is
  return zipBuffer;
}

