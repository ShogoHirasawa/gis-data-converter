/**
 * E2E tests for GeoJSON conversion
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
} from './helpers';
import { kmlToGeoJSON } from '../../src/utils/conversions/kml';
import { csvToGeoJSON } from '../../src/utils/conversions/csv';
import { shapefileToGeoJSON } from '../../src/utils/conversions/shapefile';
import JSZip from 'jszip';

test.describe('GeoJSON Conversion E2E', () => {
  const geometries = ['point', 'line', 'polygon'] as const;

  geometries.forEach((geometry) => {
    test.describe(`${geometry} GeoJSON`, () => {
      test('should convert to GeoJSON and be displayable in MapLibre', async ({ page }) => {
        await page.goto('/');

        // Upload file
        const filePath = await getFixtureFile(geometry, `${geometry}s.geojson`);
        await uploadFile(page, filePath);

        // Select GeoJSON format
        await selectFormat(page, 'GeoJSON');

        // Wait for conversion
        await waitForConversion(page);

        // Download file
        const downloadedPath = await downloadFile(page);

        // Verify file content
        const content = await getDownloadedFileContent(downloadedPath);
        expect(content).toBeTruthy();
        expect(content.trim()).not.toBe('');

        const geojson = JSON.parse(content);
        expect(geojson.type).toBe('FeatureCollection');
        expect(geojson.features).toBeDefined();
        expect(geojson.features.length).toBeGreaterThan(0);

        const mapLibreValidation = await validateGeoJSONInMapLibre(page, content);
        expect(mapLibreValidation.valid).toBe(true);
      });

      test('should convert to KML and be displayable in MapLibre', async ({ page }) => {
        await page.goto('/');

        const filePath = await getFixtureFile(geometry, `${geometry}s.geojson`);
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

      if (geometry === 'point') {
        test('should convert to CSV with latitude and longitude columns', async ({ page }) => {
          await page.goto('/');

          const filePath = await getFixtureFile(geometry, `${geometry}s.geojson`);
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
      }

      test.skip('should convert to Shapefile and be displayable in MapLibre', async ({ page }) => {
        await page.goto('/');

        const filePath = await getFixtureFile(geometry, `${geometry}s.geojson`);
        await uploadFile(page, filePath);
        await selectFormat(page, 'Shapefile');
        await waitForConversion(page);

        const downloadedPath = await downloadFile(page);
        const zipBuffer = await getDownloadedFileBuffer(downloadedPath);

        const geojson = await shapefileToGeoJSON(zipBuffer);
        const geojsonString = typeof geojson === 'string' ? geojson : JSON.stringify(geojson);

        const mapLibreValidation = await validateGeoJSONInMapLibre(page, geojsonString);
        expect(mapLibreValidation.valid).toBe(true);
      });

      test('should convert to PBF and have valid structure', async ({ page }) => {
        await page.goto('/');

        const filePath = await getFixtureFile(geometry, `${geometry}s.geojson`);
        await uploadFile(page, filePath);
        await selectFormat(page, 'PBF');
        await waitForConversion(page);

        const downloadedPath = await downloadFile(page);
        const zipBuffer = await getDownloadedFileBuffer(downloadedPath);

        // Validate PBF structure
        const zip = await JSZip.loadAsync(zipBuffer);
        
        // Check tiles.json exists
        const tilesJsonFile = zip.file('tiles.json');
        expect(tilesJsonFile).toBeTruthy();
        
        if (tilesJsonFile) {
          const tilesJson = JSON.parse(await tilesJsonFile.async('string'));
          expect(tilesJson.tilejson).toBeDefined();
          expect(tilesJson.minzoom).toBeDefined();
          expect(tilesJson.maxzoom).toBeDefined();
        }

        // Check PBF files exist
        const pbfFiles = Object.keys(zip.files).filter(name => name.endsWith('.pbf'));
        expect(pbfFiles.length).toBeGreaterThan(0);
      });
    });
  });
});

