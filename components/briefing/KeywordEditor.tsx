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
          Review and edit these keywords. You can add, remove, or modify them to better match your vision.
        </p>
      </div>

      <div className="mb-8">
        <div className="flex flex-wrap gap-2 mb-6">
          {keywords.map((keyword, index) => (
            <div
              key={keyword}
              className="bg-gray-800 text-white border border-gray-700 px-3 py-1.5 rounded-lg flex items-center gap-2"
            >
              <span className="text-sm">{keyword}</span>
              <button
                onClick={() => handleRemove(index)}
                className="text-gray-400 hover:text-red-400 transition-colors"
                aria-label={`Remove ${keyword}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
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
            className="flex-1 px-4 py-3 border border-gray-700 bg-gray-950 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors placeholder:text-gray-500"
          />
          <button
            onClick={handleAdd}
            type="button"
            className="px-6 py-3 border border-gray-600 text-gray-300 rounded-lg hover:text-white hover:border-gray-400 transition-colors font-medium"
          >
            Add
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {isLoading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-400 mb-4"></div>
            <p className="text-gray-400">Searching our curated collection for visual references...</p>
          </div>
        ) : (
          <div className="flex justify-center">
            <button
              type="submit"
              disabled={keywords.length === 0}
              className="px-8 py-4 bg-white text-black rounded-lg hover:bg-gray-200 transition-colors font-medium text-lg disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed"
            >
              Search Reference Gallery
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
