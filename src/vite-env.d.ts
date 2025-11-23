/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GA_MEASUREMENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Type declarations for libraries without types
declare module 'csv2geojson' {
  export function csv2geojson(
    csv: string,
    callback: (err: Error | null, data: any) => void
  ): void;
}

declare module 'tokml' {
  export default function tokml(
    geojson: any,
    options?: { name?: string; description?: string }
  ): string;
}

declare module 'togpx' {
  export default function togpx(geojson: any): string;
}

declare module 'shapefile' {
  export interface Source {
    bbox?: [number, number, number, number];
    read(): Promise<IteratorResult<any, any>>;
  }

  export function open(
    shp: ArrayBuffer | Uint8Array,
    shx?: ArrayBuffer | Uint8Array,
    dbf?: ArrayBuffer | Uint8Array
  ): Promise<Source>;
}

declare module 'shpjs' {
  export default function shpjs(
    buffer: ArrayBuffer | Uint8Array | DataView | Buffer
  ): Promise<GeoJSON.FeatureCollection | GeoJSON.FeatureCollection[]>;
}

declare module 'shp-write' {
  export interface WriteOptions {
    types?: {
      point?: string;
      polygon?: string;
      line?: string;
    };
  }

  export interface ShpWriteResult {
    shp?: ArrayBuffer;
    shx?: ArrayBuffer;
    dbf?: ArrayBuffer;
    prj?: string;
  }

  function write(
    geojson: any,
    options?: WriteOptions
  ): ShpWriteResult;

  function zip(
    geojson: any,
    options?: WriteOptions
  ): any;

  export default write;
  export { zip };
}

declare module 'papaparse' {
  export interface ParseResult<T> {
    data: T[];
    errors: Array<{ type: string; code: string; message: string; row?: number }>;
    meta: {
      delimiter: string;
      linebreak: string;
      aborted: boolean;
      truncated: boolean;
      cursor: number;
    };
  }

  export function parse<T = any>(
    input: string,
    config?: {
      header?: boolean;
      skipEmptyLines?: boolean;
      delimiter?: string;
      newline?: string;
    }
  ): ParseResult<T>;

  export function unparse(data: any[], config?: {
    delimiter?: string;
    newline?: string;
  }): string;
}

declare module '@tmcw/togeojson' {
  export const toGeoJSON: {
    kml: (doc: Document) => any;
    gpx: (doc: Document) => any;
  };
}

// Worker type definition for Vite
declare module '*?worker' {
  const WorkerConstructor: {
    new (): Worker;
  };
  export default WorkerConstructor;
}
