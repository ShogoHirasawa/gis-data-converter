/**
 * Converter utility
 * Main interface for file format conversion using WebWorker
 */

import { detectInputFormat } from './detectFormat';
import { 
  ConvertRequest, 
  ConvertResponse, 
  OutputFormat as WorkerOutputFormat 
} from '../workers/convert.worker';
import ConvertWorker from '../workers/convert.worker.ts?worker';

// Re-export OutputFormat for convenience
export type OutputFormat = WorkerOutputFormat;

/**
 * Create a WebWorker instance for conversion
 */
function createWorker(): Worker {
  // Use Vite's worker import with ?worker query parameter
  // This ensures the worker is properly bundled and served with correct MIME type
  return new ConvertWorker();
}

/**
 * Convert file format using WebWorker
 */
export async function convertFile(
  file: File,
  outputFormat: WorkerOutputFormat,
  pbfOptions?: {
    minZoom: number;
    maxZoom: number;
    layerName: string;
  },
  cachedGeoJSON?: string
): Promise<ConvertResponse> {
  return new Promise((resolve, reject) => {
    // Detect input format
    detectInputFormat(file)
      .then((inputFormat) => {
        if (inputFormat === 'unknown') {
          reject(new Error('Unable to detect file format'));
          return;
        }

        // Create worker
        const worker = createWorker();

        // Read file as ArrayBuffer
        file.arrayBuffer()
          .then((buffer) => {
            // Prepare request
            const request: ConvertRequest = {
              inputFormat,
              outputFormat,
              file: buffer,
              cachedGeoJSON,
              pbfOptions: outputFormat === 'pbf-zip' ? pbfOptions : undefined,
            };

            // Handle worker messages
            worker.onmessage = (event: MessageEvent<ConvertResponse>) => {
              const response = event.data;
              worker.terminate();
              
              if (response.success) {
                resolve(response);
              } else {
                reject(new Error(response.error || 'Conversion failed'));
              }
            };

            worker.onerror = (error) => {
              worker.terminate();
              reject(error);
            };

            // Send conversion request
            worker.postMessage(request);
          })
          .catch((error) => {
            worker.terminate();
            reject(error);
          });
      })
      .catch((error) => {
        reject(error);
      });
  });
}

/**
 * Get recommended filename for output format
 */
export function getOutputFilename(
  inputFilename: string,
  outputFormat: WorkerOutputFormat
): string {
  const baseName = inputFilename.replace(/\.[^/.]+$/, '');

  switch (outputFormat) {
    case 'geojson':
      return `${baseName}.geojson`;
    case 'shapefile':
      return `${baseName}.zip`;
    case 'kml':
      return `${baseName}.kml`;
    case 'pbf-zip':
      return 'tiles_pbf.zip';
    case 'csv':
      return `${baseName}.csv`;
    default:
      return `${baseName}.${outputFormat}`;
  }
}

/**
 * Get MIME type for output format
 */
export function getOutputMimeType(outputFormat: WorkerOutputFormat): string {
  switch (outputFormat) {
    case 'geojson':
      return 'application/geo+json';
    case 'shapefile':
      return 'application/zip';
    case 'kml':
      return 'application/vnd.google-earth.kml+xml';
    case 'pbf-zip':
      return 'application/zip';
    case 'csv':
      return 'text/csv';
    default:
      return 'application/octet-stream';
  }
}

