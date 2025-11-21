export type ConversionState = 
  | 'upload' 
  | 'format-detection' 
  | 'converting' 
  | 'completed' 
  | 'error' 
  | 'upload-error';

export type FileFormat = 'shapefile' | 'geojson' | 'kml' | 'csv' | 'gpx' | 'topojson' | 'pbf';

export interface UploadedFile {
  file: File;
  format: FileFormat | null;
  size: number;
  name: string;
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

