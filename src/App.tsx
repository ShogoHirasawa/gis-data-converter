import { useState, useEffect } from 'react';
import { LanguageProvider } from './i18n/LanguageContext';
import Header from './components/Header';
import MainContent from './components/MainContent';
import Footer from './components/Footer';
import HowToUsePage from './components/pages/HowToUsePage';
import SupportedFormatsPage from './components/pages/SupportedFormatsPage';
import ContactPage from './components/pages/ContactPage';
import PbfOptionsDialog, { PbfOptions } from './components/PbfOptionsDialog';
import { ConversionState, UploadedFile, ConversionResult } from './types';
import { detectInputFormat } from './utils/detectFormat';
import { detectGeometryType } from './utils/detectGeometryType';
import { convertFile, getOutputFilename, getOutputMimeType, OutputFormat } from './utils/converter';
import { initGA } from './utils/analytics';
import './App.css';

type PageType = null | 'how-to-use' | 'supported-formats' | 'contact';

function App() {
  const [state, setState] = useState<ConversionState>('upload');
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [conversionResult, setConversionResult] = useState<ConversionResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState<PageType>(null);
  const [pbfOptionsDialogOpen, setPbfOptionsDialogOpen] = useState(false);
  const [pendingFormatId, setPendingFormatId] = useState<string | null>(null);

  const handleFileUpload = async (file: File) => {
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      setState('upload-error');
      return;
    }

    try {
      const format = await detectInputFormat(file);
      
      if (format === 'unknown') {
        setState('upload-error');
        return;
      }

      // Show analyzing state for formats that require conversion (Shapefile, KML)
      // This provides user feedback during geometry type detection
      const needsAnalysis = format === 'shapefile' || format === 'kml';
      if (needsAnalysis) {
        setUploadedFile({
          file,
          format,
          size: file.size,
          name: file.name,
        });
        setState('analyzing');
      }
      
      // Detect geometry type if format is known
      let geometryType: UploadedFile['geometryType'] = undefined;
      let cachedGeoJSON: UploadedFile['cachedGeoJSON'] = undefined;
      try {
        const detectionResult = await detectGeometryType(file, format);
        geometryType = detectionResult.geometryType;
        cachedGeoJSON = detectionResult.cachedGeoJSON;
      } catch (error) {
        console.warn('Failed to detect geometry type:', error);
        // Continue without geometry type if detection fails
      }
      
      const uploaded: UploadedFile = {
        file,
        format,
        size: file.size,
        name: file.name,
        geometryType,
        cachedGeoJSON,
      };

      setUploadedFile(uploaded);
      setState('format-detection');
    } catch (error) {
      setState('upload-error');
    }
  };

  const handleFormatSelect = (formatId: string) => {
    if (formatId === 'pbf') {
      setPendingFormatId(formatId);
      setPbfOptionsDialogOpen(true);
      return;
    }

    startConversion(formatId);
  };

  const handlePbfOptionsConfirm = (options: PbfOptions) => {
    setPbfOptionsDialogOpen(false);
    if (pendingFormatId) {
      startConversion(pendingFormatId, options);
      setPendingFormatId(null);
    }
  };

  const handlePbfOptionsCancel = () => {
    setPbfOptionsDialogOpen(false);
    setPendingFormatId(null);
  };

  const startConversion = async (formatId: string, pbfOptions?: PbfOptions) => {
    if (!uploadedFile) return;

    setSelectedFormat(formatId);
    setState('converting');
    setProgress(0);

    try {
      const outputFormatMap: Record<string, OutputFormat> = {
        'geojson': 'geojson',
        'shapefile': 'shapefile',
        'kml': 'kml',
        'pbf': 'pbf-zip',
        'csv': 'csv',
      };

      const outputFormat = outputFormatMap[formatId] || 'geojson';

      let progressInterval: ReturnType<typeof setInterval> | null = null;
      
      try {
        progressInterval = setInterval(() => {
          setProgress((prev) => {
            if (prev >= 90) {
              if (progressInterval) {
                clearInterval(progressInterval);
              }
              return 90;
            }
            return prev + 5;
          });
        }, 200);

        const response = await convertFile(
          uploadedFile.file,
          outputFormat,
          pbfOptions,
          uploadedFile.cachedGeoJSON
        );

        if (progressInterval) {
          clearInterval(progressInterval);
        }
        setProgress(100);

        if (response.success && response.data) {
          let blob: Blob;
          if (response.data instanceof ArrayBuffer) {
            blob = new Blob([response.data], { 
              type: response.mimeType || getOutputMimeType(outputFormat) 
            });
          } else {
            blob = new Blob([response.data], { 
              type: response.mimeType || getOutputMimeType(outputFormat) 
            });
          }

          const result: ConversionResult = {
            fileName: response.filename || getOutputFilename(uploadedFile.name, outputFormat),
            format: formatId as ConversionResult['format'],
            size: blob.size,
            blob,
          };

          setTimeout(() => {
            setConversionResult(result);
            setState('completed');
          }, 300);
        } else {
          throw new Error(response.error || 'Conversion failed');
        }
      } catch (error) {
        if (progressInterval) {
          clearInterval(progressInterval);
        }
        setProgress(0);
        setState('error');
      }
    } catch (error) {
      setProgress(0);
      setState('error');
    }
  };

  const handleReset = () => {
    setState('upload');
    setUploadedFile(null);
    setSelectedFormat(null);
    setConversionResult(null);
    setProgress(0);
    setCurrentPage(null);
  };

  const handlePageChange = (page: PageType) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    initGA();
  }, []);

  useEffect(() => {
    if (currentPage !== null) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentPage]);

  // Auto-download when conversion is completed
  useEffect(() => {
    if (state === 'completed' && conversionResult && conversionResult.blob) {
      const url = URL.createObjectURL(conversionResult.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = conversionResult.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }, [state, conversionResult]);

  return (
    <LanguageProvider>
      <div className="min-h-screen flex flex-col" style={{
        background: 'radial-gradient(ellipse at 15% 20%, rgba(210, 230, 205, 0.15) 0%, transparent 50%), radial-gradient(ellipse at 85% 70%, rgba(235, 220, 205, 0.12) 0%, transparent 50%), #FEFEFE'
      }}>
        <Header onHomeClick={handleReset} />
        {currentPage === 'how-to-use' && (
          <HowToUsePage onBack={() => setCurrentPage(null)} />
        )}
        {currentPage === 'supported-formats' && (
          <SupportedFormatsPage onBack={() => setCurrentPage(null)} />
        )}
        {currentPage === 'contact' && (
          <ContactPage onBack={() => setCurrentPage(null)} />
        )}
        {currentPage === null && (
          <MainContent
            state={state}
            uploadedFile={uploadedFile}
            selectedFormat={selectedFormat}
            conversionResult={conversionResult}
            progress={progress}
            onFileUpload={handleFileUpload}
            onFormatSelect={handleFormatSelect}
            onReset={handleReset}
          />
        )}
        <Footer onPageChange={handlePageChange} />
        <PbfOptionsDialog
          isOpen={pbfOptionsDialogOpen}
          onConfirm={handlePbfOptionsConfirm}
          onCancel={handlePbfOptionsCancel}
        />
      </div>
    </LanguageProvider>
  );
}

export default App;

