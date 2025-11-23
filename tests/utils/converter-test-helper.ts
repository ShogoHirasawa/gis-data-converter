/**
 * Test helper for conversion
 * Bypasses WebWorker and calls conversion logic directly
 */

import { detectInputFormat } from '../../src/utils/detectFormat';
import { handleConvert, ConvertRequest } from '../../src/workers/convert.worker';
import type { OutputFormat } from '../../src/utils/converter';

/**
 * Convert file directly (without WebWorker) for testing
 */
export async function convertFileForTest(
  file: File,
  outputFormat: OutputFormat,
  pbfOptions?: {
    minZoom: number;
    maxZoom: number;
    layerName: string;
  }
) {
  // Detect input format
  const inputFormat = await detectInputFormat(file);
  
  if (inputFormat === 'unknown') {
    throw new Error('Unable to detect file format');
  }

  // Read file as ArrayBuffer
  const buffer = await file.arrayBuffer();

  // Prepare request
  const request: ConvertRequest = {
    inputFormat,
    outputFormat,
    file: buffer,
    pbfOptions: outputFormat === 'pbf-zip' ? pbfOptions : undefined,
  };

  // Call conversion handler directly
  return await handleConvert(request);
}

