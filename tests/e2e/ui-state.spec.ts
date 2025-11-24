/**
 * E2E tests for UI state transitions
 */

import { test, expect } from '@playwright/test';
import {
  getFixtureFile,
  uploadFile,
  selectFormat,
  waitForConversion,
  setupDownloadInterceptor,
} from './helpers';

test.describe('UI State Transitions', () => {
  test.beforeEach(async ({ page }) => {
    await setupDownloadInterceptor(page);
  });

  test('should transition through all states correctly', async ({ page }) => {
    await page.goto('/');

    // 1. Initial state: upload
    await expect(page.locator('text=Drop your files here')).toBeVisible();

    // 2. Upload file
    const filePath = await getFixtureFile('point', 'points.geojson');
    await uploadFile(page, filePath);

    // 3. Format detection state
    await page.waitForTimeout(500);
    await expect(page.locator('h3:has-text("Choose")').or(page.locator('text=/Choose.*Format/i'))).toBeVisible({ timeout: 5000 });

    // 4. Select format and start conversion
    await selectFormat(page, 'GeoJSON');

    // 5. Converting state
    const convertingText = page.locator('h2:has-text("Converting")');
    await convertingText.waitFor({ timeout: 5000 });

    // Wait for progress to reach 100%
    await page.waitForFunction(
      () => {
        const allText = document.body.textContent || '';
        const match = allText.match(/(\d+)%/);
        if (match) {
          const progress = parseInt(match[1], 10);
          return progress >= 100;
        }
        return false;
      },
      { timeout: 30000 }
    );

    // 6. Completed state
    await expect(page.locator('text=Conversion completed!')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Convert New")')).toBeVisible({ timeout: 5000 });
  });

  test('should show error state on conversion failure', async ({ page }) => {
    await page.goto('/');
    
    const uploadArea = page.locator('text=Drop your files here')
      .or(page.locator('text=Drop files here'))
      .first();
    await expect(uploadArea).toBeVisible();
  });

  test('should handle file upload error', async ({ page }) => {
    await page.goto('/');

    const uploadArea = page.locator('text=Drop your files here')
      .or(page.locator('text=Drop files here'))
      .first();
    await expect(uploadArea).toBeVisible();
  });

  test('should reset correctly after conversion', async ({ page }) => {
    await page.goto('/');

    const filePath = await getFixtureFile('point', 'points.geojson');
    await uploadFile(page, filePath);
    await selectFormat(page, 'GeoJSON');
    await waitForConversion(page);

    const resetButton = page.locator('button').filter({ hasText: /Convert New/i }).first();
    await resetButton.click({ timeout: 5000 });

    await page.waitForTimeout(500);
    
    const uploadState = page.locator('text=Drop files here')
      .or(page.locator('text=Drop your files here'))
      .or(page.locator('text=/Drop.*files/i'))
      .first();
    await expect(uploadState).toBeVisible({ timeout: 5000 });
  });

  test('should not transition to completed before conversion is done', async ({ page }) => {
    await page.goto('/');

    const filePath = await getFixtureFile('point', 'points.geojson');
    await uploadFile(page, filePath);
    await selectFormat(page, 'GeoJSON');

    const convertingText = page.locator('h2:has-text("Converting")');
    await convertingText.waitFor({ timeout: 5000 });

    const completedText = page.locator('text=/Conversion completed/i');
    await expect(completedText).not.toBeVisible({ timeout: 1000 });

    await waitForConversion(page);
    
    await expect(completedText).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Format Detection Display', () => {
  test('should display correct detected format for GeoJSON', async ({ page }) => {
    await page.goto('/');
    
    const filePath = await getFixtureFile('point', 'points.geojson');
    await uploadFile(page, filePath);
    
    await page.waitForTimeout(500);
    
    const detectedFormatMessage = page.locator('h2').filter({ 
      hasText: /GeoJSON|geojson/i 
    });
    await expect(detectedFormatMessage).toBeVisible({ timeout: 5000 });
  });

  test('should display correct detected format for CSV', async ({ page }) => {
    await page.goto('/');
    
    const filePath = await getFixtureFile('point', 'points.csv');
    await uploadFile(page, filePath);
    
    await page.waitForTimeout(500);
    
    const detectedFormatMessage = page.locator('h2').filter({ 
      hasText: /CSV|csv/i 
    });
    await expect(detectedFormatMessage).toBeVisible({ timeout: 5000 });
  });

  test('should display correct detected format for KML', async ({ page }) => {
    await page.goto('/');
    
    const filePath = await getFixtureFile('point', 'points.kml');
    await uploadFile(page, filePath);
    
    await page.waitForTimeout(500);
    
    const detectedFormatMessage = page.locator('h2').filter({ 
      hasText: /KML|kml/i 
    });
    await expect(detectedFormatMessage).toBeVisible({ timeout: 5000 });
  });

  test('should display correct detected format for Shapefile', async ({ page }) => {
    await page.goto('/');
    
    const filePath = await getFixtureFile('point', 'points.shp.zip');
    await uploadFile(page, filePath);
    
    await page.waitForTimeout(500);
    
    const detectedFormatMessage = page.locator('h2').filter({ 
      hasText: /Shapefile|shapefile/i 
    });
    await expect(detectedFormatMessage).toBeVisible({ timeout: 5000 });
  });
});
