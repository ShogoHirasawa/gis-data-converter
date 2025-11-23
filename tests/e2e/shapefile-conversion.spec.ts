/**
 * E2E tests for Shapefile conversion
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
import { shapefileToGeoJSON } from '../../src/utils/conversions/shapefile';
import { kmlToGeoJSON } from '../../src/utils/conversions/kml';
import { csvToGeoJSON } from '../../src/utils/conversions/csv';
import JSZip from 'jszip';

test.describe('Shapefile Conversion E2E', () => {
  const geometries = ['point', 'line', 'polygon'] as const;

  geometries.forEach((geometry) => {
    test.describe(`${geometry} Shapefile`, () => {
      test('should convert to GeoJSON and be displayable in MapLibre', async ({ page }) => {
        await page.goto('/');

        const filePath = await getFixtureFile(geometry, `${geometry}s.shp.zip`);
        await uploadFile(page, filePath);
        await selectFormat(page, 'GeoJSON');
        await waitForConversion(page);

        const downloadedPath = await downloadFile(page);
        const content = await getDownloadedFileContent(downloadedPath);

        // Validate GeoJSON structure
        const geojson = JSON.parse(content);
        expect(geojson.type).toBe('FeatureCollection');
        expect(geojson.features.length).toBeGreaterThan(0);

        const mapLibreValidation = await validateGeoJSONInMapLibre(page, content);
        expect(mapLibreValidation.valid).toBe(true);
      });

      test('should convert to KML and be displayable in MapLibre', async ({ page }) => {
        await page.goto('/');

        const filePath = await getFixtureFile(geometry, `${geometry}s.shp.zip`);
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

          const filePath = await getFixtureFile(geometry, `${geometry}s.shp.zip`);
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

      test('should convert to Shapefile and be displayable in MapLibre', async ({ page }) => {
        await page.goto('/');

        const filePath = await getFixtureFile(geometry, `${geometry}s.shp.zip`);
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

        const filePath = await getFixtureFile(geometry, `${geometry}s.shp.zip`);
        await uploadFile(page, filePath);
        await selectFormat(page, 'PBF');
        await waitForConversion(page);

        const downloadedPath = await downloadFile(page);
        const zipBuffer = await getDownloadedFileBuffer(downloadedPath);

        // Validate PBF structure
        const zip = await JSZip.loadAsync(zipBuffer);
        
        const tilesJsonFile = zip.file('tiles.json');
        expect(tilesJsonFile).toBeTruthy();
        
        if (tilesJsonFile) {
          const tilesJson = JSON.parse(await tilesJsonFile.async('string'));
          expect(tilesJson.tilejson).toBeDefined();
        }

        const pbfFiles = Object.keys(zip.files).filter(name => name.endsWith('.pbf'));
        expect(pbfFiles.length).toBeGreaterThan(0);
      });
    });
  });
});

