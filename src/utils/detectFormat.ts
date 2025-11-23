/**
 * Format detection utility
 * Detects input file format based on extension, MIME type, and magic numbers
 */

import JSZip from "jszip";

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

  // 1. Check file extension first (most reliable when available)
  const extension = getExtension(name);
  if (extension) {
    const formatByExt = await detectByExtension(extension, buffer);
    if (formatByExt !== "unknown") {
      return formatByExt;
    }
  }

  // 2. Check MIME type (if File object)
  if (file instanceof File) {
    const formatByMime = detectByMimeType(file.type);
    if (formatByMime !== "unknown") {
      return formatByMime;
    }
  }

  // 3. Check magic numbers as fallback
  const formatByMagic = await detectByMagicNumber(buffer);
  if (formatByMagic !== "unknown") {
    return formatByMagic;
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
async function detectByExtension(extension: string, buffer: ArrayBuffer): Promise<InputFormat> {
  const ext = extension.toLowerCase();

  // ZIP - need to check contents to determine if it's Shapefile
  if (ext === "zip") {
    return await checkZipContents(buffer);
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
 * Check ZIP file contents to determine if it's a Shapefile
 */
async function checkZipContents(buffer: ArrayBuffer): Promise<InputFormat> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const fileNames = Object.keys(zip.files);
    
    // Check if ZIP contains .shp file (Shapefile indicator)
    const hasShpFile = fileNames.some(name => name.toLowerCase().endsWith('.shp'));
    if (hasShpFile) {
      return "shapefile";
    }
    
    // If ZIP doesn't contain .shp, it's not a Shapefile
    // Return unknown so other detection methods can try
    return "unknown";
  } catch (error) {
    // If ZIP parsing fails, it might not be a valid ZIP
    // Return unknown to try other detection methods
    return "unknown";
  }
}

/**
 * Detect format by magic number (file signature)
 */
async function detectByMagicNumber(buffer: ArrayBuffer): Promise<InputFormat> {
  if (buffer.byteLength < 4) {
    return "unknown";
  }

  const view = new Uint8Array(buffer);

  // ZIP - PK\0\0 (50 4B 03 04 or 50 4B 05 06 or 50 4B 07 08)
  if (
    view[0] === 0x50 &&
    view[1] === 0x4b &&
    (view[2] === 0x03 || view[2] === 0x05 || view[2] === 0x07)
  ) {
    // Check ZIP contents to determine if it's a Shapefile
    return await checkZipContents(buffer);
  }

  // JSON/GeoJSON - starts with { or [
  // Read more bytes to ensure we can parse complete JSON
  const maxBytes = Math.min(buffer.byteLength, 8192); // Read up to 8KB
  const text = new TextDecoder("utf-8", { fatal: false }).decode(
    buffer.slice(0, maxBytes)
  );
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    // Try to parse as JSON to see if it's valid GeoJSON
    try {
      // Try parsing the full buffer if it's small enough, otherwise parse the sample
      let json;
      if (buffer.byteLength <= 8192) {
        const fullText = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
        json = JSON.parse(fullText);
      } else {
        json = JSON.parse(text);
      }
      
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
      // Not valid JSON - don't continue to CSV check if it looks like JSON structure
      // If it starts with { or [, it's likely JSON/GeoJSON even if parse failed
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        return "geojson"; // Assume GeoJSON if it looks like JSON structure
      }
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
  // Only check for CSV if it doesn't look like JSON/XML
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[") && !trimmed.startsWith("<")) {
    if (trimmed.includes(",") && trimmed.split("\n").length > 1) {
      // Simple heuristic: has commas and multiple lines, and doesn't look like JSON/XML
      return "csv";
    }
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

