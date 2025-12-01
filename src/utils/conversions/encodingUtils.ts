/**
 * Common encoding normalization utilities
 */

/**
 * Normalize encoding name to iconv-lite compatible format
 */
export function normalizeEncodingForIconv(encoding: string): string {
  const normalized = encoding.trim().toUpperCase();
  
  const encodingMap: Record<string, string> = {
    'SHIFT_JIS': 'CP932',
    'SHIFT-JIS': 'CP932',
    'SJIS': 'CP932',
    'WINDOWS-31J': 'CP932',
    'EUC-JP': 'EUC-JP',
    'EUCJP': 'EUC-JP',
    'UTF-8': 'UTF-8',
    'UTF8': 'UTF-8',
    'ISO-8859-1': 'ISO-8859-1',
    'LATIN1': 'ISO-8859-1',
  };
  
  return encodingMap[normalized] || normalized;
}

/**
 * Normalize encoding name to parsedbf compatible format
 */
export function normalizeEncodingForParsedbf(encoding: string): string {
  const normalized = encoding.trim().toUpperCase();
  
  const encodingMap: Record<string, string> = {
    'CP932': 'Shift_JIS',
    'SHIFT_JIS': 'Shift_JIS',
    'SHIFT-JIS': 'Shift_JIS',
    'SJIS': 'Shift_JIS',
    'WINDOWS-31J': 'Shift_JIS',
    'UTF-8': 'UTF-8',
    'UTF8': 'UTF-8',
    'ISO-8859-1': 'ISO-8859-1',
    'LATIN1': 'ISO-8859-1',
  };
  
  return encodingMap[normalized] || normalized;
}

