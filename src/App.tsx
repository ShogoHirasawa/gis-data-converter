import { useState, useEffect } from 'react';
import { LanguageProvider } from './i18n/LanguageContext';
import Header from './components/Header';
import MainContent from './components/MainContent';
import Footer from './components/Footer';
import HowToUsePage from './components/pages/HowToUsePage';
import SupportedFormatsPage from './components/pages/SupportedFormatsPage';
import { ConversionState, UploadedFile, ConversionResult } from './types';
import './App.css';

type PageType = null | 'how-to-use' | 'supported-formats';

function App() {
  const [state, setState] = useState<ConversionState>('upload');
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [conversionResult, setConversionResult] = useState<ConversionResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState<PageType>(null);

  const handleFileUpload = (file: File) => {
    // Check file size (50MB limit)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      setState('upload-error');
      return;
    }

    // Auto-detect file format
    const fileName = file.name.toLowerCase();
    let format: UploadedFile['format'] = null;
    
    if (fileName.endsWith('.zip')) {
      format = 'shapefile';
    } else if (fileName.endsWith('.geojson') || fileName.endsWith('.json')) {
      format = 'geojson';
    } else if (fileName.endsWith('.kml')) {
      format = 'kml';
    } else if (fileName.endsWith('.csv')) {
      format = 'csv';
    } else if (fileName.endsWith('.gpx')) {
      format = 'gpx';
    }

    const uploaded: UploadedFile = {
      file,
      format,
      size: file.size,
      name: file.name,
    };

    setUploadedFile(uploaded);
    
    if (format) {
      setState('format-detection');
    } else {
      setState('upload-error');
    }
  };

  const handleFormatSelect = (formatId: string) => {
    setSelectedFormat(formatId);
    setState('converting');
    setProgress(0);

    // Progress bar animation
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          // Conversion complete
          setTimeout(() => {
            const result: ConversionResult = {
              fileName: uploadedFile?.name.replace(/\.[^/.]+$/, '') + '.' + formatId,
              format: formatId as any,
              size: uploadedFile?.size || 0,
              blob: null,
            };
            setConversionResult(result);
            setState('completed');
          }, 300);
          return 100;
        }
        return prev + 2;
      });
    }, 50);
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
    if (conversionResult) {
      const blob = new Blob(['Mock converted data'], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = conversionResult.fileName;
      a.click();
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
      </div>
    </LanguageProvider>
  );
}

export default App;

