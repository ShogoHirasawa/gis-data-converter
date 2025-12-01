export type ConversionState = 
  | 'upload' 
  | 'analyzing'
  | 'format-detection' 
  | 'converting' 
  | 'completed' 
  | 'style-editor'
  | 'error' 
  | 'upload-error';

export type FileFormat = 'shapefile' | 'geojson' | 'kml' | 'csv' | 'gpx' | 'pbf';

export type GeometryType = 'point' | 'line' | 'polygon' | 'mixed' | 'unknown';

export interface UploadedFile {
  file: File;
  format: FileFormat | null;
  size: number;
  name: string;
  geometryType?: GeometryType;
  cachedGeoJSON?: string; // Cached GeoJSON from geometry type detection
}

export interface ConversionFormat {
  id: FileFormat;
  name: string;
  description: string;
  icon: string;
  recommended?: boolean;
}

export interface ConversionResult {
  fileName: string;
  format: FileFormat;
  size: number;
  blob: Blob | null;
}

// Style Editor types
export type ColorMode = 'categorical' | 'continuous';

export interface CategoricalCategory {
  value: string;
  color: string;
  label: string;
}

export interface ContinuousStyle {
  minValue: number;
  maxValue: number;
  gradientColors: string[];
}

export interface StyleConfig {
  property: string;
  mode: ColorMode;
  categorical?: {
    categories: CategoricalCategory[];
  };
  continuous?: ContinuousStyle;
}

