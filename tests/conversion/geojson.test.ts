/**
 * GeoJSON conversion tests
 */

import { describe, it, expect } from 'vitest';
import { convertFileForTest } from '../utils/converter-test-helper';
import { readInputFile, readInputFileAsString } from '../utils/test-helpers';
import { validateDataIntegrity } from '../utils/data-validator';
import { validateGeoJSONForMapLibre } from '../utils/mapbox-validator';
import type { OutputFormat } from '../../src/utils/converter';

describe('GeoJSON Conversion', () => {
  const geometries = ['point', 'line', 'polygon'] as const;
  const outputFormats: Array<{ format: OutputFormat; skipFor?: string[] }> = [
    { format: 'geojson' },
    { format: 'kml' },
    { format: 'csv', skipFor: ['line', 'polygon'] }, // CSVは点のみ
    { format: 'shapefile' },
    { format: 'pbf-zip' },
  ];

  geometries.forEach((geometry) => {
    outputFormats.forEach(({ format, skipFor }) => {
      if (skipFor?.includes(geometry)) {
        return; // スキップ
      }

      it(`should convert ${geometry} GeoJSON to ${format}`, async () => {
        // 1. 入力ファイルを読み込む
        const inputFile = await readInputFile(geometry, `${geometry}s.geojson`);
        const inputGeoJSON = await readInputFileAsString(geometry, `${geometry}s.geojson`);

        // 2. 変換処理を実行（テスト用ヘルパーを使用）
        const result = await convertFileForTest(
          inputFile,
          format,
          format === 'pbf-zip'
            ? { minZoom: 0, maxZoom: 5, layerName: 'test-layer' }
            : undefined
        );

        if (!result.success) {
          console.error(`Conversion failed for ${geometry} GeoJSON to ${format}:`, result.error);
          throw new Error(result.error || 'Conversion failed');
        }
        
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();

        // 3. データ整合性チェック（重要！）
        // PBFは直接GeoJSONに変換できないためスキップ
        if (format !== 'pbf-zip') {
          const integrityCheck = await validateDataIntegrity(
            inputGeoJSON,
            result.data,
            format
          );
          
          if (!integrityCheck.valid) {
            console.error('Data integrity errors:', integrityCheck.errors);
          }
          expect(integrityCheck.valid).toBe(true);
        }

        // 4. MapLibre GL JS検証
        // 出力をGeoJSONに変換して検証（可能な場合）
        if (format === 'geojson') {
          const mapboxCheck = await validateGeoJSONForMapLibre(result.data);
          expect(mapboxCheck.valid).toBe(true);
          if (!mapboxCheck.valid) {
            console.error('MapLibre GL JS validation errors:', mapboxCheck.errors);
          }
        }
      }, 30000); // タイムアウト30秒
    });
  });
});

