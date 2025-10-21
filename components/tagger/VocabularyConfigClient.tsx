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

  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-800">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Vocabulary Configuration</h1>
          <p className="text-gray-600">
            Manage the structure of your tagging system
          </p>
        </div>
        <Link
          href="/tagger/dashboard"
          className="text-blue-600 hover:underline"
        >
          ← Back to Dashboard
        </Link>
      </div>

      {/* Current Config */}
      {currentConfig && (
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-6">Current Configuration</h2>

          <div className="space-y-4 mb-8">
            <div>
              <span className="font-semibold text-gray-700">Name:</span>
              <span className="ml-3 text-gray-900">{currentConfig.config_name}</span>
            </div>
            {currentConfig.description && (
              <div>
                <span className="font-semibold text-gray-700">Description:</span>
                <p className="mt-1 text-gray-600">{currentConfig.description}</p>
              </div>
            )}
            <div className="text-sm text-gray-500">
              <div>Created: {new Date(currentConfig.created_at).toLocaleString()}</div>
              <div>Last Updated: {new Date(currentConfig.updated_at).toLocaleString()}</div>
            </div>
          </div>

          <h3 className="font-semibold text-lg mb-4">Category Structure:</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-300 bg-gray-50">
                  <th className="text-left py-3 px-4 font-semibold">Category</th>
                  <th className="text-left py-3 px-4 font-semibold">Storage Path</th>
                  <th className="text-left py-3 px-4 font-semibold">Type</th>
                  <th className="text-left py-3 px-4 font-semibold">Weight</th>
                  <th className="text-left py-3 px-4 font-semibold">Description</th>
                </tr>
              </thead>
              <tbody>
                {currentConfig.structure.categories.map((cat) => (
                  <tr key={cat.key} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">{cat.label}</td>
                    <td className="py-3 px-4 font-mono text-sm text-blue-600">{cat.storage_path}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {cat.storage_type}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-green-600">{cat.search_weight}</span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{cat.description || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Replace Configuration */}
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-semibold mb-6">Replace Vocabulary</h2>

        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-6 mb-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-yellow-800 mb-2">⚠️ Warning: Destructive Action</h3>
              <p className="text-sm text-yellow-800 mb-3">
                Replacing the vocabulary will permanently:
              </p>
              <ul className="text-sm text-yellow-800 ml-6 space-y-1 list-disc">
                <li><strong>Delete ALL existing images</strong> from the database and storage</li>
                <li><strong>Delete ALL existing tags</strong> from the vocabulary</li>
                <li><strong>Delete ALL tag corrections</strong> and AI training data</li>
                <li><strong>Reset the entire system</strong> for fresh tagging with new structure</li>
              </ul>
              <p className="text-sm text-yellow-800 mt-3 font-semibold">
                This action cannot be undone. Only use during test phase.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowReplaceModal(true)}
          className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors font-semibold shadow-md"
        >
          Replace with New Vocabulary
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
  );
}

// Replace Vocabulary Modal Component
function ReplaceVocabularyModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [newStructure, setNewStructure] = useState<any>(null);
  const [configName, setConfigName] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setJsonFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
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

      // 1. Get all images to delete storage files
      const { data: images, error: fetchError } = await supabase
        .from('reference_images')
        .select('id, storage_path, thumbnail_path');

      if (fetchError) {
        throw new Error(`Failed to fetch images: ${fetchError.message}`);
      }

      // 2. Delete storage files
      if (images && images.length > 0) {
        const storagePaths: string[] = [];
        images.forEach(img => {
          if (img.storage_path) {
            const pathMatch = img.storage_path.match(/reference-images\/(.+)$/);
            if (pathMatch) storagePaths.push(pathMatch[1]);
          }
          if (img.thumbnail_path) {
            const pathMatch = img.thumbnail_path.match(/reference-images\/(.+)$/);
            if (pathMatch) storagePaths.push(pathMatch[1]);
          }
        });

        if (storagePaths.length > 0) {
          const { error: storageError } = await supabase.storage
            .from('reference-images')
            .remove(storagePaths);

          if (storageError) {
            console.error('Storage deletion error:', storageError);
          }
        }
      }

      // 3. Delete all reference_images
      const { error: deleteImagesError } = await supabase
        .from('reference_images')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (deleteImagesError) {
        console.error('Images deletion error:', deleteImagesError);
      }

      // 4. Delete all tag corrections
      const { error: deleteCorrectionsError } = await supabase
        .from('tag_corrections')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (deleteCorrectionsError) {
        console.error('Corrections deletion error:', deleteCorrectionsError);
      }

      // 5. Delete all tags from vocabulary
      const { error: deleteTagsError } = await supabase
        .from('tag_vocabulary')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (deleteTagsError) {
        console.error('Tags deletion error:', deleteTagsError);
      }

      // 6. Delete old vocabulary config
      const { error: deleteConfigError } = await supabase
        .from('vocabulary_config')
        .delete()
        .eq('is_active', true);

      if (deleteConfigError) {
        console.error('Config deletion error:', deleteConfigError);
      }

      // 7. Insert new vocabulary config
      const { data: newConfig, error: insertError } = await supabase
        .from('vocabulary_config')
        .insert({
          config_name: configName.trim(),
          description: description || null,
          structure: newStructure.structure || newStructure,
          is_active: true
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(`Failed to insert new config: ${insertError.message}`);
      }

      alert(`✅ Vocabulary replaced successfully!\n\n${images?.length || 0} images deleted\n${images?.length ? images.length * 2 : 0} storage files removed\n\nSystem is ready for fresh tagging.`);
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
            placeholder: 'restaurant, hospitality, retail, tech, healthcare...'
          },
          {
            key: 'project_types',
            label: 'Project Types',
            storage_type: 'array',
            storage_path: 'project_types',
            search_weight: 4,
            description: 'Select all applicable project types',
            placeholder: 'branding, website, interior, packaging, editorial...'
          },
          {
            key: 'style',
            label: 'Style Tags',
            storage_type: 'jsonb_array',
            storage_path: 'tags.style',
            search_weight: 2,
            description: 'Visual style descriptors',
            placeholder: 'minimalist, modern, organic, vintage, brutalist...'
          },
          {
            key: 'mood',
            label: 'Mood Tags',
            storage_type: 'jsonb_array',
            storage_path: 'tags.mood',
            search_weight: 2,
            description: 'Emotional tone and atmosphere',
            placeholder: 'calm, bold, warm, sophisticated, playful...'
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-8">
          <h2 className="text-2xl font-bold mb-6">Replace Vocabulary Configuration</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {/* Upload Section */}
          <div className="mb-8">
            <h3 className="font-semibold text-lg mb-3">1. Upload Configuration JSON</h3>
            <p className="text-sm text-gray-600 mb-4">
              Upload a vocabulary_config.json file with your new structure
            </p>

            <div className="flex items-center gap-4 mb-3">
              <input
                type="file"
                accept=".json"
                onChange={handleJsonUpload}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100
                  cursor-pointer"
              />
            </div>

            <button
              onClick={downloadTemplate}
              className="text-sm text-blue-600 hover:underline"
            >
              📥 Download Template
            </button>
          </div>

          {/* Config Details */}
          {newStructure && (
            <>
              <div className="mb-6">
                <h3 className="font-semibold text-lg mb-3">2. Configuration Details</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Configuration Name *
                    </label>
                    <input
                      type="text"
                      value={configName}
                      onChange={(e) => setConfigName(e.target.value)}
                      placeholder="e.g., Production Vocabulary v2"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description (Optional)
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe this vocabulary structure..."
                      rows={3}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="mb-8">
                <h3 className="font-semibold text-lg mb-3">3. Preview Structure</h3>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-64 overflow-auto">
                  <pre className="text-xs text-gray-800 whitespace-pre-wrap">
                    {JSON.stringify(newStructure.structure || newStructure, null, 2)}
                  </pre>
                </div>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
            <button
              onClick={onClose}
              disabled={uploading}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleReplace}
              disabled={!newStructure || !configName.trim() || uploading}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Replacing...' : 'Replace & Delete All Data'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
