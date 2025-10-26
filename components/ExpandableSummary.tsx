'use client';

import { useState } from 'react';

interface ExpandableSummaryProps {
  shortSummary: string;
  mainSummaryHtml: string;
}

export default function ExpandableSummary({ shortSummary, mainSummaryHtml }: ExpandableSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mb-12">
      <p className={`text-lg leading-relaxed mb-4 ${isExpanded}`}>
        {shortSummary}
      </p>
      
      {isExpanded && (
        <div 
          className="text-lg max-w-none mb-4"
          dangerouslySetInnerHTML={{ __html: mainSummaryHtml }} 
        />
      )}

      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="text-lg font-medium text-black hover:underline focus:outline-none"
      >
        {isExpanded ? 'Read less' : 'Read more'}
      </button>
    </div>
  );
} 