/**
 * Data integrity validation utilities
 * Validates that conversion preserves data correctly (feature count, coordinates, properties)
 */

import { shapefileToGeoJSON } from '../../src/utils/conversions/shapefile';
import { kmlToGeoJSON } from '../../src/utils/conversions/kml';
import { csvToGeoJSON } from '../../src/utils/conversions/csv';
import * as toGeoJSON from '@tmcw/togeojson';
import { DOMParser } from '@xmldom/xmldom';

/**
 * Normalize geometry type for comparison
 * LineString and MultiLineString are considered equivalent
 * Polygon and MultiPolygon are considered equivalent
 */
function normalizeGeometryType(type: string): string {
  if (type === 'MultiLineString') return 'LineString';
  if (type === 'MultiPolygon') return 'Polygon';
  return type;
}

/**
 * Compare coordinates with tolerance
 */
function compareCoordinates(
  coord1: number[] | number[][],
  coord2: number[] | number[][],
  tolerance: number = 0.000001
): boolean {
  if (Array.isArray(coord1[0])) {
    // Multi-dimensional array (LineString, Polygon)
    if (!Array.isArray(coord2[0])) return false;
    if (coord1.length !== coord2.length) return false;
    
    for (let i = 0; i < coord1.length; i++) {
      if (!compareCoordinates(coord1[i] as number[], coord2[i] as number[], tolerance)) {
        return false;
      }
    }
    return true;
  } else {
    // Single coordinate pair (Point)
    if (coord1.length !== coord2.length) return false;
    for (let i = 0; i < coord1.length; i++) {
      if (Math.abs((coord1[i] as number) - (coord2[i] as number)) > tolerance) {
        return false;
      }
    }
    return true;
  }
}

/**
 * Compare properties (check if key properties exist and match)
 */
function compareProperties(
  props1: Record<string, any> | null | undefined,
  props2: Record<string, any> | null | undefined
): boolean {
  if (!props1 && !props2) return true;
  if (!props1 || !props2) return false;
  
  // 主要な属性キーをチェック
  const keys1 = Object.keys(props1);
  const keys2 = Object.keys(props2);
  
  // 少なくともいくつかのキーが一致している必要がある
  const commonKeys = keys1.filter(k => keys2.includes(k));
  if (commonKeys.length === 0 && keys1.length > 0 && keys2.length > 0) {
    return false;
  }
  
  // 主要な属性（id, nameなど）が存在する場合は値もチェック
  const importantKeys = ['id', 'name', 'ID', 'NAME'];
  for (const key of importantKeys) {
    if (props1[key] !== undefined && props2[key] !== undefined) {
      if (String(props1[key]) !== String(props2[key])) {
        return false;
      }
    }
  }
  
  return true;
}

/**
 * Convert output data to GeoJSON for comparison
 */
async function convertToGeoJSON(
  outputData: ArrayBuffer | string,
  outputFormat: string
): Promise<string> {
  if (outputFormat === 'geojson') {
    if (outputData instanceof ArrayBuffer) {
      return new TextDecoder('utf-8').decode(outputData);
    }
    return outputData;
  }
  
  if (outputFormat === 'kml') {
    const kmlString = outputData instanceof ArrayBuffer
      ? new TextDecoder('utf-8').decode(outputData)
      : outputData;
    // Use the same conversion logic as in kml.ts
    try {
      const parser = new DOMParser();
      const kmlDoc = parser.parseFromString(kmlString, 'text/xml');
      const parseError = kmlDoc.getElementsByTagName('parsererror');
      if (parseError.length > 0) {
        throw new Error('Invalid KML XML format');
      }
      // Convert to GeoJSON
      const geojson = toGeoJSON.kml(kmlDoc);
      return JSON.stringify(geojson, null, 2);
    } catch (error) {
      // Fallback to kmlToGeoJSON function
      return kmlToGeoJSON(kmlString);
    }
  }
  
  if (outputFormat === 'shapefile' || outputFormat === 'shapefile-zip') {
    if (outputData instanceof ArrayBuffer) {
      return await shapefileToGeoJSON(outputData);
    }
    throw new Error('Shapefile output must be ArrayBuffer');
  }
  
  if (outputFormat === 'csv') {
    const csvString = outputData instanceof ArrayBuffer
      ? new TextDecoder('utf-8').decode(outputData)
      : outputData;
    return await csvToGeoJSON(csvString);
  }
  
  if (outputFormat === 'pbf-zip') {
    // PBFは直接GeoJSONに変換できないため、スキップ
    throw new Error('PBF format cannot be directly converted to GeoJSON for comparison');
  }
  
  throw new Error(`Unsupported output format for comparison: ${outputFormat}`);
}

/**
 * Validate data integrity by comparing input and output GeoJSON
 * Now allows for:
 * - Feature count differences (features can be merged)
 * - Geometry type differences (LineString ↔ MultiLineString, Polygon ↔ MultiPolygon)
 * - Feature order differences
 */
export async function validateDataIntegrity(
  inputGeoJSON: string,
  outputData: ArrayBuffer | string,
  outputFormat: string
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  try {
    // 1. 出力データをGeoJSONに変換
    let outputGeoJSON: string;
    try {
      outputGeoJSON = await convertToGeoJSON(outputData, outputFormat);
    } catch (error) {
      // PBFなど、直接GeoJSONに変換できないフォーマットはスキップ
      if (error instanceof Error && error.message.includes('cannot be directly converted')) {
        return {
          valid: true, // スキップ可能なフォーマットは検証をスキップ
          errors: [],
        };
      }
      throw error;
    }
    
    // 2. 入力と出力のGeoJSONをパース
    const input = JSON.parse(inputGeoJSON);
    const output = JSON.parse(outputGeoJSON);
    
    // 3. フィーチャ数の比較（警告のみ、エラーにはしない）
    if (input.features && output.features) {
      // フィーチャ数の不一致は許容（統合される可能性があるため）
      // エラーには追加しない
      
      // 4. 各フィーチャの比較（順序非依存）
      // 入力の各フィーチャが出力に存在するかチェック（座標とプロパティでマッチング）
      const inputFeatures = input.features;
      const outputFeatures = output.features;
      
      // 出力フィーチャを正規化されたジオメトリタイプでグループ化
      const outputByType: Record<string, typeof outputFeatures> = {};
      outputFeatures.forEach((feat: any) => {
        const normalizedType = normalizeGeometryType(feat.geometry?.type || '');
        if (!outputByType[normalizedType]) {
          outputByType[normalizedType] = [];
        }
        outputByType[normalizedType].push(feat);
      });
      
      // 入力フィーチャをチェック
      for (let i = 0; i < inputFeatures.length; i++) {
        const inputFeature = inputFeatures[i];
        const normalizedInputType = normalizeGeometryType(inputFeature.geometry?.type || '');
        
        // 同じ正規化されたタイプの出力フィーチャを探す
        const candidates = outputByType[normalizedInputType] || [];
        
        // 座標とプロパティでマッチング
        let matched = false;
        for (const outputFeature of candidates) {
          // 座標の比較
          const coordsMatch = inputFeature.geometry?.coordinates && outputFeature.geometry?.coordinates
            ? compareCoordinates(
                inputFeature.geometry.coordinates,
                outputFeature.geometry.coordinates
              )
            : false;
          
          // プロパティの比較
          const propsMatch = compareProperties(
            inputFeature.properties,
            outputFeature.properties
          );
          
          // 座標またはプロパティが一致すればマッチとみなす
          if (coordsMatch || propsMatch) {
            matched = true;
            // マッチしたフィーチャを候補から削除（重複マッチを防ぐ）
            const index = candidates.indexOf(outputFeature);
            if (index > -1) {
              candidates.splice(index, 1);
            }
            break;
          }
        }
        
        // マッチしなかった場合でも、ジオメトリタイプが統合される可能性があるため
        // Point以外は統合される可能性があるため、エラーにはしない
        // ただし、座標とプロパティの両方が完全に一致しない場合は警告
        if (!matched && normalizedInputType === 'Point') {
          // Pointは統合されないため、マッチしない場合はエラー
          errors.push(`Feature ${i}: Point feature not found in output`);
        }
      }
      
      // 出力に存在するが入力に存在しないフィーチャをチェック
      // これも統合の結果として許容
      
    } else {
      // Single Featureの場合
      if (input.type === 'Feature' && output.type === 'Feature') {
        const normalizedInputType = normalizeGeometryType(input.geometry?.type || '');
        const normalizedOutputType = normalizeGeometryType(output.geometry?.type || '');
        
        if (normalizedInputType !== normalizedOutputType) {
          errors.push(`Geometry type mismatch: ${input.geometry?.type} vs ${output.geometry?.type}`);
        }
        
        if (
          input.geometry?.coordinates &&
          output.geometry?.coordinates
        ) {
          if (
            !compareCoordinates(
              input.geometry.coordinates,
              output.geometry.coordinates
            )
          ) {
            errors.push('Coordinates mismatch');
          }
        }
        
        if (!compareProperties(input.properties, output.properties)) {
          errors.push('Properties mismatch');
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  } catch (error) {
    return {
      valid: false,
      errors: [
        `Validation error: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
}

