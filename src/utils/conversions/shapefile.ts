/**
 * Shapefile conversion utilities
 */

// @ts-ignore - shpjs has no type definitions
import shpjs from "shpjs";
// @ts-ignore - shp-write has no type definitions
import * as shpWriteModule from "shp-write";
// @ts-ignore - shp-write zip function type is not defined
const shpZip = (shpWriteModule as any).zip || shpWriteModule.zip;
import { convertShapefileEncoding } from "../dbfEncoding";

/**
 * Convert Shapefile (ZIP) to GeoJSON
 * Using shpjs library for better compatibility
 * Automatically detects and converts .dbf file encoding to UTF-8 if needed
 */
export async function shapefileToGeoJSON(
  zipBuffer: ArrayBuffer
): Promise<string> {
  try {
    // First, convert .dbf file encoding to UTF-8 if needed
    const convertedZipBuffer = await convertShapefileEncoding(zipBuffer);
    
    // shpjs can directly accept a ZIP buffer containing shapefile
    // It will automatically extract and parse the shapefile
    const geojson = await shpjs(convertedZipBuffer);

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

