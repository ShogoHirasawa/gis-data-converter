import React from 'react';
import { ConversionState, UploadedFile, ConversionResult } from '../types';
import UploadState from './states/UploadState';
import AnalyzingState from './states/AnalyzingState';
import FormatDetectionState from './states/FormatDetectionState';
import ConvertingState from './states/ConvertingState';
import CompletedState from './states/CompletedState';
import StyleEditorState from './states/StyleEditorState';
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
  onStyleEditor?: () => void;
  onBackToFormatSelection?: () => void;
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
  onStyleEditor,
  onBackToFormatSelection,
}) => {
  return (
    <main className="flex-1 overflow-x-hidden flex flex-col px-8 py-12">
      {state === 'upload' && (
        <UploadState onFileUpload={onFileUpload} />
      )}
      {state === 'analyzing' && (
        <AnalyzingState uploadedFile={uploadedFile} />
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
          onReset={onReset}
          onStyleEditor={onStyleEditor}
        />
      )}
      {state === 'style-editor' && conversionResult && uploadedFile && (
        <StyleEditorState
          result={conversionResult}
          uploadedFile={uploadedFile}
          onBack={onBackToFormatSelection || onReset}
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

