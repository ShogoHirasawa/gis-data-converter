/**
 * E2E test helpers
 */

import { Page, expect } from '@playwright/test';
import { readFile, writeFile } from 'fs/promises';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURES_DIR = join(__dirname, '../fixtures/input');

// Get paths to libraries from node_modules
const MAPLIBRE_GL_JS_PATH = resolve(__dirname, '../../node_modules/maplibre-gl/dist/maplibre-gl.js');
const JSZIP_PATH = resolve(__dirname, '../../node_modules/jszip/dist/jszip.min.js');

/**
 * Read fixture file as File object for upload
 */
export async function getFixtureFile(
  geometry: 'point' | 'line' | 'polygon',
  filename: string
): Promise<string> {
  return join(FIXTURES_DIR, geometry, filename);
}

/**
 * Wait for conversion to complete
 */
export async function waitForConversion(page: Page, timeout: number = 30000): Promise<void> {
  // Wait for converting state (might be very brief)
  try {
    await page.waitForSelector('text=Converting', { timeout: 5000 });
  } catch {
    // Converting state might be skipped if conversion is very fast
  }

  // Wait for completion state
  try {
    await Promise.race([
      page.waitForSelector('text=/Conversion completed/i', { timeout }),
      page.waitForSelector('button:has-text("Convert New")', { timeout }),
    ]);
  } catch {
    throw new Error('Conversion did not complete within timeout');
  }
}

/**
 * Upload a file to the page
 */
export async function uploadFile(page: Page, filePath: string): Promise<void> {
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(filePath);
  
  // Wait for file to be processed
  await page.waitForTimeout(500);
}

/**
 * Select output format
 */
export async function selectFormat(page: Page, formatName: string): Promise<void> {
  // Normalize format name
  const normalizedFormatName = formatName.toLowerCase();
  
  // Wait for format selection screen
  await page.waitForSelector('h3:has-text("Choose")', { timeout: 5000 });
  
  // Find and click the format card
  let formatCard = page.locator(`[data-format="${normalizedFormatName}"]`).first();
  
  if (!(await formatCard.isVisible({ timeout: 2000 }).catch(() => false))) {
    formatCard = page.locator(`*:has-text("${formatName}")`).filter({ 
      hasNot: page.locator('input, button[type="submit"]')
    }).first();
  }
  
  await formatCard.scrollIntoViewIfNeeded();
  await formatCard.click({ timeout: 5000 });

  // If PBF format, handle options dialog
  if (normalizedFormatName === 'pbf') {
    // Wait for dialog to appear
    await page.waitForSelector('text=PBF Conversion Options', { timeout: 10000 });
    
    // Wait a bit for dialog to fully render
    await page.waitForTimeout(300);
    
    // Fill in layer name
    const layerNameInput = page.locator('input#layerName').first();
    await layerNameInput.waitFor({ state: 'visible', timeout: 5000 });
    await layerNameInput.fill('test-layer');
    
    // Click Convert button (form submit button)
    const convertButton = page.locator('button[type="submit"]:has-text("Convert")').or(
      page.locator('button:has-text("Convert")').filter({ hasNot: page.locator('button[type="button"]') })
    ).first();
    await convertButton.waitFor({ state: 'visible', timeout: 5000 });
    await convertButton.click({ timeout: 5000 });
    
    // Wait for dialog to close
    await page.waitForSelector('text=PBF Conversion Options', { state: 'hidden', timeout: 5000 }).catch(() => {
      // Dialog might close immediately, ignore error
    });
  }
}

/**
 * Set up download interceptor
 * Captures blob and filename when download is triggered
 */
export async function setupDownloadInterceptor(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Storage for captured download data
    (window as any).__downloadData = {
      blob: null as Blob | null,
      fileName: null as string | null,
    };
    
    // Override URL.createObjectURL to capture the blob
    const originalCreateObjectURL = URL.createObjectURL;
    URL.createObjectURL = function(blob: Blob) {
      const url = originalCreateObjectURL.call(URL, blob);
      if (blob instanceof Blob) {
        (window as any).__downloadData.blob = blob;
      }
      return url;
    };
    
    // Override document.body.appendChild to capture filename
    const originalAppendChild = document.body.appendChild;
    document.body.appendChild = function<T extends Node>(node: T): T {
      const result = originalAppendChild.call(document.body, node);
      if (node instanceof HTMLAnchorElement && node.download) {
        (window as any).__downloadData.fileName = node.download;
      }
      return result;
    };
  });
}

/**
 * Download converted file
 * Files are automatically downloaded when conversion completes.
 * We capture the blob before it's downloaded and save it to a file.
 */
export async function downloadFile(page: Page): Promise<string> {
  // Wait for conversion to complete
  await waitForConversion(page);
  
  // Wait for download to be triggered
  await page.waitForTimeout(1000);
  
  // Get the captured blob and filename
  const downloadData = await page.evaluate(async () => {
    const captured = (window as any).__downloadData;
    
    // Wait for blob and filename (up to 5 seconds)
    for (let i = 0; i < 50; i++) {
      if (captured.blob && captured.fileName) {
        // Convert blob to base64
        return new Promise<{ blobData: string; fileName: string; mimeType: string }>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            const base64 = result.includes(',') ? result.split(',')[1] : result;
            resolve({
              blobData: base64,
              fileName: captured.fileName!,
              mimeType: captured.blob!.type || 'application/octet-stream',
            });
          };
          reader.onerror = () => reject(new Error('Failed to read blob'));
          reader.readAsDataURL(captured.blob);
        });
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error('Timeout waiting for download blob and filename');
  });
  
  // Save to temporary file
  const buffer = Buffer.from(downloadData.blobData, 'base64');
  const tempPath = join(tmpdir(), downloadData.fileName);
  await writeFile(tempPath, buffer);
  
  return tempPath;
}

/**
 * Get downloaded file content as string
 */
export async function getDownloadedFileContent(filePath: string): Promise<string> {
  return await readFile(filePath, 'utf-8');
}

/**
 * Get downloaded file content as buffer
 */
export async function getDownloadedFileBuffer(filePath: string): Promise<Buffer> {
  return await readFile(filePath);
}

/**
 * Validate GeoJSON in MapLibre
 */
export async function validateGeoJSONInMapLibre(
  page: Page,
  geojson: string | object
): Promise<{ valid: boolean; error?: string }> {
  const geojsonString = typeof geojson === 'string' ? geojson : JSON.stringify(geojson);
  
  const result = await page.evaluate(
    async ({ geojson, maplibrePath }) => {
      // Load MapLibre GL JS
      await import(maplibrePath);
      
      try {
        const data = typeof geojson === 'string' ? JSON.parse(geojson) : geojson;
        
        // Validate GeoJSON structure
        if (!data.type) {
          return { valid: false, error: 'Missing type property' };
        }
        
        if (data.type === 'FeatureCollection' && !Array.isArray(data.features)) {
          return { valid: false, error: 'Invalid FeatureCollection' };
        }
        
        // Try to create a MapLibre source (this validates the GeoJSON)
        const map = new (window as any).maplibregl.Map({
          container: document.createElement('div'),
          style: { version: 8, sources: {}, layers: [] },
        });
        
        map.addSource('test', {
          type: 'geojson',
          data: data,
        });
        
        map.remove();
        
        return { valid: true };
      } catch (error) {
        return {
          valid: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
    { geojson: geojsonString, maplibrePath: `file://${MAPLIBRE_GL_JS_PATH}` }
  );
  
  return result;
}

/**
 * Validate CSV has coordinates
 */
export function validateCSVHasCoordinates(csvContent: string): { valid: boolean; error?: string } {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) {
    return { valid: false, error: 'CSV has less than 2 lines' };
  }
  
  const headers = lines[0].toLowerCase().split(',');
  const hasLat = headers.some((h) => h.trim() === 'latitude' || h.trim() === 'lat');
  const hasLon = headers.some((h) => h.trim() === 'longitude' || h.trim() === 'lon' || h.trim() === 'lng');
  
  if (!hasLat || !hasLon) {
    return { valid: false, error: 'CSV missing latitude or longitude column' };
  }
  
  return { valid: true };
}
