/**
 * GeoJSON conversion utilities
 */

import tokml from "tokml";
import togpx from "togpx";
import { shapefileToGeoJSON } from "./shapefile";
import { geoJSONToCSV } from "./csv";

/**
 * Convert GeoJSON to KML
 */
export function geoJSONToKML(
  geojson: string | any
): string {
  try {
    // Parse GeoJSON if string
    const geojsonObj: any =
      typeof geojson === "string"
        ? JSON.parse(geojson)
        : geojson;

    // Convert to KML using tokml
    const kml = tokml(geojsonObj, {
      name: "name",
      description: "description",
    });

    return kml;
  } catch (error) {
    throw new Error(
      `Failed to convert GeoJSON to KML: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Convert GeoJSON to GPX
 */
export function geoJSONToGPX(
  geojson: string | any
): string {
  try {
    // Parse GeoJSON if string
    const geojsonObj: any =
      typeof geojson === "string"
        ? JSON.parse(geojson)
        : geojson;

    // Convert to GPX using togpx
    const gpx = togpx(geojsonObj);

    return gpx;
  } catch (error) {
    throw new Error(
      `Failed to convert GeoJSON to GPX: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Convert Shapefile to KML (via GeoJSON)
 */
export async function shapefileToKML(
  zipBuffer: ArrayBuffer
): Promise<string> {
  try {
    // First convert to GeoJSON
    const geojson = await shapefileToGeoJSON(zipBuffer);
    // Then convert to KML
    return geoJSONToKML(geojson);
  } catch (error) {
    throw new Error(
      `Failed to convert Shapefile to KML: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Convert Shapefile to GPX (via GeoJSON)
 */
export async function shapefileToGPX(
  zipBuffer: ArrayBuffer
): Promise<string> {
  try {
    // First convert to GeoJSON
    const geojson = await shapefileToGeoJSON(zipBuffer);
    // Then convert to GPX
    return geoJSONToGPX(geojson);
  } catch (error) {
    throw new Error(
      `Failed to convert Shapefile to GPX: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Convert GeoJSON to CSV
 */
export function geoJSONToCSVExport(
  geojson: string | any
): string {
  return geoJSONToCSV(geojson);
}

/**
 * Reformat GeoJSON (parse and re-serialize)
 */
export function reformatGeoJSON(geojson: string): string {
  try {
    // Parse and re-serialize to reformat
    const geojsonObj: any = JSON.parse(geojson);
    return JSON.stringify(geojsonObj, null, 2);
  } catch (error) {
    throw new Error(
      `Failed to reformat GeoJSON: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}


