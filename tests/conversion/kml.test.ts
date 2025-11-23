/**
 * KML conversion tests
 */

import { describe, it, expect } from 'vitest';
import { convertFileForTest } from '../utils/converter-test-helper';
import { readInputFile, readInputFileAsString } from '../utils/test-helpers';
import { validateDataIntegrity } from '../utils/data-validator';
import type { OutputFormat } from '../../src/utils/converter';

describe('KML Conversion', () => {
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

      it(`should convert ${geometry} KML to ${format}`, async () => {
        // 1. 入力ファイルを読み込む
        const inputFile = await readInputFile(geometry, `${geometry}s.kml`);
        
        // KMLをGeoJSONに変換して比較用のデータを取得
        const inputGeoJSON = await readInputFileAsString(geometry, `${geometry}s.geojson`);

        // 2. 変換処理を実行（テスト用ヘルパーを使用）
        const result = await convertFileForTest(
          inputFile,
          format,
          format === 'pbf-zip'
            ? { minZoom: 0, maxZoom: 5, layerName: 'test-layer' }
            : undefined
        );

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();

        if (!result.success || !result.data) {
          throw new Error(result.error || 'Conversion failed');
        }

        // 3. データ整合性チェック
        // 元のGeoJSONと比較（KMLは元々GeoJSONから作成されている想定）
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
      }, 30000);
    });
  });
});

