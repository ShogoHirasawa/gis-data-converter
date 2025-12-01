/**
 * PRJ file encoding utilities
 */

import JSZip from "jszip";

/**
 * Read PRJ file as UTF-8 string
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
  
  if (!prjFile) {
    return null;
  }
  
  return await prjFile.async('string');
}

