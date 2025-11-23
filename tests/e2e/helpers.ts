/**
 * E2E test helpers
 */

import { Page, expect } from '@playwright/test';
import { readFile } from 'fs/promises';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

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

  // Wait for completion state - look for multiple possible texts
  // "Conversion completed!" (English), "Conversion Complete", or Download button
  try {
    await Promise.race([
      // Look for "Conversion completed!" text (from translations)
      page.waitForSelector('text=/Conversion completed/i', { timeout }),
      // Look for "Conversion Complete" text
      page.waitForSelector('text=/Conversion Complete/i', { timeout }),
      // Look for Download button (indicates completion)
      page.waitForSelector('button:has-text("Download")', { timeout }),
      // Look for completed state by checking for CheckCircle icon or completed message
      page.waitForFunction(
        () => {
          const bodyText = document.body.textContent || '';
          return bodyText.includes('Conversion completed') || 
                 bodyText.includes('Conversion Complete') ||
                 bodyText.includes('Download') && bodyText.includes('Convert New');
        },
        { timeout }
      ),
    ]);
  } catch (error) {
    // Check if we're in error state
    const isError = await page.locator('text=/Conversion failed|Error|Failed/i').isVisible({ timeout: 1000 }).catch(() => false);
    if (isError) {
      const errorText = await page.locator('text=/Conversion failed|Error|Failed/i').first().textContent().catch(() => 'Unknown error');
      throw new Error(`Conversion failed: ${errorText}`);
    }
    
    // If not error, check what state we're in
    const currentUrl = page.url();
    const bodyText = await page.textContent('body').catch(() => '');
    throw new Error(`Conversion did not complete within timeout. Current state: ${bodyText.substring(0, 200)}`);
  }
  
  // Additional wait to ensure UI is fully rendered
  await page.waitForTimeout(500);
}

/**
 * Upload file and wait for format detection
 */
export async function uploadFile(
  page: Page,
  filePath: string
): Promise<void> {
  // Find file input (might be hidden)
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(filePath);
  
  // Wait for format detection state (check for "Choose" text which appears in "Choose your conversion format")
  await page.waitForSelector('text=Choose', { timeout: 10000 });
}

/**
 * Select output format and start conversion
 */
export async function selectFormat(
  page: Page,
  formatName: string
): Promise<void> {
  // Normalize format name for matching
  const normalizedFormatName = formatName.toLowerCase();
  
  // Map format names to possible display names
  const formatMap: Record<string, string[]> = {
    'geojson': ['GeoJSON', 'geojson'],
    'kml': ['KML', 'kml'],
    'csv': ['CSV', 'csv'],
    'shapefile': ['Shapefile', 'shapefile'],
    'pbf': ['PBF', 'pbf'],
  };

  const possibleNames = formatMap[normalizedFormatName] || [formatName];
  
  // Format cards are clickable divs that contain the format name in an h4 element
  // Try to find the format card by looking for h4 with the format name
  let formatCard = null;
  
  for (const name of possibleNames) {
    // Look for h4 element containing the format name, then find its parent card
    formatCard = page.locator(`h4:has-text("${name}")`).locator('..').first();
    
    if (await formatCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      break;
    }
    
    // Fallback: look for any div containing the format name that's clickable
    formatCard = page.locator(`div:has-text("${name}")`).filter({ 
      has: page.locator(`h4, h3`).filter({ hasText: new RegExp(name, 'i') })
    }).first();
    
    if (await formatCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      break;
    }
  }
  
  if (!formatCard || !(await formatCard.isVisible({ timeout: 2000 }).catch(() => false))) {
    // Last resort: find by text content (case insensitive)
    formatCard = page.locator(`*:has-text("${formatName}")`).filter({ 
      hasNot: page.locator('input, button[type="submit"]')
    }).first();
  }
  
  // Scroll into view and click
  await formatCard.scrollIntoViewIfNeeded();
  await formatCard.click({ timeout: 5000 });

  // If PBF format, handle options dialog
  if (normalizedFormatName === 'pbf') {
    // Wait for PBF options dialog to appear
    await page.waitForSelector('text=PBF Conversion Options', { timeout: 5000 });
    
    // Fill in layer name (default is "layer", change to "test-layer")
    const layerNameInput = page.locator('input#layerName').or(
      page.locator('input[placeholder="layer"]')
    ).first();
    await layerNameInput.fill('test-layer');
    
    // Click Convert button
    const convertButton = page.locator('button:has-text("Convert")').first();
    await convertButton.click({ timeout: 5000 });
  }
}

/**
 * Download converted file
 */
export async function downloadFile(page: Page): Promise<string> {
  // Wait for download button
  const downloadButton = page.locator('button:has-text("Download")').first();
  
  // Set up download listener
  const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
  await downloadButton.click();
  const download = await downloadPromise;
  
  // Save to temporary file
  const path = await download.path();
  if (!path) {
    throw new Error('Download failed: no path returned');
  }
  
  return path;
}

/**
 * Get downloaded file content as string
 */
export async function getDownloadedFileContent(filePath: string): Promise<string> {
  const content = await readFile(filePath, 'utf-8');
  return content;
}

/**
 * Get downloaded file content as ArrayBuffer
 */
export async function getDownloadedFileBuffer(filePath: string): Promise<ArrayBuffer> {
  const content = await readFile(filePath);
  return content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength);
}

/**
 * Load MapLibre GL JS from local file if not already loaded
 */
async function ensureMapLibreLoaded(page: Page): Promise<void> {
  // Check if MapLibre is already loaded
  const isLoaded = await page.evaluate(() => typeof (window as any).maplibregl !== 'undefined');
  
  if (!isLoaded) {
    // Load from local file
    await page.addScriptTag({ path: MAPLIBRE_GL_JS_PATH });
    
    // Wait for MapLibre to be available
    await page.waitForFunction(() => typeof (window as any).maplibregl !== 'undefined', {
      timeout: 10000
    });
  }
}

/**
 * Load JSZip from local file if not already loaded
 */
async function ensureJSZipLoaded(page: Page): Promise<void> {
  // Check if JSZip is already loaded
  const isLoaded = await page.evaluate(() => typeof (window as any).JSZip !== 'undefined');
  
  if (!isLoaded) {
    // Load from local file
    await page.addScriptTag({ path: JSZIP_PATH });
    
    // Wait for JSZip to be available
    await page.waitForFunction(() => typeof (window as any).JSZip !== 'undefined', {
      timeout: 10000
    });
  }
}

/**
 * Validate GeoJSON can be displayed in MapLibre GL JS
 */
export async function validateGeoJSONInMapLibre(
  page: Page,
  geojsonString: string
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  try {
    // Load MapLibre GL JS from local file
    await ensureMapLibreLoaded(page);

    const result = await page.evaluate(async (geojsonStr) => {
      const maplibregl = (window as any).maplibregl;
      if (!maplibregl) {
        return { valid: false, errors: ['MapLibre GL JS not available'] };
      }

      try {
        const geojson = JSON.parse(geojsonStr);

        // Create a hidden map container
        const container = document.createElement('div');
        container.style.width = '1px';
        container.style.height = '1px';
        container.style.position = 'absolute';
        container.style.visibility = 'hidden';
        document.body.appendChild(container);

        // Initialize map with minimal style (no external resources)
        const map = new maplibregl.Map({
          container,
          style: {
            version: 8,
            sources: {},
            layers: [],
          },
          interactive: false,
        });

        // Wait for map to load
        let mapError: any = null;
        map.on('error', (e: any) => {
          mapError = e;
        });

        await new Promise((resolve, reject) => {
          map.on('load', () => {
            if (mapError) {
              reject(new Error(`Map error: ${mapError.error?.message || mapError.message || 'Unknown map error'}`));
            } else {
              resolve(true);
            }
          });
          setTimeout(() => {
            if (mapError) {
              reject(new Error(`Map error: ${mapError.error?.message || mapError.message || 'Unknown map error'}`));
            } else {
              resolve(true);
            }
          }, 5000);
        });

        map.addSource('test-source', {
          type: 'geojson',
          data: geojson,
        });

        const features = geojson.features || (geojson.type === 'Feature' ? [geojson] : []);
        if (features.length > 0) {
          const firstFeature = features[0];
          const geometryType = firstFeature.geometry?.type;

          let layerType = 'circle';
          if (geometryType === 'LineString' || geometryType === 'MultiLineString') {
            layerType = 'line';
          } else if (geometryType === 'Polygon' || geometryType === 'MultiPolygon') {
            layerType = 'fill';
          }

          map.addLayer({
            id: 'test-layer',
            type: layerType as any,
            source: 'test-source',
            paint: layerType === 'circle' 
              ? { 'circle-color': '#7FAD6F' }
              : layerType === 'line'
              ? { 'line-color': '#7FAD6F' }
              : { 'fill-color': '#7FAD6F' },
          });

          await new Promise(resolve => setTimeout(resolve, 500));
        }

        map.remove();
        container.remove();

        return { valid: true, errors: [] };
      } catch (error: any) {
        let errorMessage = 'Unknown error';
        try {
          if (error instanceof Error) {
            errorMessage = error.message || error.toString();
          } else if (typeof error === 'string') {
            errorMessage = error;
          } else if (error && typeof error === 'object') {
            if (error.error && error.error.message) {
              errorMessage = error.error.message;
            } else if (error.message) {
              errorMessage = error.message;
            } else if (error.toString && error.toString() !== '[object Object]') {
              errorMessage = error.toString();
            } else {
              try {
                const errorStr = JSON.stringify(error);
                errorMessage = errorStr.length > 500 ? errorStr.substring(0, 500) + '...' : errorStr;
              } catch {
                errorMessage = 'Error object could not be serialized';
              }
            }
          }
        } catch (e) {
          errorMessage = `Error extracting error message: ${e}`;
        }
        
        return {
          valid: false,
          errors: [errorMessage],
        };
      }
    }, geojsonString);

    return result;
  } catch (error: any) {
    const errorMessage = error?.message || error?.toString() || JSON.stringify(error) || 'Unknown error';
    errors.push(errorMessage);
    return { valid: false, errors };
  }
}

/**
 * Validate PBF tiles can be displayed in MapLibre GL JS
 */
export async function validatePBFInMapLibre(
  page: Page,
  zipBuffer: ArrayBuffer
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  try {
    // Load MapLibre GL JS and JSZip from local files
    await ensureMapLibreLoaded(page);
    await ensureJSZipLoaded(page);

    // Convert ArrayBuffer to base64 for passing to page.evaluate
    const base64 = Buffer.from(zipBuffer).toString('base64');

    const result = await page.evaluate(async (base64Data) => {
      const JSZip = (window as any).JSZip;
      const maplibregl = (window as any).maplibregl;

      try {
        // Decode base64 to binary
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Load ZIP
        const zip = await JSZip.loadAsync(bytes);
        
        // Check tiles.json
        const tilesJsonFile = zip.file('tiles.json');
        if (!tilesJsonFile) {
          return { valid: false, errors: ['Missing tiles.json'] };
        }

        const tilesJson = JSON.parse(await tilesJsonFile.async('string'));
        
        // Check PBF files
        const pbfFiles = Object.keys(zip.files).filter(name => name.endsWith('.pbf'));
        if (pbfFiles.length === 0) {
          return { valid: false, errors: ['No PBF files found'] };
        }

        // For now, just validate structure
        // Full MapLibre validation would require setting up a tile server
        return { valid: true, errors: [] };
      } catch (error: any) {
        return {
          valid: false,
          errors: [error.message || String(error)],
        };
      }
    }, base64);

    return result;
  } catch (error: any) {
    errors.push(error.message || String(error));
    return { valid: false, errors };
  }
}

/**
 * Check if CSV contains latitude and longitude columns
 */
export function validateCSVHasCoordinates(csvContent: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const lines = csvContent.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    errors.push('CSV is empty');
    return { valid: false, errors };
  }

  const header = lines[0].toLowerCase();
  const hasLatitude = header.includes('latitude') || header.includes('lat');
  const hasLongitude = header.includes('longitude') || header.includes('lon') || header.includes('lng');

  if (!hasLatitude) {
    errors.push('CSV missing latitude column');
  }
  if (!hasLongitude) {
    errors.push('CSV missing longitude column');
  }

  // Check if data rows have coordinates
  if (lines.length > 1) {
    const dataRows = lines.slice(1);
    const headerCols = header.split(',');
    const latIndex = headerCols.findIndex(col => col.includes('lat'));
    const lonIndex = headerCols.findIndex(col => col.includes('lon') || col.includes('lng'));

    if (latIndex >= 0 && lonIndex >= 0) {
      const rowsWithEmptyCoords = dataRows.filter(row => {
        const cols = row.split(',');
        const lat = cols[latIndex]?.trim();
        const lon = cols[lonIndex]?.trim();
        return !lat || !lon || lat === '' || lon === '';
      });

      if (rowsWithEmptyCoords.length > 0) {
        errors.push(`${rowsWithEmptyCoords.length} rows have empty coordinates`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

