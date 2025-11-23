/**
 * CSV conversion utilities
 */

import * as csv2geojson from "csv2geojson";
import Papa from "papaparse";

/**
 * Convert CSV to GeoJSON
 */
export async function csvToGeoJSON(csvText: string): Promise<string> {
  try {
    return new Promise((resolve, reject) => {
      csv2geojson.csv2geojson(csvText, (err: Error | null, data: any) => {
        if (err) {
          reject(
            new Error(`Failed to convert CSV to GeoJSON: ${err.message}`)
          );
          return;
        }

        if (!data) {
          reject(new Error("CSV conversion returned empty data"));
          return;
        }

        resolve(JSON.stringify(data, null, 2));
      });
    });
  } catch (error) {
    throw new Error(
      `Failed to convert CSV to GeoJSON: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Convert GeoJSON to CSV
 */
export function geoJSONToCSV(geojson: string | any): string {
  try {
    // Parse GeoJSON if string
    const geojsonObj: any =
      typeof geojson === "string"
        ? JSON.parse(geojson)
        : geojson;

    // Extract features
    const features = geojsonObj.features || (geojsonObj.type === "Feature" ? [geojsonObj] : []);

    if (features.length === 0) {
      throw new Error("No features found in GeoJSON");
    }

    // Collect all property keys
    const allKeys = new Set<string>();
    features.forEach((feature: any) => {
      if (feature.properties) {
        Object.keys(feature.properties).forEach((key) => allKeys.add(key));
      }
    });

    // Add geometry columns
    allKeys.add("longitude");
    allKeys.add("latitude");
    if (features.some((f: any) => f.geometry?.type === "LineString" || f.geometry?.type === "Polygon")) {
      allKeys.add("geometry_type");
    }

    // Create CSV rows
    const keys = Array.from(allKeys);
    const rows: string[][] = [keys]; // Header row

    features.forEach((feature: any) => {
      const row: string[] = [];
      keys.forEach((key) => {
        if (key === "longitude" || key === "latitude") {
          // Extract coordinates from geometry
          if (feature.geometry?.type === "Point" && feature.geometry.coordinates) {
            const [lon, lat] = feature.geometry.coordinates;
            row.push(key === "longitude" ? String(lon) : String(lat));
          } else {
            row.push("");
          }
        } else if (key === "geometry_type") {
          row.push(feature.geometry?.type || "");
        } else {
          const value = feature.properties?.[key];
          if (value === null || value === undefined) {
            row.push("");
          } else if (typeof value === "object") {
            row.push(JSON.stringify(value));
          } else {
            row.push(String(value));
          }
        }
      });
      rows.push(row);
    });

    // Convert to CSV string using PapaParse
    return Papa.unparse(rows);
  } catch (error) {
    throw new Error(
      `Failed to convert GeoJSON to CSV: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Reformat CSV (parse and re-serialize)
 */
export function reformatCSV(csvText: string): string {
  try {
    // Parse CSV
    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
    });

    if (parsed.errors.length > 0) {
      console.warn("CSV parsing warnings:", parsed.errors);
    }

    // Re-serialize
    return Papa.unparse(parsed.data);
  } catch (error) {
    throw new Error(
      `Failed to reformat CSV: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
