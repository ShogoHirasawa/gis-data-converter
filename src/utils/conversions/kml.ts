/**
 * KML conversion utilities
 */

import * as toGeoJSON from "@tmcw/togeojson";
import { DOMParser } from "@xmldom/xmldom";
import { shapefileToGeoJSON } from "./shapefile";
import { geoJSONToKML } from "./geojson";

/**
 * Convert KML to GeoJSON
 */
export function kmlToGeoJSON(kmlText: string): string {
  try {
    // Parse KML XML
    const parser = new DOMParser();
    const kmlDoc = parser.parseFromString(kmlText, "text/xml");

    // Check for parsing errors
    const parseError = kmlDoc.getElementsByTagName("parsererror");
    if (parseError.length > 0) {
      throw new Error("Invalid KML XML format");
    }

    // Convert to GeoJSON
    const geojson = toGeoJSON.kml(kmlDoc);

    return JSON.stringify(geojson, null, 2);
  } catch (error) {
    throw new Error(
      `Failed to convert KML to GeoJSON: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Reformat KML (parse and re-serialize via GeoJSON)
 */
export function reformatKML(kmlText: string): string {
  try {
    // Convert KML → GeoJSON → KML to reformat
    const geojson = kmlToGeoJSON(kmlText);
    return geoJSONToKML(geojson);
  } catch (error) {
    throw new Error(
      `Failed to reformat KML: ${
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
