'use client';

import { useState } from 'react';

interface KeywordEditorProps {
  keywords: string[];
  onChange: (keywords: string[]) => void;
  onSearch: (keywords: string[]) => void;
  isLoading: boolean;
}

export default function KeywordEditor({ keywords, onChange, onSearch, isLoading }: KeywordEditorProps) {
  const [newKeyword, setNewKeyword] = useState('');

  const handleAdd = () => {
    if (newKeyword.trim() && !keywords.includes(newKeyword.trim())) {
      onChange([...keywords, newKeyword.trim()]);
      setNewKeyword('');
    }
  };

  const handleRemove = (index: number) => {
    onChange(keywords.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (keywords.length > 0) {
      onSearch(keywords);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-rightserif font-bold mb-6 text-white">Extracted Keywords</h2>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-6">
        <p className="text-gray-300 mb-4">
          Review and edit these AI-extracted keywords. You can add, remove, or modify them to better match your vision.
        </p>
      </div>

      <div className="mb-8">
        <div className="flex flex-wrap gap-3 mb-6">
          {keywords.map((keyword, index) => (
            <div
              key={index}
              className="bg-white text-black px-4 py-2 rounded-full flex items-center gap-2 group"
            >
              <span>{keyword}</span>
              <button
                onClick={() => handleRemove(index)}
                className="text-black hover:text-red-600 transition-colors font-bold"
                aria-label={`Remove ${keyword}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
            placeholder="Add a keyword..."
            className="flex-1 px-4 py-3 border-2 border-gray-700 bg-black text-white rounded-md focus:border-white focus:outline-none transition-colors placeholder:text-gray-500"
          />
          <button
            onClick={handleAdd}
            type="button"
            className="px-6 py-3 border-2 border-white text-white rounded-md hover:bg-gray-900 transition-colors font-bold"
          >
            Add
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {isLoading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
            <p className="text-gray-400">Searching Are.na for visual references...</p>
          </div>
        ) : (
          <div className="flex justify-center">
            <button
              type="submit"
              disabled={keywords.length === 0}
              className="px-8 py-4 bg-white text-black rounded-md hover:bg-gray-200 transition-colors font-bold text-lg disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed"
            >
              Search Are.na Gallery →
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
