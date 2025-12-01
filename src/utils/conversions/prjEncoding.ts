/**
 * PRJ file encoding utilities
 * Note: PRJ files are typically ASCII-only WKT format, so they are always read as UTF-8
 */

import JSZip from "jszip";

/**
 * Read PRJ file as UTF-8 string
 * PRJ files are typically ASCII-only WKT format, so they are always read as UTF-8
 * even if DBF file uses a different encoding (e.g., Shift_JIS)
 * 
 * @param zip - JSZip instance
 * @param baseName - Base name of the shapefile (without extension)
 * @returns PRJ file content as UTF-8 string, or null if PRJ file doesn't exist
 */
export async function readPrjFileWithEncoding(
  zip: JSZip,
  baseName: string
): Promise<string | null> {
  const prjFile = zip.file(`${baseName}.prj`);
  
  // PRJ file is optional, return null if it doesn't exist
  if (!prjFile) {
    return null;
  }
  
  // PRJ files are typically ASCII-only WKT format, so read as UTF-8
  // Even if DBF uses Shift_JIS, PRJ files are usually UTF-8/ASCII
  return await prjFile.async('string');
}

