/**
 * DBF file character encoding detection and conversion utilities
 */

import JSZip from "jszip";
// @ts-ignore - iconv-lite has no type definitions
import iconv from "iconv-lite";
// @ts-ignore - buffer polyfill
import { Buffer } from "buffer";
import { normalizeEncodingForIconv } from "./conversions/encodingUtils";

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
    const encoding = normalizeEncodingForIconv(cpgContent);
    return encoding;
  } catch (error) {
    return null;
  }
}

function isValidUtf8(bytes: Uint8Array): boolean {
  let i = 0;
  let validSequences = 0;
  let invalidSequences = 0;
  
  while (i < bytes.length) {
    const byte = bytes[i];
    
    if (byte <= 0x7F) {
      validSequences++;
      i++;
      continue;
    }
    
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
    
    invalidSequences++;
    i++;
  }
  
  if (invalidSequences === 0) {
    return true;
  }
  
  const asciiBytes = bytes.filter(b => b <= 0x7F).length;
  const multiByteSequences = validSequences - asciiBytes;
  
  if (invalidSequences > 0 && multiByteSequences < invalidSequences) {
    return false;
  }
  
  if (invalidSequences > validSequences / 10) {
    return false;
  }
  
  return true;
}

function extractStringFieldData(dbfBuffer: ArrayBuffer): Uint8Array {
  const uint8Array = new Uint8Array(dbfBuffer);
  const view = new DataView(dbfBuffer);
  
  if (dbfBuffer.byteLength < 32) {
    return new Uint8Array(0);
  }
  
  const headerLength = view.getUint16(8, true);
  const recordLength = view.getUint16(10, true);
  const numRecords = view.getUint32(4, true);
  
  const sampleData: number[] = [];
  const stringFields: Array<{ offset: number; length: number }> = [];
  let fieldOffset = 1;
  let pos = 32;
  
  while (pos < headerLength - 1) {
    if (pos + 32 > headerLength) {
      break;
    }
    
    if (uint8Array[pos] === 0x0D) {
      break;
    }
    
    const fieldType = String.fromCharCode(uint8Array[pos + 11]);
    const fieldLength = uint8Array[pos + 16];
    
    const nameBytes = uint8Array.slice(pos, pos + 11);
    const nameEnd = nameBytes.indexOf(0);
    const actualNameBytes = nameBytes.slice(0, nameEnd >= 0 ? nameEnd : 11);
    
    for (let i = 0; i < actualNameBytes.length; i++) {
      const byte = actualNameBytes[i];
      if (byte !== 0x00 && byte !== 0x20) {
        sampleData.push(byte);
      }
    }
    
    if (fieldType === 'C' || fieldType === 'M') {
      stringFields.push({
        offset: fieldOffset,
        length: fieldLength,
      });
    }
    
    fieldOffset += fieldLength;
    pos += 32;
  }
  
  const maxRecordDataSize = 8192;
  let recordDataSize = 0;
  
  if (stringFields.length > 0) {
    const maxRecords = Math.min(numRecords, Math.floor(maxRecordDataSize / recordLength) + 1);
    let recordPos = headerLength;
    
    for (let i = 0; i < maxRecords && recordPos < dbfBuffer.byteLength; i++) {
      const recordEnd = recordPos + recordLength;
      if (recordEnd > dbfBuffer.byteLength) {
        break;
      }
      
      for (const field of stringFields) {
        if (recordDataSize >= maxRecordDataSize) {
          break;
        }
        
        const fieldStart = recordPos + field.offset;
        const fieldEnd = fieldStart + field.length;
        
        if (fieldEnd > dbfBuffer.byteLength) {
          break;
        }
        
        const fieldBytes = uint8Array.slice(fieldStart, fieldEnd);
        let endIdx = fieldBytes.length;
        while (endIdx > 0 && (fieldBytes[endIdx - 1] === 0x20 || fieldBytes[endIdx - 1] === 0x00)) {
          endIdx--;
        }
        
        if (endIdx > 0) {
          const fieldData = Array.from(fieldBytes.slice(0, endIdx));
          const fieldDataSize = fieldData.length;
          
          if (recordDataSize + fieldDataSize > maxRecordDataSize) {
            const remaining = maxRecordDataSize - recordDataSize;
            if (remaining > 0) {
              sampleData.push(...fieldData.slice(0, remaining));
              recordDataSize += remaining;
            }
            break;
          }
          
          sampleData.push(...fieldData);
          recordDataSize += fieldDataSize;
        }
      }
      
      recordPos += recordLength;
      
      if (recordDataSize >= maxRecordDataSize) {
        break;
      }
    }
  }
  
  return new Uint8Array(sampleData);
}

export function detectEncodingFromDbf(dbfBuffer: ArrayBuffer): string {
  const stringData = extractStringFieldData(dbfBuffer);
  
  if (stringData.length === 0) {
    return 'UTF-8';
  }
  
  const isUtf8 = isValidUtf8(stringData);
  
  if (isUtf8) {
    return 'UTF-8';
  } else {
    return 'CP932';
  }
}

export function convertDbfEncoding(
  dbfBuffer: ArrayBuffer,
  sourceEncoding: string,
  targetEncoding: string = 'UTF-8'
): ArrayBuffer {
  if (sourceEncoding.toUpperCase() === targetEncoding.toUpperCase()) {
    return dbfBuffer;
  }
  
  try {
    const uint8Array = new Uint8Array(dbfBuffer);
    const view = new DataView(dbfBuffer);
    
    if (dbfBuffer.byteLength < 32) {
      throw new Error('DBF file too small');
    }
    
    const headerLength = view.getUint16(8, true);
    const recordLength = view.getUint16(10, true);
    const numRecords = view.getUint32(4, true);
    
    const fieldDescriptors: Array<{
      name: string;
      type: string;
      offset: number;
      length: number;
    }> = [];
    
    let fieldOffset = 1;
    let pos = 32;
    
    while (pos < headerLength - 1) {
      if (pos + 32 > headerLength) break;
      if (uint8Array[pos] === 0x0D) break;
      
      const fieldType = String.fromCharCode(uint8Array[pos + 11]);
      const fieldLength = uint8Array[pos + 16];
      
      if (fieldType === 'C' || fieldType === 'M') {
        fieldDescriptors.push({
          name: '',
          type: fieldType,
          offset: fieldOffset,
          length: fieldLength,
        });
      }
      
      fieldOffset += fieldLength;
      pos += 32;
    }
    
    const convertedBuffer = new ArrayBuffer(dbfBuffer.byteLength);
    const convertedView = new Uint8Array(convertedBuffer);
    
    convertedView.set(uint8Array.slice(0, headerLength), 0);
    
    pos = 32;
    while (pos < headerLength - 1) {
      if (pos + 32 > headerLength) break;
      if (uint8Array[pos] === 0x0D) break;
      
      const originalFieldType = uint8Array[pos + 11];
      const originalFieldLength = uint8Array[pos + 16];
      const originalFieldDecimal = uint8Array[pos + 17];
      const originalBytes11to31 = uint8Array.slice(pos + 11, pos + 32);
      
      const fieldDescriptorBytes = uint8Array.slice(pos, pos + 32);
      convertedView.set(fieldDescriptorBytes, pos);
      
      const nameBytes = uint8Array.slice(pos, pos + 11);
      const nameEnd = nameBytes.indexOf(0);
      const actualNameBytes = nameBytes.slice(0, nameEnd >= 0 ? nameEnd : 11);
      
      try {
        const nameBuffer = Buffer.from(actualNameBytes);
        const decodedName = iconv.decode(nameBuffer, sourceEncoding);
        const encodedName = iconv.encode(decodedName, targetEncoding);
        
        for (let i = 0; i < 11; i++) {
          if (i < encodedName.length) {
            convertedView[pos + i] = encodedName[i];
          } else {
            convertedView[pos + i] = 0x00;
          }
        }
        
        const convertedFieldType = convertedView[pos + 11];
        const convertedFieldLength = convertedView[pos + 16];
        const convertedFieldDecimal = convertedView[pos + 17];
        
        if (convertedFieldType !== originalFieldType || 
            convertedFieldLength !== originalFieldLength || 
            convertedFieldDecimal !== originalFieldDecimal) {
          convertedView.set(originalBytes11to31, pos + 11);
        }
      } catch (error) {
        convertedView.set(originalBytes11to31, pos + 11);
      }
      
      pos += 32;
    }
    
    if (fieldDescriptors.length === 0) {
      return convertedBuffer;
    }
    
    let recordPos = headerLength;
    for (let i = 0; i < numRecords && recordPos < dbfBuffer.byteLength; i++) {
      const recordEnd = recordPos + recordLength;
      if (recordEnd > dbfBuffer.byteLength) break;
      
      convertedView.set(
        uint8Array.slice(recordPos, recordEnd),
        recordPos
      );
      
      for (const field of fieldDescriptors) {
        const fieldStart = recordPos + field.offset;
        const fieldEnd = fieldStart + field.length;
        
        if (fieldEnd > dbfBuffer.byteLength) break;
        
        const fieldBytes = uint8Array.slice(fieldStart, fieldEnd);
        
        try {
          const fieldBuffer = Buffer.from(fieldBytes);
          const decoded = iconv.decode(fieldBuffer, sourceEncoding);
          const encoded = iconv.encode(decoded, targetEncoding);
          
          const copyLength = Math.min(encoded.length, field.length);
          const encodedArray = new Uint8Array(encoded.buffer, encoded.byteOffset, copyLength);
          convertedView.set(encodedArray, fieldStart);
          
          if (copyLength < field.length) {
            for (let j = copyLength; j < field.length; j++) {
              convertedView[fieldStart + j] = 0x20;
            }
          }
        } catch (error) {
          // Keep original bytes
        }
      }
      
      recordPos += recordLength;
    }
    
    if (recordPos < dbfBuffer.byteLength) {
      convertedView.set(uint8Array.slice(recordPos), recordPos);
    }
    
    return convertedBuffer;
  } catch (error) {
    return dbfBuffer;
  }
}

export function getShapefileBaseName(zip: JSZip): string | null {
  const fileNames = Object.keys(zip.files);
  const shpFile = fileNames.find(name => name.toLowerCase().endsWith('.shp'));
  if (!shpFile) {
    return null;
  }
  return shpFile.replace(/\.shp$/i, '');
}

export async function convertShapefileEncoding(
  zipBuffer: ArrayBuffer
): Promise<ArrayBuffer> {
  try {
    const zip = await JSZip.loadAsync(zipBuffer);
    const baseName = getShapefileBaseName(zip);
    
    if (!baseName) {
      throw new Error('Could not find .shp file in ZIP');
    }
    
    const dbfFileName = `${baseName}.dbf`;
    const dbfFile = zip.file(dbfFileName);
    
    if (!dbfFile) {
      return zipBuffer;
    }
    
    let encoding = await readEncodingFromCpg(zip, baseName);
    
    if (!encoding) {
      const dbfBuffer = await dbfFile.async('arraybuffer');
      encoding = detectEncodingFromDbf(dbfBuffer);
    }
    
    if (encoding.toUpperCase() === 'UTF-8') {
      return zipBuffer;
    }
    
    const dbfBuffer = await dbfFile.async('arraybuffer');
    const convertedDbfBuffer = convertDbfEncoding(dbfBuffer, encoding, 'UTF-8');
    
    zip.file(dbfFileName, convertedDbfBuffer);
    zip.file(`${baseName}.cpg`, 'UTF-8');
    
    const newZipBuffer = await zip.generateAsync({ type: 'arraybuffer' });
    
    return newZipBuffer;
  } catch (error) {
    return zipBuffer;
  }
}

