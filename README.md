# GIS Data Converter

A web-based tool for converting GIS data formats in your browser. All processing happens locally - No need a server for prosessing.

## Features

- **Multiple Format Support**: Convert between Shapefile, GeoJSON, KML, CSV, GPX, and PBF
- **Point Data CSV Conversion**: CSV conversion is available only for point geometries
- **Browser-Based**: All processing happens in your browser - no server uploads
- **Multi-Language**: Supports 25 languages
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **PBF Vector Tiles**: Generate efficient PBF(directory type) tiles using WebAssembly

## Supported Formats

### Input Formats
- **Shapefile** (.zip) - Upload as a ZIP file containing .shp, .shx, .dbf files
- **GeoJSON** (.geojson, .json)
- **KML** (.kml)
- **CSV** (.csv) - Must contain latitude/longitude columns
- **GPX** (.gpx)

### Output Formats
- **GeoJSON** - Ideal for web applications and GIS software
- **KML** - Best for Google Earth
- **CSV** - Only available for point data
- **Shapefile** (.zip) - Only available when input is Shapefile
- **PBF** - Vector tiles for efficient map rendering

## Getting Started

### Prerequisites

- Node.js 20 or higher
- npm

### Installation

```bash
npm install
```

### Development

Start the development server:

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

### Build

Build for production:

```bash
npm run build
```

Built files will be in the `dist` directory.

### Build WASM Module

To rebuild the WebAssembly module for PBF conversion:

```bash
npm run build:wasm
```

Or build everything:

```bash
npm run build:all
```

### Testing

Run E2E tests:

```bash
npm run test:e2e
```

Run tests with UI:

```bash
npm run test:e2e:ui
```

## Project Structure

```
src/
├── components/          # React components
│   ├── Header.tsx       # Header with language selector
│   ├── Footer.tsx       # Footer with navigation
│   ├── MainContent.tsx  # Main content with state management
│   └── states/          # State components
│       ├── UploadState.tsx
│       ├── FormatDetectionState.tsx
│       ├── ConvertingState.tsx
│       ├── CompletedState.tsx
│       └── ErrorState.tsx
├── workers/             # Web Workers
│   └── convert.worker.ts # File conversion worker
├── utils/               # Utility functions
│   ├── conversions/     # Format conversion modules
│   ├── converter.ts     # Conversion orchestration
│   └── detectFormat.ts  # Format detection
├── i18n/                # Internationalization
│   ├── translations.ts  # Translation data (25 languages)
│   └── LanguageContext.tsx
└── wasm/                # WebAssembly module for PBF
```

## How It Works

1. **Upload**: Drag and drop or select a GIS file (max 50MB)
2. **Detect**: The tool automatically detects the file format
3. **Convert**: Select your desired output format and start conversion
4. **Download**: Download the converted file

All processing happens in your browser using Web Workers and WebAssembly. Your data is never sent to external servers.

## Analytics

The hosted web app can use Google Analytics (GA4). By default (no env set), analytics is disabled.

## Dev Plan
- Allow acceptance of Shp files in formats other than zip
- Automatically estimate recommended vector tile zoom levels
- Display during data conversion (spinner and estimated time in seconds)
- Preview display when importing data
- Preview function for created data. When vector tiles are created, it allows you to check how they will appear at each zoom level. The following message should appear: "This tile does not exist at the current zoom level (data exists only at Z5 to Z10)."
- Enable conversion of GTFS/GBFS to GeoJSON
- Compatible with PMTiles
- Automatically detect the coordinate system and perform conversion
- When input data is large, it recommens using vector tiles as the output format

## Limitations

- Maximum file size: 50MB
- CSV conversion only supports point geometries
- Shapefile must be uploaded as a ZIP file
- Some complex data structures may not be fully supported

## License

MIT LICENCE
