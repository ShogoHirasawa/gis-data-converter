/**
 * DBF file character encoding detection and conversion utilities
 */

import JSZip from "jszip";
// @ts-ignore - iconv-lite has no type definitions
import iconv from "iconv-lite";
// @ts-ignore - buffer polyfill
import { Buffer } from "buffer";

/**
 * Normalize encoding name to iconv-lite compatible format
 */
function normalizeEncoding(encoding: string): string {
  const normalized = encoding.trim().toUpperCase();
  
  // Map common encoding names to iconv-lite format
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
 * Read encoding from .cpg file
 */
export async function readEncodingFromCpg(
  zip: JSZip,
  baseName: string
): Promise<string | null> {
  const cpgFileName = `${baseName}.cpg`;
  const cpgFile = zip.file(cpgFileName);
  
  if (!cpgFile) {
    return null;
  }
  
  try {
    const cpgContent = await cpgFile.async('string');
    const encoding = normalizeEncoding(cpgContent);
    return encoding;
  } catch (error) {
    console.warn(`Failed to read .cpg file: ${error}`);
    return null;
  }
}

/**
 * Check if a byte sequence follows UTF-8 encoding rules
 * UTF-8 encoding rules:
 * - 1-byte: 0xxxxxxx (0x00-0x7F)
 * - 2-byte: 110xxxxx 10xxxxxx (0xC0-0xDF, 0x80-0xBF)
 * - 3-byte: 1110xxxx 10xxxxxx 10xxxxxx (0xE0-0xEF, 0x80-0xBF, 0x80-0xBF)
 * - 4-byte: 11110xxx 10xxxxxx 10xxxxxx 10xxxxxx (0xF0-0xF7, 0x80-0xBF, 0x80-0xBF, 0x80-0xBF)
 */
function isValidUtf8(bytes: Uint8Array): boolean {
  let i = 0;
  let validSequences = 0;
  let invalidSequences = 0;
  
  while (i < bytes.length) {
    const byte = bytes[i];
    
    // 1-byte character (ASCII)
    if (byte <= 0x7F) {
      validSequences++;
      i++;
      continue;
    }
    
    // 2-byte character: 110xxxxx 10xxxxxx
    if ((byte & 0xE0) === 0xC0) {
      if (i + 1 >= bytes.length) {
        invalidSequences++;
        break;
      }
      const byte2 = bytes[i + 1];
      if ((byte2 & 0xC0) === 0x80) {
        validSequences++;
        i += 2;
        continue;
      } else {
        invalidSequences++;
        i++;
        continue;
      }
    }
    
    // 3-byte character: 1110xxxx 10xxxxxx 10xxxxxx
    if ((byte & 0xF0) === 0xE0) {
      if (i + 2 >= bytes.length) {
        invalidSequences++;
        break;
      }
      const byte2 = bytes[i + 1];
      const byte3 = bytes[i + 2];
      if ((byte2 & 0xC0) === 0x80 && (byte3 & 0xC0) === 0x80) {
        validSequences++;
        i += 3;
        continue;
      } else {
        invalidSequences++;
        i++;
        continue;
      }
    }
    
    // 4-byte character: 11110xxx 10xxxxxx 10xxxxxx 10xxxxxx
    if ((byte & 0xF8) === 0xF0) {
      if (i + 3 >= bytes.length) {
        invalidSequences++;
        break;
      }
      const byte2 = bytes[i + 1];
      const byte3 = bytes[i + 2];
      const byte4 = bytes[i + 3];
      if (
        (byte2 & 0xC0) === 0x80 &&
        (byte3 & 0xC0) === 0x80 &&
        (byte4 & 0xC0) === 0x80
      ) {
        validSequences++;
        i += 4;
        continue;
      } else {
        invalidSequences++;
        i++;
        continue;
      }
    }
    
    // Invalid UTF-8 start byte
    invalidSequences++;
    i++;
  }
  
  // If we have valid sequences and few or no invalid sequences, consider it UTF-8
  // We need at least some valid multi-byte sequences to confidently say it's UTF-8
  // (pure ASCII could be any encoding, but we'll treat it as UTF-8 compatible)
  if (invalidSequences === 0) {
    return true;
  }
  
  // If we have more invalid sequences than valid multi-byte sequences, it's not UTF-8
  // Count multi-byte sequences (valid sequences that are not single-byte)
  const asciiBytes = bytes.filter(b => b <= 0x7F).length;
  const multiByteSequences = validSequences - asciiBytes;
  
  // If we have invalid sequences and few multi-byte sequences, it's likely not UTF-8
  if (invalidSequences > 0 && multiByteSequences < invalidSequences) {
    return false;
  }
  
  // If we have many invalid sequences relative to valid ones, it's not UTF-8
  if (invalidSequences > validSequences / 10) {
    return false;
  }
  
  return true;
}

/**
 * Extract string field data from DBF records for UTF-8 validation
 * Also includes field names from header for validation
 * Returns a sample of string field data (including field names)
 */
function extractStringFieldData(dbfBuffer: ArrayBuffer): Uint8Array {
  const uint8Array = new Uint8Array(dbfBuffer);
  const view = new DataView(dbfBuffer);
  
  if (dbfBuffer.byteLength < 32) {
    console.log(`[DBF Encoding] extractStringFieldData: DBF file too small (${dbfBuffer.byteLength} bytes)`);
    return new Uint8Array(0);
  }
  
  const headerLength = view.getUint16(8, true);
  const recordLength = view.getUint16(10, true);
  const numRecords = view.getUint32(4, true);
  
  console.log(`[DBF Encoding] extractStringFieldData: headerLength=${headerLength}, recordLength=${recordLength}, numRecords=${numRecords}`);
  
  const sampleData: number[] = [];
  
  // Find string/memo fields (type 'C' or 'M')
  const stringFields: Array<{ offset: number; length: number }> = [];
  let fieldOffset = 1; // First byte is delete flag
  let pos = 32;
  let totalFields = 0;
  
  while (pos < headerLength - 1) {
    if (pos + 32 > headerLength) {
      console.log(`[DBF Encoding] extractStringFieldData: Reached header end at pos ${pos}`);
      break;
    }
    
    // Check for field descriptor terminator (0x0D)
    if (uint8Array[pos] === 0x0D) {
      console.log(`[DBF Encoding] extractStringFieldData: Found terminator at pos ${pos}`);
      break;
    }
    
    const fieldType = String.fromCharCode(uint8Array[pos + 11]);
    const fieldLength = uint8Array[pos + 16];
    totalFields++;
    
    // Get field name bytes (bytes 0-10, null-terminated)
    const nameBytes = uint8Array.slice(pos, pos + 11);
    const nameEnd = nameBytes.indexOf(0);
    const actualNameBytes = nameBytes.slice(0, nameEnd >= 0 ? nameEnd : 11);
    
    // Add field name bytes to sample (excluding null bytes and trailing spaces)
    // Field names are encoded, so we can use them for UTF-8 validation
    for (let i = 0; i < actualNameBytes.length; i++) {
      const byte = actualNameBytes[i];
      // Exclude null bytes and spaces, but include all other bytes
      if (byte !== 0x00 && byte !== 0x20) {
        sampleData.push(byte);
      }
    }
    
    // Get field name for debugging
    const fieldName = String.fromCharCode(...actualNameBytes);
    console.log(`[DBF Encoding] extractStringFieldData: Field ${totalFields} at pos ${pos}, name="${fieldName.trim()}", type="${fieldType}", length=${fieldLength}, offset=${fieldOffset}`);
    
    // Check for string (C) or memo (M) fields
    if (fieldType === 'C' || fieldType === 'M') {
      stringFields.push({
        offset: fieldOffset,
        length: fieldLength,
      });
      console.log(`[DBF Encoding] extractStringFieldData: Added string/memo field "${fieldName.trim()}" (type ${fieldType}) at offset ${fieldOffset}, length ${fieldLength}`);
    }
    
    fieldOffset += fieldLength;
    pos += 32;
  }
  
  console.log(`[DBF Encoding] extractStringFieldData: Found ${stringFields.length} string/memo fields out of ${totalFields} total fields`);
  console.log(`[DBF Encoding] extractStringFieldData: Extracted ${sampleData.length} bytes from field names`);
  
  // Extract data from string/memo fields in records (up to 8KB)
  const maxRecordDataSize = 8192; // Maximum size for record data (excluding field names)
  let recordDataSize = 0; // Track size of record data added
  
  if (stringFields.length > 0) {
    const maxRecords = Math.min(numRecords, Math.floor(maxRecordDataSize / recordLength) + 1);
    
    console.log(`[DBF Encoding] extractStringFieldData: Extracting from up to ${maxRecords} records (max ${maxRecordDataSize} bytes)`);
    
    let recordPos = headerLength;
    let recordsProcessed = 0;
    for (let i = 0; i < maxRecords && recordPos < dbfBuffer.byteLength; i++) {
      const recordEnd = recordPos + recordLength;
      if (recordEnd > dbfBuffer.byteLength) {
        console.log(`[DBF Encoding] extractStringFieldData: Record ${i} extends beyond buffer (recordEnd=${recordEnd}, bufferLength=${dbfBuffer.byteLength})`);
        break;
      }
      
      for (const field of stringFields) {
        // Check if we've reached the 8KB limit for record data
        if (recordDataSize >= maxRecordDataSize) {
          console.log(`[DBF Encoding] extractStringFieldData: Reached max record data size (${maxRecordDataSize} bytes)`);
          break;
        }
        
        const fieldStart = recordPos + field.offset;
        const fieldEnd = fieldStart + field.length;
        
        if (fieldEnd > dbfBuffer.byteLength) {
          console.log(`[DBF Encoding] extractStringFieldData: Field at offset ${field.offset} extends beyond buffer`);
          break;
        }
        
        // Extract field bytes
        const fieldBytes = uint8Array.slice(fieldStart, fieldEnd);
        
        // Remove trailing spaces (0x20) and null bytes (0x00)
        let endIdx = fieldBytes.length;
        while (endIdx > 0 && (fieldBytes[endIdx - 1] === 0x20 || fieldBytes[endIdx - 1] === 0x00)) {
          endIdx--;
        }
        
        if (endIdx > 0) {
          const fieldData = Array.from(fieldBytes.slice(0, endIdx));
          const fieldDataSize = fieldData.length;
          
          // Check if adding this field would exceed the 8KB limit for record data
          if (recordDataSize + fieldDataSize > maxRecordDataSize) {
            // Add only what fits
            const remaining = maxRecordDataSize - recordDataSize;
            if (remaining > 0) {
              sampleData.push(...fieldData.slice(0, remaining));
              recordDataSize += remaining;
            }
            console.log(`[DBF Encoding] extractStringFieldData: Reached max record data size (${maxRecordDataSize} bytes)`);
            break;
          }
          
          sampleData.push(...fieldData);
          recordDataSize += fieldDataSize;
          
          if (i === 0) {
            // Log first record's data for debugging
            const firstBytes = fieldData.slice(0, Math.min(20, fieldData.length));
            console.log(`[DBF Encoding] extractStringFieldData: Record ${i}, field at offset ${field.offset}: extracted ${fieldDataSize} bytes, first bytes: [${firstBytes.map(b => '0x' + b.toString(16).padStart(2, '0')).join(', ')}]`);
          }
        }
      }
      
      recordsProcessed++;
      recordPos += recordLength;
      
      // Stop if we've reached the limit
      if (recordDataSize >= maxRecordDataSize) {
        break;
      }
    }
    
    console.log(`[DBF Encoding] extractStringFieldData: Processed ${recordsProcessed} records, extracted ${recordDataSize} bytes from records`);
  } else {
    console.log(`[DBF Encoding] extractStringFieldData: No string/memo fields found, but field names were extracted`);
  }
  
  console.log(`[DBF Encoding] extractStringFieldData: Extracted ${sampleData.length} bytes total (${sampleData.length - recordDataSize} bytes from field names, ${recordDataSize} bytes from records)`);
  
  return new Uint8Array(sampleData);
}

/**
 * Auto-detect encoding from .dbf file
 * - If .cpg file exists, use it (handled in convertShapefileEncoding)
 * - If no .cpg file, check if data is valid UTF-8
 * - If valid UTF-8, use UTF-8
 * - If not UTF-8, assume Shift-JIS (CP932)
 * 
 * Uses field names (all fields) and string/memo field data (type 'C' or 'M') for validation
 */
export function detectEncodingFromDbf(dbfBuffer: ArrayBuffer): string {
  // Extract string field data from records and field names (including header field names)
  const stringData = extractStringFieldData(dbfBuffer);
  
  if (stringData.length === 0) {
    // No string fields or no data, default to UTF-8
    console.log(`[DBF Encoding] No string data found, defaulting to UTF-8`);
    return 'UTF-8';
  }
  
  // Check if the data is valid UTF-8
  const isUtf8 = isValidUtf8(stringData);
  
  if (isUtf8) {
    console.log(`[DBF Encoding] Byte sequence validation: UTF-8`);
    return 'UTF-8';
  } else {
    console.log(`[DBF Encoding] Byte sequence validation: Not UTF-8, assuming Shift-JIS (CP932)`);
    return 'CP932';
  }
}

/**
 * Convert DBF file string fields from source encoding to UTF-8
 * Also converts field names in header
 * DBF file structure:
 * - Header (32 bytes + field descriptors)
 * - Records (each record starts with delete flag, then field data)
 * 
 * We need to convert string/memo fields (type 'C' or 'M') and field names
 */
export function convertDbfEncoding(
  dbfBuffer: ArrayBuffer,
  sourceEncoding: string,
  targetEncoding: string = 'UTF-8'
): ArrayBuffer {
  if (sourceEncoding.toUpperCase() === targetEncoding.toUpperCase()) {
    // No conversion needed
    return dbfBuffer;
  }
  
  try {
    const uint8Array = new Uint8Array(dbfBuffer);
    const view = new DataView(dbfBuffer);
    
    // Read DBF header
    if (dbfBuffer.byteLength < 32) {
      throw new Error('DBF file too small');
    }
    
    // DBF header structure:
    // Byte 0: DBF version
    // Bytes 1-3: Date of last update (YY, MM, DD)
    // Bytes 4-7: Number of records (little-endian)
    // Bytes 8-9: Length of header (little-endian)
    // Bytes 10-11: Length of each record (little-endian)
    // Bytes 12-31: Reserved
    
    const headerLength = view.getUint16(8, true); // little-endian
    const recordLength = view.getUint16(10, true); // little-endian
    const numRecords = view.getUint32(4, true); // little-endian
    
    // Read field descriptors (start at byte 32)
    const fieldDescriptors: Array<{
      name: string;
      type: string;
      offset: number;
      length: number;
    }> = [];
    
    let fieldOffset = 1; // First byte is delete flag
    let pos = 32;
    
    while (pos < headerLength - 1) {
      // Field descriptor is 32 bytes
      if (pos + 32 > headerLength) break;
      
      // Check for field descriptor terminator (0x0D)
      if (uint8Array[pos] === 0x0D) break;
      
      // Field type (byte 11)
      const fieldType = String.fromCharCode(uint8Array[pos + 11]);
      
      // Field length (byte 16)
      const fieldLength = uint8Array[pos + 16];
      
      // Field decimal (byte 17) - not used for strings
      
      // Check for string (C) or memo (M) fields
      if (fieldType === 'C' || fieldType === 'M') {
        // Character/Memo field - needs encoding conversion
        fieldDescriptors.push({
          name: '', // Not used for conversion
          type: fieldType,
          offset: fieldOffset,
          length: fieldLength,
        });
      }
      
      fieldOffset += fieldLength;
      pos += 32;
    }
    
    // Create new buffer for converted data
    const convertedBuffer = new ArrayBuffer(dbfBuffer.byteLength);
    const convertedView = new Uint8Array(convertedBuffer);
    
    // Copy header and convert field names
    convertedView.set(uint8Array.slice(0, headerLength), 0);
    
    // Convert field names in header
    pos = 32;
    while (pos < headerLength - 1) {
      if (pos + 32 > headerLength) break;
      if (uint8Array[pos] === 0x0D) break;
      
      // Store original field descriptor bytes 11-31 before conversion
      // to ensure we don't accidentally overwrite them
      const originalFieldType = uint8Array[pos + 11];
      const originalFieldLength = uint8Array[pos + 16];
      const originalFieldDecimal = uint8Array[pos + 17];
      const originalBytes11to31 = uint8Array.slice(pos + 11, pos + 32);
      
      // Explicitly copy the entire field descriptor first to ensure all parts are preserved
      // This includes: field name (0-10), field type (11), field length (16), etc.
      // This is a safety measure to ensure field descriptor bytes 11-31 are not corrupted
      const fieldDescriptorBytes = uint8Array.slice(pos, pos + 32);
      convertedView.set(fieldDescriptorBytes, pos);
      
      // Now, only modify the field name part (first 11 bytes)
      const nameBytes = uint8Array.slice(pos, pos + 11);
      const nameEnd = nameBytes.indexOf(0);
      const actualNameBytes = nameBytes.slice(0, nameEnd >= 0 ? nameEnd : 11);
      
      try {
        const nameBuffer = Buffer.from(actualNameBytes);
        const decodedName = iconv.decode(nameBuffer, sourceEncoding);
        const encodedName = iconv.encode(decodedName, targetEncoding);
        
        // Safely copy converted name byte by byte (only first 11 bytes)
        // Directly access encodedName bytes to avoid buffer issues
        // This ensures we don't overwrite field descriptor parts (byte 11+)
        // Field descriptor structure:
        // Bytes 0-10: Field name (null-terminated)
        // Byte 11: Field type
        // Bytes 12-15: Field data address (not used in modern DBF)
        // Byte 16: Field length
        // Byte 17: Field decimal places
        // Bytes 18-31: Reserved
        for (let i = 0; i < 11; i++) {
          if (i < encodedName.length) {
            convertedView[pos + i] = encodedName[i];
          } else {
            // Pad with null bytes if converted name is shorter
            convertedView[pos + i] = 0x00;
          }
        }
        
        // Verify that field descriptor bytes 11-31 are still intact
        const convertedFieldType = convertedView[pos + 11];
        const convertedFieldLength = convertedView[pos + 16];
        const convertedFieldDecimal = convertedView[pos + 17];
        
        if (convertedFieldType !== originalFieldType || 
            convertedFieldLength !== originalFieldLength || 
            convertedFieldDecimal !== originalFieldDecimal) {
          console.error(`[DBF Encoding] Field descriptor corruption detected at pos ${pos}!`);
          console.error(`  Original: type=${String.fromCharCode(originalFieldType)}, length=${originalFieldLength}, decimal=${originalFieldDecimal}`);
          console.error(`  Converted: type=${String.fromCharCode(convertedFieldType)}, length=${convertedFieldLength}, decimal=${convertedFieldDecimal}`);
          // Restore original bytes 11-31
          convertedView.set(originalBytes11to31, pos + 11);
        }
      } catch (error) {
        console.warn(`Failed to convert field name at pos ${pos}: ${error}`);
        // Keep original field name if conversion fails (already copied above)
        // But ensure field descriptor bytes 11-31 are preserved
        convertedView.set(originalBytes11to31, pos + 11);
      }
      
      pos += 32;
    }
    
    if (fieldDescriptors.length === 0) {
      // No string/memo fields to convert, but field names were converted
      console.log(`[DBF Encoding] No string/memo fields found, but field names were converted`);
      return convertedBuffer;
    }
    
    console.log(`[DBF Encoding] Found ${fieldDescriptors.length} string/memo fields to convert`);
    
    // Convert each record
    let recordPos = headerLength;
    for (let i = 0; i < numRecords && recordPos < dbfBuffer.byteLength; i++) {
      const recordEnd = recordPos + recordLength;
      if (recordEnd > dbfBuffer.byteLength) break;
      
      // First, copy entire record as-is
      convertedView.set(
        uint8Array.slice(recordPos, recordEnd),
        recordPos
      );
      
      // Then, convert string fields
      for (const field of fieldDescriptors) {
        const fieldStart = recordPos + field.offset;
        const fieldEnd = fieldStart + field.length;
        
        if (fieldEnd > dbfBuffer.byteLength) break;
        
        // Extract field bytes from original buffer
        const fieldBytes = uint8Array.slice(fieldStart, fieldEnd);
        
        // Convert encoding
        try {
          // Convert Uint8Array to Buffer for iconv-lite
          const fieldBuffer = Buffer.from(fieldBytes);
          
          // Decode from source encoding
          const decoded = iconv.decode(fieldBuffer, sourceEncoding);
          // Encode to target encoding
          const encoded = iconv.encode(decoded, targetEncoding);
          
          // Copy converted bytes (pad or truncate if needed)
          const copyLength = Math.min(encoded.length, field.length);
          const encodedArray = new Uint8Array(encoded.buffer, encoded.byteOffset, copyLength);
          convertedView.set(encodedArray, fieldStart);
          
          // Pad with spaces if converted string is shorter
          if (copyLength < field.length) {
            for (let j = copyLength; j < field.length; j++) {
              convertedView[fieldStart + j] = 0x20; // Space
            }
          }
        } catch (error) {
          // If conversion fails, keep original bytes (already copied above)
          console.warn(`Failed to convert field at offset ${field.offset}: ${error}`);
        }
      }
      
      recordPos += recordLength;
    }
    
    // Copy any remaining data (EOF marker, etc.)
    if (recordPos < dbfBuffer.byteLength) {
      convertedView.set(uint8Array.slice(recordPos), recordPos);
    }
    
    return convertedBuffer;
  } catch (error) {
    console.error(`Failed to convert DBF encoding: ${error}`);
    // Return original buffer on error
    return dbfBuffer;
  }
}

/**
 * Get base name from shapefile (without extension)
 */
export function getShapefileBaseName(zip: JSZip): string | null {
  const fileNames = Object.keys(zip.files);
  
  // Find .shp file
  const shpFile = fileNames.find(name => name.toLowerCase().endsWith('.shp'));
  if (!shpFile) {
    return null;
  }
  
  // Extract base name (remove .shp extension)
  const baseName = shpFile.replace(/\.shp$/i, '');
  return baseName;
}

/**
 * Process shapefile ZIP: detect and convert .dbf encoding to UTF-8
 */
export async function convertShapefileEncoding(
  zipBuffer: ArrayBuffer
): Promise<ArrayBuffer> {
  try {
    const zip = await JSZip.loadAsync(zipBuffer);
    const baseName = getShapefileBaseName(zip);
    
    if (!baseName) {
      throw new Error('Could not find .shp file in ZIP');
    }
    
    // Find .dbf file
    const dbfFileName = `${baseName}.dbf`;
    const dbfFile = zip.file(dbfFileName);
    
    if (!dbfFile) {
      // No .dbf file, return original ZIP
      return zipBuffer;
    }
    
    // Try to read encoding from .cpg file
    let encoding = await readEncodingFromCpg(zip, baseName);
    console.log(`[DBF Encoding] .cpg file encoding: ${encoding || 'not found'}`);
    
    // If no .cpg file, try auto-detection
    if (!encoding) {
      const dbfBuffer = await dbfFile.async('arraybuffer');
      encoding = detectEncodingFromDbf(dbfBuffer);
      console.log(`[DBF Encoding] Auto-detected encoding: ${encoding}`);
    }
    
    // If encoding is already UTF-8, no conversion needed
    if (encoding.toUpperCase() === 'UTF-8') {
      console.log(`[DBF Encoding] Already UTF-8, skipping conversion`);
      return zipBuffer;
    }
    
    // Convert .dbf file
    const dbfBuffer = await dbfFile.async('arraybuffer');
    console.log(`[DBF Encoding] Converting from ${encoding} to UTF-8`);
    const convertedDbfBuffer = convertDbfEncoding(dbfBuffer, encoding, 'UTF-8');
    
    // Update .dbf file in ZIP
    zip.file(dbfFileName, convertedDbfBuffer);
    
    // Create .cpg file with UTF-8 encoding (for future reference)
    zip.file(`${baseName}.cpg`, 'UTF-8');
    
    // Generate new ZIP
    const newZipBuffer = await zip.generateAsync({ type: 'arraybuffer' });
    
    return newZipBuffer;
  } catch (error) {
    console.error(`Failed to convert shapefile encoding: ${error}`);
    // Return original buffer on error
    return zipBuffer;
  }
}

