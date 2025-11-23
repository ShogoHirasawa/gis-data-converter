/**
 * PBF conversion tests
 */

import { describe, it, expect } from 'vitest';
import { convertFileForTest } from '../utils/converter-test-helper';
import { readInputFile } from '../utils/test-helpers';
import { validatePBFForMapLibre } from '../utils/mapbox-validator';

describe('PBF Conversion', () => {
  const geometries = ['point', 'line', 'polygon'] as const;
  const inputFormats = [
    { format: 'geojson', filename: (g: string) => `${g}s.geojson` },
    { format: 'shapefile', filename: (g: string) => `${g}s.shp.zip` },
    { format: 'kml', filename: (g: string) => `${g}s.kml` },
    { format: 'csv', filename: () => 'points.csv', skipFor: ['line', 'polygon'] },
  ] as const;

  geometries.forEach((geometry) => {
    inputFormats.forEach(({ format, filename, skipFor }) => {
      if (skipFor?.includes(geometry)) {
        return; // スキップ
      }

      it(`should convert ${geometry} ${format} to PBF`, async () => {
        // 1. 入力ファイルを読み込む
        const inputFile = await readInputFile(geometry, filename(geometry));

        // 2. 変換処理を実行（テスト用ヘルパーを使用）
        const result = await convertFileForTest(
          inputFile,
          'pbf-zip',
          { minZoom: 0, maxZoom: 5, layerName: 'test-layer' }
        );

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();

        if (!result.success || !result.data) {
          throw new Error(result.error || 'Conversion failed');
        }

        // 3. PBF構造検証（MapLibre GL JS互換性）
        if (result.data instanceof ArrayBuffer) {
          // Debug: Check tiles.json content
          try {
            const JSZip = (await import('jszip')).default;
            const zip = await JSZip.loadAsync(result.data);
            const tilesJsonFile = zip.file('tiles.json');
            if (tilesJsonFile) {
              const tilesJsonContent = await tilesJsonFile.async('string');
              const tilesJson = JSON.parse(tilesJsonContent);
            }
          } catch (e) {
            // Error reading tiles.json
          }
          
          const pbfCheck = await validatePBFForMapLibre(result.data);
          expect(pbfCheck.valid).toBe(true);
        } else {
          throw new Error('PBF output must be ArrayBuffer');
        }
      }, 30000);
    });
  });
});

