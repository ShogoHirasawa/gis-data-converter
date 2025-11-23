/**
 * Format detection utility
 * Detects input file format based on extension, MIME type, and magic numbers
 */

export type InputFormat =
  | "shapefile"
  | "geojson"
  | "csv"
  | "kml"
  | "gpx"
  | "unknown";

/**
 * Detect file format from File object or ArrayBuffer
 */
export async function detectInputFormat(
  file: File | ArrayBuffer,
  fileName?: string
): Promise<InputFormat> {
  let buffer: ArrayBuffer;
  let name: string;

  if (file instanceof File) {
    buffer = await file.arrayBuffer();
    name = file.name.toLowerCase();
  } else {
    buffer = file;
    name = fileName?.toLowerCase() || "";
  }

  // 1. Check file extension
  const extension = getExtension(name);
  if (extension) {
    const formatByExt = detectByExtension(extension);
    if (formatByExt !== "unknown") {
      return formatByExt;
    }
  }

  // 2. Check magic numbers (first few bytes)
  const formatByMagic = detectByMagicNumber(buffer);
  if (formatByMagic !== "unknown") {
    return formatByMagic;
  }

  // 3. Check MIME type (if File object)
  if (file instanceof File) {
    const formatByMime = detectByMimeType(file.type);
    if (formatByMime !== "unknown") {
      return formatByMime;
    }
  }

  return "unknown";
}

/**
 * Extract file extension from filename
 */
function getExtension(filename: string): string {
  const parts = filename.split(".");
  if (parts.length < 2) return "";
  return parts[parts.length - 1];
}

/**
 * Detect format by file extension
 */
function detectByExtension(extension: string): InputFormat {
  const ext = extension.toLowerCase();

  // Shapefile (ZIP)
  if (ext === "zip") {
    return "shapefile"; // Assume ZIP is Shapefile for now (can be refined with magic number)
  }

  // GeoJSON
  if (ext === "geojson" || ext === "json") {
    return "geojson";
  }

  // KML
  if (ext === "kml" || ext === "kmz") {
    return "kml";
  }

  // CSV
  if (ext === "csv") {
    return "csv";
  }

  // GPX
  if (ext === "gpx") {
    return "gpx";
  }

  return "unknown";
}

/**
 * Detect format by magic number (file signature)
 */
function detectByMagicNumber(buffer: ArrayBuffer): InputFormat {
  if (buffer.byteLength < 4) {
    return "unknown";
  }

  const view = new Uint8Array(buffer);

  // ZIP (Shapefile) - PK\0\0 (50 4B 03 04 or 50 4B 05 06 or 50 4B 07 08)
  if (
    view[0] === 0x50 &&
    view[1] === 0x4b &&
    (view[2] === 0x03 || view[2] === 0x05 || view[2] === 0x07)
  ) {
    // Check if it's a Shapefile by looking for .shp file inside
    // For now, assume ZIP is Shapefile (can be improved with ZIP inspection)
    return "shapefile";
  }

  // JSON/GeoJSON - starts with { or [
  const text = new TextDecoder("utf-8", { fatal: false }).decode(
    buffer.slice(0, 256)
  );
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    // Try to parse as JSON to see if it's valid GeoJSON
    try {
      const json = JSON.parse(text);
      if (
        json.type === "Feature" ||
        json.type === "FeatureCollection" ||
        json.type === "Point" ||
        json.type === "LineString" ||
        json.type === "Polygon" ||
        json.type === "MultiPoint" ||
        json.type === "MultiLineString" ||
        json.type === "MultiPolygon" ||
        json.type === "GeometryCollection"
      ) {
        return "geojson";
      }
      // Still might be JSON, but not GeoJSON
      return "geojson"; // Default to geojson for JSON files
    } catch {
      // Not valid JSON
    }
  }

  // XML (KML/GPX) - starts with <?xml or <kml or <gpx
  if (trimmed.startsWith("<?xml") || trimmed.startsWith("<")) {
    const xmlLower = trimmed.toLowerCase();
    if (xmlLower.includes("<kml") || xmlLower.includes('xmlns="http://www.opengis.net/kml"')) {
      return "kml";
    }
    if (xmlLower.includes("<gpx") || xmlLower.includes('xmlns="http://www.topografix.com/GPX"')) {
      return "gpx";
    }
    // Generic XML - default to KML
    return "kml";
  }

  // CSV - check if it looks like CSV (comma-separated values)
  if (trimmed.includes(",") && trimmed.split("\n").length > 1) {
    // Simple heuristic: has commas and multiple lines
    return "csv";
  }

  return "unknown";
}

/**
 * Detect format by MIME type
 */
function detectByMimeType(mimeType: string): InputFormat {
  const mime = mimeType.toLowerCase();

  if (mime.includes("json") || mime.includes("geojson")) {
    return "geojson";
  }

  if (mime.includes("zip") || mime.includes("x-shp")) {
    return "shapefile";
  }

  if (mime.includes("kml") || mime.includes("kmz") || mime.includes("xml")) {
    return "kml";
  }

  if (mime.includes("csv") || mime.includes("text/csv")) {
    return "csv";
  }

  if (mime.includes("gpx")) {
    return "gpx";
  }

  return "unknown";
}

