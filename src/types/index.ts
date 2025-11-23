export type ConversionState = 
  | 'upload' 
  | 'format-detection' 
  | 'converting' 
  | 'completed' 
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

