import React, { useRef, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { CloudUpload, FolderOpen, Chromium, Heart, ShieldCheck } from 'lucide-react';

interface UploadStateProps {
  onFileUpload: (file: File) => void;
}

const UploadState: React.FC<UploadStateProps> = ({ onFileUpload }) => {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      onFileUpload(file);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="text-center mb-16">
        <h1
          className="text-3xl mb-4 font-semibold"
          style={{ color: '#2A3A28' }}
        >
          {t.heading}
        </h1>
        <p
          className="text-lg max-w-2xl mx-auto"
          style={{ color: '#5A6A58' }}
        >
          {t.subheading}
        </p>
      </div>

      <div className="mb-16">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`text-center p-16 border-2 border-dashed rounded-[32px] transition ${
            isDragging ? 'border-[#7FAD6F] bg-[#F8FAF7]' : ''
          }`}
          style={{
            backgroundColor: '#FFFFFF',
            boxShadow: '0 2px 12px rgba(127, 173, 111, 0.08)',
            borderColor: isDragging ? '#7FAD6F' : '#C8D8C5',
          }}
        >
          <div className="flex flex-col items-center gap-6">
            <div
              className="flex justify-center items-center w-16 h-16 rounded-full"
              style={{ backgroundColor: '#E8F3E4' }}
            >
              <CloudUpload 
                size={32}
                style={{ color: '#7FAD6F' }}
              />
            </div>
            <div>
              <p
                className="text-xl mb-3 font-semibold"
                style={{ color: '#2A3A28' }}
              >
                {t.dropTitle}
              </p>
              <p
                className="text-base mb-3"
                style={{ color: '#5A6A58' }}
              >
                {t.dropOr}
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleClick();
                }}
                className="flex items-center gap-3 rounded-full mx-auto shadow-gentle hover:bg-[#6B9A5B] transition"
                style={{
                  backgroundColor: '#7FAD6F',
                  color: 'rgba(255, 255, 255, 0.9)',
                  padding: '1rem 2rem',
                }}
              >
                <div className="flex justify-center items-center w-5 h-5">
                  <FolderOpen size={20} />
                </div>
                <span className="text-base whitespace-nowrap font-semibold">
                  {t.selectFiles}
                </span>
              </button>
            </div>
            <div className="text-sm" style={{ color: '#8A9A88' }}>
              <p>{t.supportedFormats}</p>
              <p>{t.maxSize}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="text-center">
          <div
            className="flex justify-center items-center w-12 h-12 mb-4 rounded-full mx-auto"
            style={{ backgroundColor: '#E8F3E4' }}
          >
            <Chromium 
              size={24}
              style={{ color: '#7FAD6F' }}
            />
          </div>
          <h3
            className="text-lg mb-3 font-semibold"
            style={{ color: '#2A3A28' }}
          >
            {t.feature1Title}
          </h3>
          <p
            className="text-base"
            style={{ color: '#5A6A58' }}
          >
            {t.feature1Text}
          </p>
        </div>

        <div className="text-center">
          <div
            className="flex justify-center items-center w-12 h-12 mb-4 rounded-full mx-auto"
            style={{ backgroundColor: '#E8F3E4' }}
          >
            <Heart 
              size={24}
              style={{ color: '#7FAD6F' }}
            />
          </div>
          <h3
            className="text-lg mb-3 font-semibold"
            style={{ color: '#2A3A28' }}
          >
            {t.feature2Title}
          </h3>
          <p
            className="text-base"
            style={{ color: '#5A6A58' }}
          >
            {t.feature2Text}
          </p>
        </div>

        <div className="text-center">
          <div
            className="flex justify-center items-center w-12 h-12 mb-4 rounded-full mx-auto"
            style={{ backgroundColor: '#E8F3E4' }}
          >
            <ShieldCheck 
              size={24}
              style={{ color: '#7FAD6F' }}
            />
          </div>
          <h3
            className="text-lg mb-3 font-semibold"
            style={{ color: '#2A3A28' }}
          >
            {t.feature3Title}
          </h3>
          <p
            className="text-base"
            style={{ color: '#5A6A58' }}
          >
            {t.feature3Text}
          </p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".zip,.geojson,.json,.kml,.csv,.gpx"
        onChange={handleFileSelect}
        className="hidden"
        aria-label="File input"
      />
    </div>
  );
};

export default UploadState;

