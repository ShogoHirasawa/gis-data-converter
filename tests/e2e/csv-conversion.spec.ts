/**
 * E2E tests for CSV conversion
 */

import { test, expect } from '@playwright/test';
import {
  getFixtureFile,
  uploadFile,
  selectFormat,
  waitForConversion,
  downloadFile,
  getDownloadedFileContent,
  getDownloadedFileBuffer,
  validateGeoJSONInMapLibre,
  validateCSVHasCoordinates,
  setupDownloadInterceptor,
} from './helpers';
import { csvToGeoJSON } from '../../src/utils/conversions/csv';
import { kmlToGeoJSON } from '../../src/utils/conversions/kml';
import { shapefileToGeoJSON } from '../../src/utils/conversions/shapefile';

test.describe('CSV Conversion E2E', () => {
  test.beforeEach(async ({ page }) => {
    await setupDownloadInterceptor(page);
  });

  test('should convert point CSV to GeoJSON and be displayable in MapLibre', async ({ page }) => {
    await page.goto('/');

    const filePath = await getFixtureFile('point', 'points.csv');
    await uploadFile(page, filePath);
    await selectFormat(page, 'GeoJSON');
    await waitForConversion(page);

    const downloadedPath = await downloadFile(page);
    const content = await getDownloadedFileContent(downloadedPath);

    const geojson = JSON.parse(content);
    expect(geojson.type).toBe('FeatureCollection');
    expect(geojson.features.length).toBeGreaterThan(0);

    const mapLibreValidation = await validateGeoJSONInMapLibre(page, content);
    expect(mapLibreValidation.valid).toBe(true);
  });

  test('should convert point CSV to CSV with latitude and longitude columns', async ({ page }) => {
    await page.goto('/');

    const filePath = await getFixtureFile('point', 'points.csv');
    await uploadFile(page, filePath);
    await selectFormat(page, 'CSV');
    await waitForConversion(page);

    const downloadedPath = await downloadFile(page);
    const csvContent = await getDownloadedFileContent(downloadedPath);

    const csvValidation = validateCSVHasCoordinates(csvContent);
    expect(csvValidation.valid).toBe(true);
    const geojson = await csvToGeoJSON(csvContent);
    const mapLibreValidation = await validateGeoJSONInMapLibre(page, geojson);
    expect(mapLibreValidation.valid).toBe(true);
  });

  test('should convert point CSV to KML and be displayable in MapLibre', async ({ page }) => {
    await page.goto('/');

    const filePath = await getFixtureFile('point', 'points.csv');
    await uploadFile(page, filePath);
    await selectFormat(page, 'KML');
    await waitForConversion(page);

    const downloadedPath = await downloadFile(page);
    const kmlContent = await getDownloadedFileContent(downloadedPath);

    const geojson = kmlToGeoJSON(kmlContent);
    const geojsonString = typeof geojson === 'string' ? geojson : JSON.stringify(geojson);

    const mapLibreValidation = await validateGeoJSONInMapLibre(page, geojsonString);
    expect(mapLibreValidation.valid).toBe(true);
  });

  test.skip('should convert point CSV to Shapefile and be displayable in MapLibre', async ({ page }) => {
    await page.goto('/');

    const filePath = await getFixtureFile('point', 'points.csv');
    await uploadFile(page, filePath);
    await selectFormat(page, 'Shapefile');
    await waitForConversion(page);

    const downloadedPath = await downloadFile(page);
    const zipBuffer = await getDownloadedFileBuffer(downloadedPath);

    const arrayBuffer = zipBuffer.buffer.slice(zipBuffer.byteOffset, zipBuffer.byteOffset + zipBuffer.byteLength) as ArrayBuffer;
    const geojson = await shapefileToGeoJSON(arrayBuffer);
    const geojsonString = typeof geojson === 'string' ? geojson : JSON.stringify(geojson);

    const mapLibreValidation = await validateGeoJSONInMapLibre(page, geojsonString);
    expect(mapLibreValidation.valid).toBe(true);
  });

  test('should convert point CSV to PBF and have valid structure', async ({ page }) => {
    await page.goto('/');

    const filePath = await getFixtureFile('point', 'points.csv');
    await uploadFile(page, filePath);
    await selectFormat(page, 'Vector Tiles (Directory Format)');
    await waitForConversion(page);

    const downloadedPath = await downloadFile(page);
    const zipBuffer = await getDownloadedFileBuffer(downloadedPath);

    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(zipBuffer);
    
    const tilesJsonFile = zip.file('tiles.json');
    expect(tilesJsonFile).toBeTruthy();
    
    if (tilesJsonFile) {
      const tilesJson = JSON.parse(await tilesJsonFile.async('string'));
      expect(tilesJson.tilejson).toBeDefined();
    }
  });
});
