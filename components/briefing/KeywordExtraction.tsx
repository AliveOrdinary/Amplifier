'use client';

interface KeywordExtractionProps {
  onExtract: () => void;
  isLoading: boolean;
}

export default function KeywordExtraction({ onExtract, isLoading }: KeywordExtractionProps) {
  return (
    <div className="max-w-3xl mx-auto text-center py-12">
      <h2 className="text-3xl font-rightserif font-bold mb-6 text-white">AI Keyword Extraction</h2>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 mb-8">
        <p className="text-lg text-gray-300 mb-4">
          We'll now use AI to analyze your responses and extract visual keywords that capture your brand's aesthetic.
        </p>
        <p className="text-md text-gray-400">
          These keywords will be used to curate a personalized visual gallery from our internal reference collection.
        </p>
      </div>

      {isLoading ? (
        <div className="py-8">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
          <p className="text-gray-400">Analyzing your responses with Claude AI...</p>
        </div>
      ) : (
        <button
          onClick={onExtract}
          className="px-8 py-4 bg-white text-black rounded-md hover:bg-gray-200 transition-colors font-bold text-lg"
        >
          Extract Keywords with AI →
        </button>
      )}
    </div>
  );
}
