/**
 * Test helper utilities
 */

import { readFile } from 'fs/promises';
import { join } from 'path';

const FIXTURES_DIR = join(__dirname, '../fixtures');
export const INPUT_DIR = join(FIXTURES_DIR, 'input');

/**
 * Read input file as File object
 */
export async function readInputFile(
  geometry: 'point' | 'line' | 'polygon',
  filename: string
): Promise<File> {
  const filePath = join(INPUT_DIR, geometry, filename);
  const buffer = await readFile(filePath);
  
  // Determine MIME type from extension
  let mimeType = 'application/octet-stream';
  if (filename.endsWith('.geojson') || filename.endsWith('.json')) {
    mimeType = 'application/geo+json';
  } else if (filename.endsWith('.kml')) {
    mimeType = 'application/vnd.google-earth.kml+xml';
  } else if (filename.endsWith('.csv')) {
    mimeType = 'text/csv';
  } else if (filename.endsWith('.zip')) {
    mimeType = 'application/zip';
  }
  
  return new File([buffer], filename, { type: mimeType });
}

/**
 * Read input file as string
 */
export async function readInputFileAsString(
  geometry: 'point' | 'line' | 'polygon',
  filename: string
): Promise<string> {
  const filePath = join(INPUT_DIR, geometry, filename);
  const buffer = await readFile(filePath);
  return new TextDecoder('utf-8').decode(buffer);
}

/**
 * Read input file as ArrayBuffer
 */
export async function readInputFileAsArrayBuffer(
  geometry: 'point' | 'line' | 'polygon',
  filename: string
): Promise<ArrayBuffer> {
  const filePath = join(INPUT_DIR, geometry, filename);
  const buffer = await readFile(filePath);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

