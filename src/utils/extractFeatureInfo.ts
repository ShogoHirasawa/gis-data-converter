/**
 * Feature information extraction utility
 * Extracts feature count and available properties from converted files
 */

import { ConversionResult, UploadedFile, FeatureInfo } from '../types';
import { kmlToGeoJSON } from './conversions/kml';
import { csvToGeoJSON } from './conversions/csv';

export type { FeatureInfo };

/**
 * Parse GeoJSON string and extract feature information
 */
function parseGeoJSON(geojsonText: string): FeatureInfo {
  try {
    const geojson = JSON.parse(geojsonText);
    
    // Get features array
    let features: GeoJSON.Feature[] = [];
    if (geojson.type === 'FeatureCollection' && Array.isArray(geojson.features)) {
      features = geojson.features;
    } else if (geojson.type === 'Feature') {
      features = [geojson];
    } else {
      throw new Error('Invalid GeoJSON format');
    }
    
    // Get feature count
    const featureCount = features.length;
    
    // Collect all unique property names
    const propertySet = new Set<string>();
    features.forEach((feature: GeoJSON.Feature) => {
      if (feature.properties && typeof feature.properties === 'object') {
        Object.keys(feature.properties).forEach(key => {
          if (key && typeof key === 'string') {
            propertySet.add(key);
          }
        });
      }
    });
    
    // Sort properties alphabetically
    const properties = Array.from(propertySet).sort();
    
    return {
      featureCount,
      properties,
    };
  } catch (error) {
    throw new Error(
      `Failed to parse GeoJSON: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Extract feature information from conversion result
 */
export async function extractFeatureInfo(
  result: ConversionResult,
  uploadedFile: UploadedFile | null
): Promise<FeatureInfo> {
  try {
    // For PBF, use cachedGeoJSON if available (all input formats now have it)
    if (result.format === 'pbf') {
      if (uploadedFile?.cachedGeoJSON) {
        return parseGeoJSON(uploadedFile.cachedGeoJSON);
      }
      // If cachedGeoJSON is not available, throw error
      throw new Error('Cannot extract feature info from PBF without cached GeoJSON');
    }
    
    // For other formats, extract from blob
    if (!result.blob) {
      throw new Error('Conversion result blob is not available');
    }
    
    switch (result.format) {
      case 'geojson': {
        const text = await result.blob.text();
        return parseGeoJSON(text);
      }
      
      case 'kml': {
        const kmlText = await result.blob.text();
        const geojson = kmlToGeoJSON(kmlText);
        return parseGeoJSON(geojson);
      }
      
      case 'csv': {
        const csvText = await result.blob.text();
        const geojson = await csvToGeoJSON(csvText);
        return parseGeoJSON(geojson);
      }
      
      default:
        throw new Error(`Unsupported format for feature extraction: ${result.format}`);
    }
  } catch (error) {
    throw new Error(
      `Failed to extract feature info: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

