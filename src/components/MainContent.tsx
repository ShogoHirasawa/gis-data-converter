import React from 'react';
import { ConversionState, UploadedFile, ConversionResult } from '../types';
import UploadState from './states/UploadState';
import AnalyzingState from './states/AnalyzingState';
import FormatDetectionState from './states/FormatDetectionState';
import ConvertingState from './states/ConvertingState';
import CompletedState from './states/CompletedState';
import ErrorState from './states/ErrorState';
import UploadErrorState from './states/UploadErrorState';

interface MainContentProps {
  state: ConversionState;
  uploadedFile: UploadedFile | null;
  selectedFormat: string | null;
  conversionResult: ConversionResult | null;
  progress: number;
  onFileUpload: (file: File) => void;
  onFormatSelect: (formatId: string) => void;
  onReset: () => void;
  onDownload: () => void;
}

const MainContent: React.FC<MainContentProps> = ({
  state,
  uploadedFile,
  selectedFormat: _selectedFormat,
  conversionResult,
  progress,
  onFileUpload,
  onFormatSelect,
  onReset,
  onDownload,
}) => {
  return (
    <main className="flex-1 overflow-x-hidden flex flex-col px-8 py-12">
      {state === 'upload' && (
        <UploadState onFileUpload={onFileUpload} />
      )}
      {state === 'analyzing' && uploadedFile && (
        <AnalyzingState fileName={uploadedFile.name} />
      )}
      {state === 'format-detection' && uploadedFile && (
        <FormatDetectionState
          uploadedFile={uploadedFile}
          onFormatSelect={onFormatSelect}
          onBack={onReset}
        />
      )}
      {state === 'converting' && (
        <ConvertingState progress={progress} />
      )}
      {state === 'completed' && conversionResult && (
        <CompletedState
          result={conversionResult}
          onDownload={onDownload}
          onReset={onReset}
        />
      )}
      {state === 'error' && (
        <ErrorState onReset={onReset} />
      )}
      {state === 'upload-error' && (
        <UploadErrorState onReset={onReset} onFileUpload={onFileUpload} />
      )}
    </main>
  );
};

export default MainContent;

