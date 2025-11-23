import { useState, useEffect } from 'react';
import { LanguageProvider } from './i18n/LanguageContext';
import Header from './components/Header';
import MainContent from './components/MainContent';
import Footer from './components/Footer';
import HowToUsePage from './components/pages/HowToUsePage';
import SupportedFormatsPage from './components/pages/SupportedFormatsPage';
import PbfOptionsDialog, { PbfOptions } from './components/PbfOptionsDialog';
import { ConversionState, UploadedFile, ConversionResult } from './types';
import { detectInputFormat } from './utils/detectFormat';
import { convertFile, getOutputFilename, getOutputMimeType, OutputFormat } from './utils/converter';
import './App.css';

type PageType = null | 'how-to-use' | 'supported-formats';

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
    // Check file size (50MB limit)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      setState('upload-error');
      return;
    }

    // Detect file format using detection utility
    try {
      const format = await detectInputFormat(file);
      
      const uploaded: UploadedFile = {
        file,
        format: format === 'unknown' ? null : format,
        size: file.size,
        name: file.name,
      };

      setUploadedFile(uploaded);
      
      if (format !== 'unknown') {
        setState('format-detection');
      } else {
        setState('upload-error');
      }
    } catch (error) {
      console.error('Format detection error:', error);
      setState('upload-error');
    }
  };

  const handleFormatSelect = (formatId: string) => {
    // If PBF format, show options dialog first
    if (formatId === 'pbf') {
      setPendingFormatId(formatId);
      setPbfOptionsDialogOpen(true);
      return;
    }

    // For other formats, start conversion immediately
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
      // Map formatId to OutputFormat
      // Note: GPX is supported as input but not as output
      const outputFormatMap: Record<string, OutputFormat> = {
        'geojson': 'geojson',
        'shapefile': 'shapefile',
        'kml': 'kml',
        'pbf': 'pbf-zip',
        'csv': 'csv',
      };

      const outputFormat = outputFormatMap[formatId] || 'geojson';

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 5;
        });
      }, 200);

      // Convert file using WebWorker
      const response = await convertFile(
        uploadedFile.file,
        outputFormat,
        pbfOptions
      );

      clearInterval(progressInterval);
      setProgress(100);

      if (response.success && response.data) {
        // Create Blob from response data
        let blob: Blob;
        if (response.data instanceof ArrayBuffer) {
          blob = new Blob([response.data], { 
            type: response.mimeType || getOutputMimeType(outputFormat) 
          });
        } else {
          // String data (e.g., KML, GPX, GeoJSON)
          blob = new Blob([response.data], { 
            type: response.mimeType || getOutputMimeType(outputFormat) 
          });
        }

        const result: ConversionResult = {
          fileName: response.filename || getOutputFilename(uploadedFile.name, outputFormat),
          format: formatId as any,
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
      console.error('Conversion error:', error);
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
    // Scroll to top on page change
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Scroll to top when page changes
  useEffect(() => {
    if (currentPage !== null) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentPage]);

  const handleDownload = () => {
    if (conversionResult && conversionResult.blob) {
      const url = URL.createObjectURL(conversionResult.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = conversionResult.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

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
            onDownload={handleDownload}
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

