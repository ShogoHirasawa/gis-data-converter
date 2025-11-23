import React from 'react';
import { Loader2 } from 'lucide-react';

interface AnalyzingStateProps {
  fileName: string;
}

const AnalyzingState: React.FC<AnalyzingStateProps> = ({ fileName }) => {

  return (
    <div className="w-full max-w-2xl mx-auto text-center">
      <div
        className="p-16 rounded-[32px] shadow-gentle"
        style={{ backgroundColor: '#FFFFFF' }}
      >
        <div
          className="flex justify-center items-center w-20 h-20 mb-8 rounded-full mx-auto"
          style={{ backgroundColor: '#E8F3E4' }}
        >
          <Loader2 
            size={32}
            className="animate-spin"
            style={{ color: '#7FAD6F' }}
          />
        </div>
        <h2
          className="text-2xl mb-4 font-semibold"
          style={{ color: '#2A3A28' }}
        >
          Analyzing file...
        </h2>
        <p
          className="text-base mb-4"
          style={{ color: '#5A6A58' }}
        >
          {fileName}
        </p>
        <p
          className="text-sm"
          style={{ color: '#8A9A88' }}
        >
          Detecting geometry type and preparing conversion options...
        </p>
      </div>
    </div>
  );
};

export default AnalyzingState;

