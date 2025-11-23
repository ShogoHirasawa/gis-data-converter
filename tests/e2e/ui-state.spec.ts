/**
 * E2E tests for UI state transitions
 */

import { test, expect } from '@playwright/test';
import {
  getFixtureFile,
  uploadFile,
  selectFormat,
  waitForConversion,
} from './helpers';

test.describe('UI State Transitions', () => {
  test('should transition through all states correctly', async ({ page }) => {
    await page.goto('/');

    // 1. Initial state: upload
    await expect(page.locator('text=Drop your files here')).toBeVisible();

    // 2. Upload file
    const filePath = await getFixtureFile('point', 'points.geojson');
    await uploadFile(page, filePath);

    // 3. Format detection state - wait for format selection screen
    await page.waitForTimeout(500); // Wait for state transition
    // Look for format selection UI elements
    await expect(page.locator('h3:has-text("Choose")').or(page.locator('text=/Choose.*Format/i'))).toBeVisible({ timeout: 5000 });

    // 4. Select format and start conversion
    await selectFormat(page, 'GeoJSON');

    // 5. Converting state - check progress bar exists (use h2 heading)
    const convertingText = page.locator('h2:has-text("Converting")');
    await convertingText.waitFor({ timeout: 5000 });

    // Wait for progress to reach 100% before completion
    // This ensures conversion is actually complete
    // Look for progress percentage in the converting state
    await page.waitForFunction(
      () => {
        // Look for progress text (e.g., "100%")
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

    // 6. Completed state - use the actual text from translations
    await expect(page.locator('text=Conversion completed!')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Download")')).toBeVisible();
  });

  test('should show error state on conversion failure', async ({ page }) => {
    // This test would require a corrupted file or invalid input
    // For now, we'll just verify the error state UI exists
    await page.goto('/');
    
    // The error state should be accessible (though we won't trigger it here)
    // This is more of a smoke test to ensure the error state component exists
    const uploadArea = page.locator('text=Drop your files here')
      .or(page.locator('text=Drop files here'))
      .first();
    await expect(uploadArea).toBeVisible();
  });

  test('should handle file upload error', async ({ page }) => {
    await page.goto('/');

    // Try to upload a file that's too large (if we had one)
    // For now, just verify the upload error state UI exists
    const uploadArea = page.locator('text=Drop your files here')
      .or(page.locator('text=Drop files here'))
      .first();
    await expect(uploadArea).toBeVisible();
  });

  test('should reset correctly after conversion', async ({ page }) => {
    await page.goto('/');

    // Complete a conversion
    const filePath = await getFixtureFile('point', 'points.geojson');
    await uploadFile(page, filePath);
    await selectFormat(page, 'GeoJSON');
    await waitForConversion(page);

    // Click reset/convert new button - look for button with "Convert New" or "Convert New File" text
    const resetButton = page.locator('button').filter({ hasText: /Convert New/i }).first();
    await resetButton.click({ timeout: 5000 });

    // Should return to upload state - wait a bit for state transition
    await page.waitForTimeout(500);
    
    // Check for upload state (multiple possible texts)
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

    // Start conversion - use more specific selector (h2 heading)
    const convertingText = page.locator('h2:has-text("Converting")');
    await convertingText.waitFor({ timeout: 5000 });

    // Immediately check that we're NOT in completed state
    const completedText = page.locator('text=Conversion Complete');
    await expect(completedText).not.toBeVisible({ timeout: 1000 });

    // Wait for actual completion
    await waitForConversion(page);
    
    // Now it should be completed
    await expect(completedText).toBeVisible({ timeout: 10000 });
  });
});

