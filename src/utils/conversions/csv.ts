/**
 * CSV conversion utilities
 */

import Papa from "papaparse";

function guessLatLonColumns(headers: string[]): { lat: string | null; lon: string | null } {
  const latRegex = /(Lat)(itude)?/i;
  const lonRegex = /(L)(on|ng)(gitude)?/i;
  
  let latCol: string | null = null;
  let lonCol: string | null = null;
  
  for (const header of headers) {
    const normalizedHeader = header.trim();
    if (!latCol && latRegex.test(normalizedHeader)) {
      latCol = header;
    }
    if (!lonCol && lonRegex.test(normalizedHeader)) {
      lonCol = header;
    }
  }
  
  // If not found, try common variations
  if (!latCol) {
    const latVariations = ['lat', 'latitude', 'y', '緯度'];
    for (const header of headers) {
      if (latVariations.includes(header.toLowerCase().trim())) {
        latCol = header;
        break;
      }
    }
  }
  
  if (!lonCol) {
    const lonVariations = ['lon', 'lng', 'longitude', 'long', 'x', '経度'];
    for (const header of headers) {
      if (lonVariations.includes(header.toLowerCase().trim())) {
        lonCol = header;
        break;
      }
    }
  }
  
  return { lat: latCol, lon: lonCol };
}

/**
 * Convert CSV to GeoJSON
 */
export async function csvToGeoJSON(csvText: string): Promise<string> {
  try {
    // Parse CSV with headers
    const parsed = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
    });

    if (!parsed.data || parsed.data.length === 0) {
      throw new Error("CSV file is empty or has no valid data");
    }

    // Get headers from first row keys
    const firstRow = parsed.data[0];
    if (!firstRow) {
      throw new Error("CSV file has no valid data");
    }
    
    const headers = Object.keys(firstRow).map(h => h.trim());
    if (headers.length === 0) {
      throw new Error("CSV file has no headers");
    }

    // Guess latitude and longitude columns
    const { lat: latCol, lon: lonCol } = guessLatLonColumns(headers);

    if (!latCol || !lonCol) {
      throw new Error(
        `Could not find latitude/longitude columns. Found columns: ${headers.join(", ")}. ` +
        `Please ensure your CSV has columns named 'lat'/'latitude' and 'lon'/'lng'/'longitude'.`
      );
    }

    const features: GeoJSON.Feature[] = [];
    
    for (let i = 0; i < parsed.data.length; i++) {
      const row = parsed.data[i] as Record<string, string>;
      const lat = parseFloat(row[latCol]);
      const lon = parseFloat(row[lonCol]);

      if (isNaN(lat) || isNaN(lon)) {
        continue;
      }

      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        continue;
      }

      const properties: Record<string, unknown> = {};
      for (const key of headers) {
        if (key !== latCol && key !== lonCol) {
          properties[key] = row[key];
        }
      }

      features.push({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [lon, lat],
        },
        properties,
      });
    }

    if (features.length === 0) {
      throw new Error("No valid features could be created from CSV data");
    }

    const geojson = {
      type: "FeatureCollection",
      features,
    };

    return JSON.stringify(geojson, null, 2);
  } catch (error) {
    throw new Error(
      `Failed to convert CSV to GeoJSON: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export function geoJSONToCSV(geojson: string | GeoJSON.FeatureCollection | GeoJSON.Feature): string {
  try {
    const geojsonObj: GeoJSON.FeatureCollection | GeoJSON.Feature =
      typeof geojson === "string"
        ? JSON.parse(geojson) as GeoJSON.FeatureCollection | GeoJSON.Feature
        : geojson;

    const features = (geojsonObj as GeoJSON.FeatureCollection).features || 
                     ((geojsonObj as GeoJSON.Feature).type === "Feature" ? [geojsonObj as GeoJSON.Feature] : []);

    if (features.length === 0) {
      throw new Error("No features found in GeoJSON");
    }

    const allKeys = new Set<string>();
    features.forEach((feature: GeoJSON.Feature) => {
      if (feature.properties) {
        Object.keys(feature.properties).forEach((key) => allKeys.add(key));
      }
    });

    allKeys.add("longitude");
    allKeys.add("latitude");
    if (features.some((f: GeoJSON.Feature) => {
      const geomType = f.geometry?.type;
      return geomType === "LineString" || geomType === "Polygon";
    })) {
      allKeys.add("geometry_type");
    }

    const keys = Array.from(allKeys);
    const rows: string[][] = [keys];

    features.forEach((feature: GeoJSON.Feature) => {
      const row: string[] = [];
      keys.forEach((key) => {
        if (key === "longitude" || key === "latitude") {
          if (feature.geometry?.type === "Point" && feature.geometry.coordinates) {
            const coords = feature.geometry.coordinates as [number, number];
            const [lon, lat] = coords;
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

    return Papa.unparse(rows);
  } catch (error) {
    throw new Error(
      `Failed to convert GeoJSON to CSV: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export function reformatCSV(csvText: string): string {
  try {
    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
    });

    return Papa.unparse(parsed.data);
  } catch (error) {
    throw new Error(
      `Failed to reformat CSV: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
