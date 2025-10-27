'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface VocabularyCategory {
  key: string;
  label: string;
  storage_type: 'array' | 'jsonb_array' | 'text';
  storage_path: string;
  search_weight: number;
  description?: string;
  placeholder?: string;
}

interface VocabularyConfig {
  id: string;
  config_name: string;
  description: string | null;
  structure: {
    categories: VocabularyCategory[];
  };
  created_at: string;
  updated_at: string;
}

export default function VocabularyConfigClient() {
  const [currentConfig, setCurrentConfig] = useState<VocabularyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      setLoading(true);

      // Fetch directly from Supabase (no API route needed)
      const { data, error: fetchError } = await supabase
        .from('vocabulary_config')
        .select('*')
        .eq('is_active', true)
        .single();

      if (fetchError) {
        setError('No active vocabulary configuration found');
        console.error(fetchError);
      } else {
        setCurrentConfig(data);
        setError(null);
      }
    } catch (err) {
      setError('Failed to load configuration');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleCopyConfig = async () => {
    if (!currentConfig) return;

    try {
      const configToCopy = {
        config_name: currentConfig.config_name,
        description: currentConfig.description,
        structure: currentConfig.structure
      };
      const configText = JSON.stringify(configToCopy, null, 2);
      await navigator.clipboard.writeText(configText);
      alert('✅ Configuration copied to clipboard!');
    } catch (error) {
      alert('❌ Failed to copy to clipboard');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900">
        <div className="container mx-auto p-8">
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-300 font-medium">Loading configuration...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900">
        <div className="container mx-auto p-8">
          <div className="bg-red-900/50 border-2 border-red-600 rounded-xl p-8 text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <p className="text-red-300 font-semibold text-lg">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto p-8 max-w-7xl space-y-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Vocabulary Configuration</h1>
            <p className="text-gray-300 text-lg font-medium">
              Manage the structure of your tagging system
            </p>
          </div>
          <Link
            href="/tagger/dashboard"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 hover:bg-gray-800 px-4 py-2 rounded-lg transition-colors font-semibold"
          >
            <span>←</span>
            <span>Back to Dashboard</span>
          </Link>
        </div>

      {/* Current Config */}
      {currentConfig && (
        <div className="bg-gray-800 rounded-xl shadow-xl border border-gray-700 p-10">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold text-white">Current Configuration</h2>
            <button
              onClick={handleCopyConfig}
              className="px-4 py-2 border-2 border-gray-600 text-white rounded-lg hover:bg-gray-700 hover:border-gray-500 transition-colors font-semibold flex items-center gap-2"
            >
              📋 Copy JSON
            </button>
          </div>

          <div className="space-y-6 mb-10">
            <div className="flex items-baseline">
              <span className="font-bold text-gray-300 w-40">Name:</span>
              <span className="text-white font-medium text-lg">{currentConfig.config_name}</span>
            </div>
            {currentConfig.description && (
              <div className="flex items-start">
                <span className="font-bold text-gray-300 w-40 pt-1">Description:</span>
                <p className="flex-1 text-gray-400 leading-relaxed font-medium">{currentConfig.description}</p>
              </div>
            )}
            <div className="flex items-baseline text-sm">
              <span className="font-bold text-gray-300 w-40">Created:</span>
              <span className="text-gray-400 font-medium">{new Date(currentConfig.created_at).toLocaleString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
              })}</span>
            </div>
            <div className="flex items-baseline text-sm">
              <span className="font-bold text-gray-300 w-40">Last Updated:</span>
              <span className="text-gray-400 font-medium">{new Date(currentConfig.updated_at).toLocaleString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
              })}</span>
            </div>
          </div>

          <h3 className="text-2xl font-bold text-white mb-6">Category Structure</h3>
          <div className="overflow-x-auto rounded-lg border-2 border-gray-700 shadow-sm">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-700 border-b-2 border-gray-600">
                  <th className="text-left py-4 px-6 font-semibold text-sm uppercase tracking-wide text-gray-300">Category</th>
                  <th className="text-left py-4 px-6 font-semibold text-sm uppercase tracking-wide text-gray-300">Storage Path</th>
                  <th className="text-center py-4 px-6 font-semibold text-sm uppercase tracking-wide text-gray-300">Type</th>
                  <th className="text-center py-4 px-6 font-semibold text-sm uppercase tracking-wide text-gray-300">Weight</th>
                  <th className="text-center py-4 px-6 font-semibold text-sm uppercase tracking-wide text-gray-300">Tags</th>
                  <th className="text-left py-4 px-6 font-semibold text-sm uppercase tracking-wide text-gray-300">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {currentConfig.structure.categories.map((cat: any) => (
                  <tr key={cat.key} className="hover:bg-gray-750 transition-colors bg-gray-800">
                    <td className="py-5 px-6 font-semibold text-white">{cat.label}</td>
                    <td className="py-5 px-6">
                      <span className="font-mono text-sm text-blue-300 bg-blue-900/50 px-2 py-1 rounded border border-blue-700">
                        {cat.storage_path}
                      </span>
                    </td>
                    <td className="py-5 px-6 text-center">
                      <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-gray-700 text-gray-200 border border-gray-600">
                        {cat.storage_type}
                      </span>
                    </td>
                    <td className="py-5 px-6 text-center">
                      <span className="inline-flex px-3 py-1 rounded-full text-sm font-bold bg-green-900/50 text-green-300 border border-green-700">{cat.search_weight}</span>
                    </td>
                    <td className="py-5 px-6 text-center">
                      {cat.tags && cat.tags.length > 0 ? (
                        <span className="inline-flex px-3 py-1 rounded-full text-sm font-semibold bg-purple-900/50 text-purple-300 border border-purple-700">
                          {cat.tags.length} tags
                        </span>
                      ) : (
                        <span className="text-gray-500 text-sm italic">No tags</span>
                      )}
                    </td>
                    <td className="py-5 px-6">
                      <p className="text-sm text-gray-400 mb-2">{cat.description || <span className="text-gray-600 italic">No description</span>}</p>
                      {cat.tags && cat.tags.length > 0 && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-blue-400 hover:text-blue-300 font-medium">
                            View {cat.tags.length} tags
                          </summary>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {cat.tags.slice(0, 20).map((tag: string, idx: number) => (
                              <span key={idx} className="px-2 py-0.5 bg-gray-700 text-gray-300 rounded text-xs border border-gray-600">
                                {tag}
                              </span>
                            ))}
                            {cat.tags.length > 20 && (
                              <span className="px-2 py-0.5 text-gray-500 text-xs italic">
                                +{cat.tags.length - 20} more
                              </span>
                            )}
                          </div>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Replace Configuration */}
      <div className="bg-gray-800 rounded-xl shadow-xl border border-gray-700 p-10">
        <h2 className="text-3xl font-bold text-white mb-8">Replace Vocabulary</h2>

        <div className="bg-gradient-to-br from-yellow-900/30 to-orange-900/30 border-2 border-yellow-600 rounded-xl p-8 mb-8 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 text-4xl">
              ⚠️
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-yellow-400 mb-4">Warning: Destructive Action</h3>
              <p className="text-sm font-semibold text-yellow-300 mb-4">
                Replacing the vocabulary will permanently:
              </p>
              <ul className="text-sm text-yellow-200 space-y-2 mb-6">
                <li className="flex items-start gap-2">
                  <span className="text-red-400 font-bold">✗</span>
                  <span><strong>Delete ALL existing images</strong> from the database and storage</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 font-bold">✗</span>
                  <span><strong>Delete ALL existing tags</strong> from the vocabulary</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 font-bold">✗</span>
                  <span><strong>Delete ALL tag corrections</strong> and AI training data</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 font-bold">✗</span>
                  <span><strong>Reset the entire system</strong> for fresh tagging with new structure</span>
                </li>
              </ul>
              <div className="bg-red-900/50 border-2 border-red-600 rounded-lg p-4">
                <p className="text-sm text-red-300 font-bold">
                  ⛔ This action cannot be undone. Only use during test phase.
                </p>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowReplaceModal(true)}
          className="bg-red-600 text-white px-8 py-4 rounded-xl hover:bg-red-700 hover:shadow-lg transition-all duration-200 font-bold text-lg"
        >
          🔄 Replace with New Vocabulary
        </button>
      </div>

      {/* Replace Modal */}
      {showReplaceModal && (
        <ReplaceVocabularyModal
          onClose={() => setShowReplaceModal(false)}
          onSuccess={() => {
            setShowReplaceModal(false);
            loadConfig();
          }}
        />
      )}
    </div>
    </div>
  );
}

// Replace Vocabulary Modal Component
function ReplaceVocabularyModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [inputMethod, setInputMethod] = useState<'paste' | 'upload'>('paste');
  const [pastedJson, setPastedJson] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseSuccess, setParseSuccess] = useState(false);
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [newStructure, setNewStructure] = useState<any>(null);
  const [configName, setConfigName] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateVocabJson = (json: any): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!json.structure) {
      errors.push('Missing "structure" property');
    }

    if (!Array.isArray(json.structure?.categories)) {
      errors.push('"structure.categories" must be an array');
    }

    json.structure?.categories?.forEach((cat: any, index: number) => {
      const num = index + 1;
      if (!cat.key) errors.push(`Category ${num}: Missing "key"`);
      if (!cat.label) errors.push(`Category ${num}: Missing "label"`);
      if (!cat.storage_type) errors.push(`Category ${num}: Missing "storage_type"`);
      if (!['array', 'jsonb_array', 'text'].includes(cat.storage_type)) {
        errors.push(`Category ${num}: Invalid storage_type "${cat.storage_type}"`);
      }
      if (typeof cat.search_weight !== 'number') {
        errors.push(`Category ${num}: search_weight must be a number`);
      }
    });

    return { valid: errors.length === 0, errors };
  };

  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setJsonFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);

        // Validate structure
        const { valid, errors } = validateVocabJson(json);
        if (!valid) {
          setError(errors.join('; '));
          setNewStructure(null);
          return;
        }

        setNewStructure(json);
        if (json.config_name) setConfigName(json.config_name);
        if (json.description) setDescription(json.description);
        setError(null);
      } catch (err) {
        setError('Invalid JSON file');
        setNewStructure(null);
      }
    };
    reader.readAsText(file);
  };

  const handlePasteJson = async () => {
    setParseError(null);
    setParseSuccess(false);
    setError(null);

    try {
      // Parse JSON
      const parsed = JSON.parse(pastedJson);

      // Validate structure
      const { valid, errors } = validateVocabJson(parsed);

      if (!valid) {
        setParseError(errors.join('; '));
        return;
      }

      // Apply configuration
      setNewStructure(parsed);
      if (parsed.config_name) setConfigName(parsed.config_name);
      if (parsed.description) setDescription(parsed.description);
      setParseError(null);
      setParseSuccess(true);

      // Scroll to the config details section after a brief delay
      setTimeout(() => {
        const detailsSection = document.querySelector('[data-config-details]');
        detailsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);

    } catch (error: any) {
      if (error instanceof SyntaxError) {
        setParseError('Invalid JSON syntax: ' + error.message);
      } else {
        setParseError(error.message || 'Failed to process JSON');
      }
    }
  };

  const handleReplace = async () => {
    if (!newStructure || !configName.trim()) {
      setError('Please upload a valid configuration and provide a name');
      return;
    }

    if (!confirm('Are you absolutely sure? This will DELETE ALL IMAGES and TAGS. This cannot be undone!')) {
      return;
    }

    try {
      setUploading(true);
      setError(null);

      // Call the API route to handle the replacement with service role key
      const response = await fetch('/api/vocabulary-config/replace', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config_name: configName.trim(),
          description: description || null,
          structure: newStructure.structure || newStructure,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.details || result.error || 'Failed to replace vocabulary');
      }

      alert(
        `✅ Vocabulary replaced successfully!\n\n` +
        `${result.stats?.images_deleted || 0} images deleted\n` +
        `${result.stats?.storage_files_deleted || 0} storage files removed\n` +
        `${result.stats?.tags_inserted || 0} tags inserted\n\n` +
        `System is ready for fresh tagging.`
      );

      onSuccess();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to replace vocabulary');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    const template = {
      config_name: 'My Custom Vocabulary',
      description: 'Custom vocabulary structure for my design reference library',
      structure: {
        categories: [
          {
            key: 'industries',
            label: 'Industries',
            storage_type: 'array',
            storage_path: 'industries',
            search_weight: 5,
            description: 'Select all applicable industries',
            placeholder: 'Select industries...',
            tags: [
              'restaurant',
              'hospitality',
              'retail',
              'tech',
              'healthcare',
              'education',
              'finance',
              'real estate',
              'entertainment',
              'nonprofit'
            ]
          },
          {
            key: 'project_types',
            label: 'Project Types',
            storage_type: 'array',
            storage_path: 'project_types',
            search_weight: 4,
            description: 'Select all applicable project types',
            placeholder: 'Select project types...',
            tags: [
              'branding',
              'website',
              'interior',
              'packaging',
              'editorial',
              'signage',
              'app design',
              'social media',
              'print collateral'
            ]
          },
          {
            key: 'style',
            label: 'Style Tags',
            storage_type: 'jsonb_array',
            storage_path: 'tags.style',
            search_weight: 2,
            description: 'Visual style descriptors',
            placeholder: 'Select styles...',
            tags: [
              'minimalist',
              'modern',
              'organic',
              'vintage',
              'brutalist',
              'elegant',
              'industrial',
              'geometric',
              'hand-drawn',
              'maximalist'
            ]
          },
          {
            key: 'mood',
            label: 'Mood Tags',
            storage_type: 'jsonb_array',
            storage_path: 'tags.mood',
            search_weight: 2,
            description: 'Emotional tone and atmosphere',
            placeholder: 'Select moods...',
            tags: [
              'calm',
              'bold',
              'warm',
              'sophisticated',
              'playful',
              'energetic',
              'mysterious',
              'luxurious',
              'approachable',
              'edgy'
            ]
          },
          {
            key: 'notes',
            label: 'Notes',
            storage_type: 'text',
            storage_path: 'notes',
            search_weight: 1,
            description: 'Optional notes about this reference image',
            placeholder: 'e.g., Great for high-end restaurant projects...'
          }
        ]
      }
    };

    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vocabulary_config_template.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-gray-700">
        <div className="p-10">
          <h2 className="text-3xl font-bold text-white mb-8">Replace Vocabulary Configuration</h2>

          {error && (
            <div className="bg-red-900/50 border border-red-600 rounded-lg p-4 mb-6">
              <p className="text-red-300">{error}</p>
            </div>
          )}

          {/* Input Method Tabs */}
          <div className="mb-8">
            <h3 className="font-semibold text-white text-lg mb-4">1. Upload Configuration JSON</h3>

            {/* Tab Selector */}
            <div className="flex gap-1 mb-6 bg-gray-700 p-1 rounded-lg">
              <button
                onClick={() => {
                  setInputMethod('paste');
                  setError(null);
                }}
                className={`flex-1 px-4 py-2.5 font-medium transition-all rounded-md ${
                  inputMethod === 'paste'
                    ? 'bg-gray-600 text-white shadow-sm'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                📋 Paste JSON
              </button>
              <button
                onClick={() => {
                  setInputMethod('upload');
                  setParseError(null);
                  setParseSuccess(false);
                }}
                className={`flex-1 px-4 py-2.5 font-medium transition-all rounded-md ${
                  inputMethod === 'upload'
                    ? 'bg-gray-600 text-white shadow-sm'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                📁 Upload File
              </button>
            </div>

            {/* Paste JSON Tab */}
            {inputMethod === 'paste' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    Paste your vocabulary JSON configuration:
                  </label>
                  <textarea
                    value={pastedJson}
                    onChange={(e) => setPastedJson(e.target.value)}
                    placeholder={`{
  "config_name": "My Custom Vocabulary",
  "description": "Custom vocabulary structure",
  "structure": {
    "categories": [
      {
        "key": "industries",
        "label": "Industries",
        "description": "Industry categories",
        "placeholder": "Select industries...",
        "storage_path": "industries",
        "storage_type": "array",
        "search_weight": 10
      }
    ]
  }
}`}
                    rows={18}
                    className="w-full px-4 py-3 border-2 border-gray-600 rounded-lg text-sm font-mono bg-gray-900 text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-600 resize-none"
                  />
                  <p className="text-xs text-gray-400 mt-2">
                    {pastedJson.length} characters
                  </p>
                </div>

                {parseError && (
                  <div className="bg-red-900/50 border-2 border-red-600 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-red-400 text-xl flex-shrink-0">⚠️</span>
                      <div>
                        <p className="font-semibold text-red-300 mb-1">Invalid JSON</p>
                        <p className="text-sm text-red-200">{parseError}</p>
                      </div>
                    </div>
                  </div>
                )}

                {parseSuccess && (
                  <div className="bg-green-900/50 border-2 border-green-600 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-green-400 text-xl flex-shrink-0">✅</span>
                      <div>
                        <p className="font-semibold text-green-300 mb-1">Configuration Loaded!</p>
                        <p className="text-sm text-green-200">
                          Found {newStructure?.structure?.categories?.length || 0} categories.
                          Scroll down to review and confirm.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handlePasteJson}
                    disabled={!pastedJson.trim() || uploading}
                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    {uploading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="animate-spin">⏳</span>
                        Processing...
                      </span>
                    ) : (
                      '✅ Validate & Load'
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setPastedJson('');
                      setParseError(null);
                      setParseSuccess(false);
                    }}
                    disabled={uploading}
                    className="px-6 py-3 border-2 border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors font-semibold"
                  >
                    Clear
                  </button>
                </div>

                <div className="bg-blue-900/50 border-2 border-blue-600 rounded-lg p-4">
                  <div className="flex gap-3">
                    <span className="text-blue-400 text-xl flex-shrink-0">💡</span>
                    <div>
                      <p className="text-sm text-blue-300 font-medium mb-1">Tip</p>
                      <p className="text-sm text-blue-200">
                        You can download the template below and modify it to match your needs, or copy an existing configuration.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Upload File Tab */}
            {inputMethod === 'upload' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-300">
                  Upload a vocabulary_config.json file with your new structure
                </p>

                <div className="flex items-center gap-4">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleJsonUpload}
                    className="block w-full text-sm text-gray-400
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-lg file:border-0
                      file:text-sm file:font-semibold
                      file:bg-blue-600 file:text-white
                      hover:file:bg-blue-700
                      cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* Download Template (visible for both tabs) */}
            <div className="mt-4 pt-4 border-t border-gray-700">
              <button
                onClick={downloadTemplate}
                className="text-sm text-blue-400 hover:text-blue-300 hover:bg-gray-700 px-4 py-2 rounded-lg transition-colors font-semibold"
              >
                📥 Download Template
              </button>
            </div>
          </div>

          {/* Config Details */}
          {newStructure && (
            <>
              <div className="mb-6" data-config-details>
                <h3 className="font-semibold text-white text-lg mb-3">2. Configuration Details</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Configuration Name *
                    </label>
                    <input
                      type="text"
                      value={configName}
                      onChange={(e) => setConfigName(e.target.value)}
                      placeholder="e.g., Production Vocabulary v2"
                      className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Description (Optional)
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe this vocabulary structure..."
                      rows={3}
                      className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="mb-8">
                <h3 className="font-semibold text-white text-lg mb-3">3. Preview Structure</h3>
                <div className="bg-gray-900 border border-gray-600 rounded-lg p-4 max-h-64 overflow-auto">
                  <pre className="text-xs text-gray-300 whitespace-pre-wrap">
                    {JSON.stringify(newStructure.structure || newStructure, null, 2)}
                  </pre>
                </div>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-4 pt-6 border-t-2 border-gray-700 mt-8">
            <button
              onClick={onClose}
              disabled={uploading}
              className="px-6 py-3 border-2 border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleReplace}
              disabled={!newStructure || !configName.trim() || uploading}
              className="px-8 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 hover:shadow-lg transition-all duration-200 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Replacing...' : '⚠️ Replace & Delete All Data'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
