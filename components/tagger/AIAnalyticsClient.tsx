'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Type definitions
interface TagCategoryStats {
  category: string
  avgSuggestedByAI: number
  avgSelectedByDesigner: number
  accuracy: number
}

interface TagAnalysis {
  tag: string
  category: string
  count: number
  percentage: number
}

interface ConfidenceBucket {
  range: string
  imageCount: number
  avgCorrections: number
  correctionRate: number
}

interface ImageAnalysis {
  id: string
  thumbnail_path: string
  original_filename: string
  ai_confidence_score: number | null
  ai_suggested_tags: any
  actual_tags: {
    industries: string[]
    project_types: string[]
    styles: string[]
    moods: string[]
    elements: string[]
  }
  corrections: {
    tags_added: string[]
    tags_removed: string[]
  } | null
  correctionPercentage: number
  tagged_at: string
}

interface AIAnalytics {
  overallMetrics: {
    totalImagesAnalyzed: number
    averageConfidence: number
    totalCorrections: number
    overallAccuracy: number
    accuracyTrend: 'improving' | 'declining' | 'stable'
    trendPercentage: number
  }
  categoryBreakdown: TagCategoryStats[]
  missedTags: TagAnalysis[]
  wrongTags: TagAnalysis[]
  confidenceBuckets: ConfidenceBucket[]
  imageAnalysis: ImageAnalysis[]
  insights: string[]
}

interface AIAnalyticsClientProps {
  analytics: AIAnalytics
}

export default function AIAnalyticsClient({ analytics }: AIAnalyticsClientProps) {
  const [selectedImage, setSelectedImage] = useState<ImageAnalysis | null>(null)
  const [isRetraining, setIsRetraining] = useState(false)
  const [retrainMessage, setRetrainMessage] = useState<string | null>(null)
  const [enhancedMode, setEnhancedMode] = useState<boolean>(false)
  const [isTogglingMode, setIsTogglingMode] = useState(false)
  const [toggleMessage, setToggleMessage] = useState<string | null>(null)

  // Fetch enhanced mode setting on mount
  useEffect(() => {
    const fetchSetting = async () => {
      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('setting_value')
          .eq('setting_key', 'use_enhanced_prompt')
          .single()

        if (!error && data) {
          setEnhancedMode(data.setting_value === 'true')
        }
      } catch (error) {
        console.error('Error fetching enhanced mode setting:', error)
      }
    }
    fetchSetting()
  }, [])

  const handleToggleEnhancedMode = async (enabled: boolean) => {
    setIsTogglingMode(true)
    setToggleMessage(null)

    try {
      const { error } = await supabase.rpc('update_setting', {
        p_key: 'use_enhanced_prompt',
        p_value: enabled ? 'true' : 'false'
      })

      if (!error) {
        setEnhancedMode(enabled)
        setToggleMessage(
          enabled
            ? '✅ Enhanced mode enabled! New AI suggestions will learn from your corrections.'
            : '✅ Enhanced mode disabled. AI will use baseline prompts.'
        )

        // Clear message after 5 seconds
        setTimeout(() => setToggleMessage(null), 5000)
      } else {
        setToggleMessage(`❌ Failed to toggle mode: ${error.message}`)
      }
    } catch (error) {
      setToggleMessage(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsTogglingMode(false)
    }
  }

  const handleRegeneratePrompt = async () => {
    setIsRetraining(true)
    setRetrainMessage(null)

    try {
      const response = await fetch('/api/retrain-prompt', {
        method: 'POST'
      })

      const data = await response.json()

      if (data.success) {
        setRetrainMessage(`✅ ${data.message}`)
      } else {
        setRetrainMessage(`❌ ${data.message || data.error}`)
      }
    } catch (error) {
      setRetrainMessage(`❌ Failed to regenerate prompt: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsRetraining(false)
    }
  }

  const handleExportPDF = () => {
    // Create text summary for export
    const summary = `
AI LEARNING ANALYTICS REPORT
Generated: ${new Date().toLocaleDateString()}

OVERALL PERFORMANCE
- Images Analyzed: ${analytics.overallMetrics.totalImagesAnalyzed}
- Average AI Confidence: ${analytics.overallMetrics.averageConfidence}%
- Total Corrections: ${analytics.overallMetrics.totalCorrections}
- Overall Accuracy: ${analytics.overallMetrics.overallAccuracy}%
- Trend: ${analytics.overallMetrics.accuracyTrend} (${analytics.overallMetrics.trendPercentage > 0 ? '+' : ''}${analytics.overallMetrics.trendPercentage}%)

CATEGORY BREAKDOWN
${analytics.categoryBreakdown.map(cat =>
  `${cat.category}: AI avg ${cat.avgSuggestedByAI}, Designer avg ${cat.avgSelectedByDesigner}, Accuracy ${cat.accuracy}%`
).join('\n')}

TOP MISSED TAGS
${analytics.missedTags.slice(0, 10).map((tag, i) =>
  `${i + 1}. ${tag.tag} (${tag.category}) - ${tag.count} times, ${tag.percentage}%`
).join('\n')}

TOP WRONG SUGGESTIONS
${analytics.wrongTags.slice(0, 10).map((tag, i) =>
  `${i + 1}. ${tag.tag} (${tag.category}) - ${tag.count} times, ${tag.percentage}%`
).join('\n')}

INSIGHTS
${analytics.insights.map((insight, i) => `${i + 1}. ${insight}`).join('\n')}
`

    // Download as text file
    const blob = new Blob([summary], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ai-analytics-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-8">
      {/* Prompt Monitoring & Controls */}
      <section>
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold mb-2">🧠 AI Prompt Learning Status</h2>
              <p className="text-indigo-100 text-sm">
                The AI learns from your corrections to improve future tag suggestions
              </p>
            </div>
            <button
              onClick={handleRegeneratePrompt}
              disabled={isRetraining || analytics.overallMetrics.totalImagesAnalyzed < 5}
              className="px-4 py-2 bg-white text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRetraining ? 'Regenerating...' : 'Regenerate Prompt'}
            </button>
          </div>

          {retrainMessage && (
            <div className={`mb-4 p-3 rounded ${
              retrainMessage.startsWith('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {retrainMessage}
            </div>
          )}

          {toggleMessage && (
            <div className={`mb-4 p-3 rounded ${
              toggleMessage.startsWith('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {toggleMessage}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-indigo-100">Prompt Version</div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enhancedMode}
                    onChange={(e) => handleToggleEnhancedMode(e.target.checked)}
                    disabled={isTogglingMode || analytics.overallMetrics.totalImagesAnalyzed < 5}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-400 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
                </label>
              </div>
              <div className="text-2xl font-bold">
                {enhancedMode ? 'Enhanced' : 'Baseline'}
              </div>
              <div className="text-xs text-indigo-200 mt-1">
                {enhancedMode
                  ? 'Learning from corrections'
                  : 'Original prompt (no learning)'}
              </div>
              {analytics.overallMetrics.totalImagesAnalyzed < 5 && (
                <div className="text-xs text-yellow-200 mt-2">
                  Toggle disabled: Need 5+ images
                </div>
              )}
            </div>

            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="text-sm text-indigo-100 mb-1">Training Data</div>
              <div className="text-2xl font-bold">
                {analytics.overallMetrics.totalImagesAnalyzed} images
              </div>
              <div className="text-xs text-indigo-200 mt-1">
                {analytics.overallMetrics.totalImagesAnalyzed < 5
                  ? `Need ${5 - analytics.overallMetrics.totalImagesAnalyzed} more for enhancement`
                  : 'Ready for enhanced prompts'}
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="text-sm text-indigo-100 mb-1">Cache Status</div>
              <div className="text-2xl font-bold">Active</div>
              <div className="text-xs text-indigo-200 mt-1">
                Updates every 5 images or 1 hour
              </div>
            </div>
          </div>

          {analytics.overallMetrics.totalImagesAnalyzed >= 5 && (
            <div className="mt-4 p-3 bg-white/10 backdrop-blur rounded">
              <div className="text-sm font-medium mb-2">💡 Quick Tip:</div>
              <div className="text-sm text-indigo-100">
                {enhancedMode
                  ? 'Enhanced prompts are enabled! The AI is learning from your corrections. Click "Regenerate Prompt" above to refresh with the latest patterns.'
                  : 'Toggle the switch above to enable enhanced prompts. The AI will learn from your corrections and make better suggestions!'}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Overall Performance Metrics */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Overall Performance</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Images */}
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Images Analyzed</div>
            <div className="text-3xl font-bold text-gray-900">
              {analytics.overallMetrics.totalImagesAnalyzed}
            </div>
            <div className="text-xs text-gray-500 mt-1">with AI suggestions</div>
          </div>

          {/* Average Confidence */}
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Avg AI Confidence</div>
            <div className="text-3xl font-bold text-blue-600">
              {analytics.overallMetrics.averageConfidence}%
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${analytics.overallMetrics.averageConfidence}%` }}
              />
            </div>
          </div>

          {/* Overall Accuracy */}
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Overall Accuracy</div>
            <div className={`text-3xl font-bold ${
              analytics.overallMetrics.overallAccuracy >= 80 ? 'text-green-600' :
              analytics.overallMetrics.overallAccuracy >= 60 ? 'text-yellow-600' :
              'text-red-600'
            }`}>
              {analytics.overallMetrics.overallAccuracy}%
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  analytics.overallMetrics.overallAccuracy >= 80 ? 'bg-green-600' :
                  analytics.overallMetrics.overallAccuracy >= 60 ? 'bg-yellow-600' :
                  'bg-red-600'
                }`}
                style={{ width: `${analytics.overallMetrics.overallAccuracy}%` }}
              />
            </div>
          </div>

          {/* Accuracy Trend */}
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Accuracy Trend</div>
            <div className={`text-3xl font-bold ${
              analytics.overallMetrics.accuracyTrend === 'improving' ? 'text-green-600' :
              analytics.overallMetrics.accuracyTrend === 'declining' ? 'text-red-600' :
              'text-gray-600'
            }`}>
              {analytics.overallMetrics.accuracyTrend === 'improving' ? '📈' :
               analytics.overallMetrics.accuracyTrend === 'declining' ? '📉' :
               '➡️'}
            </div>
            <div className="text-sm mt-1">
              <span className={`font-semibold ${
                analytics.overallMetrics.trendPercentage > 0 ? 'text-green-600' :
                analytics.overallMetrics.trendPercentage < 0 ? 'text-red-600' :
                'text-gray-600'
              }`}>
                {analytics.overallMetrics.trendPercentage > 0 ? '+' : ''}
                {analytics.overallMetrics.trendPercentage.toFixed(1)}%
              </span>
              <span className="text-gray-500 ml-1">vs earlier images</span>
            </div>
          </div>
        </div>
      </section>

      {/* Category Breakdown */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Tag Category Performance</h2>
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="space-y-6">
            {analytics.categoryBreakdown.map(cat => {
              const maxValue = Math.max(cat.avgSuggestedByAI, cat.avgSelectedByDesigner, 5)
              return (
                <div key={cat.category}>
                  <div className="flex justify-between items-center mb-2">
                    <div className="font-semibold capitalize">
                      {cat.category.replace('_', ' ')}
                    </div>
                    <div className={`text-sm font-medium px-2 py-1 rounded ${
                      cat.accuracy >= 80 ? 'bg-green-100 text-green-800' :
                      cat.accuracy >= 60 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {cat.accuracy.toFixed(1)}% accuracy
                    </div>
                  </div>
                  <div className="space-y-2">
                    {/* AI Suggested */}
                    <div className="flex items-center gap-3">
                      <div className="w-32 text-sm text-gray-600">AI suggests</div>
                      <div className="flex-1 bg-gray-100 rounded-full h-6 relative">
                        <div
                          className="bg-blue-500 h-6 rounded-full flex items-center justify-end pr-2"
                          style={{ width: `${(cat.avgSuggestedByAI / maxValue) * 100}%` }}
                        >
                          <span className="text-xs text-white font-medium">
                            {cat.avgSuggestedByAI}
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* Designer Selected */}
                    <div className="flex items-center gap-3">
                      <div className="w-32 text-sm text-gray-600">Designer uses</div>
                      <div className="flex-1 bg-gray-100 rounded-full h-6 relative">
                        <div
                          className="bg-green-500 h-6 rounded-full flex items-center justify-end pr-2"
                          style={{ width: `${(cat.avgSelectedByDesigner / maxValue) * 100}%` }}
                        >
                          <span className="text-xs text-white font-medium">
                            {cat.avgSelectedByDesigner}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Missed Tags & Wrong Suggestions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Missed Tags */}
        <section>
          <h2 className="text-2xl font-bold mb-4">Tags AI Frequently Misses</h2>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {analytics.missedTags.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No missed tags data available yet
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Rank</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tag</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Category</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Count</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {analytics.missedTags.map((tag, index) => (
                    <tr key={tag.tag} className={tag.percentage > 30 ? 'bg-red-50' : ''}>
                      <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{tag.tag}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 capitalize">
                        {tag.category.replace('_', ' ')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                        {tag.count}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          tag.percentage > 30 ? 'bg-red-100 text-red-800' :
                          tag.percentage > 20 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {tag.percentage}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Wrong Suggestions */}
        <section>
          <h2 className="text-2xl font-bold mb-4">Tags AI Wrongly Suggests</h2>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {analytics.wrongTags.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No wrong suggestions data available yet
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Rank</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tag</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Category</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Count</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {analytics.wrongTags.map((tag, index) => (
                    <tr key={tag.tag} className={tag.percentage > 40 ? 'bg-orange-50' : ''}>
                      <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{tag.tag}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 capitalize">
                        {tag.category.replace('_', ' ')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                        {tag.count}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          tag.percentage > 40 ? 'bg-orange-100 text-orange-800' :
                          tag.percentage > 30 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {tag.percentage}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      {/* Confidence vs Accuracy Correlation */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Confidence vs Accuracy Correlation</h2>
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {analytics.confidenceBuckets.map(bucket => (
              <div key={bucket.range} className="text-center">
                <div className="text-sm font-semibold text-gray-600 mb-2">{bucket.range}</div>
                <div className="text-3xl font-bold text-gray-900 mb-2">{bucket.imageCount}</div>
                <div className="text-xs text-gray-500 mb-4">images</div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Avg corrections:</span>
                    <span className="font-medium">{bucket.avgCorrections}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Correction rate:</span>
                    <span className={`font-medium ${
                      bucket.correctionRate < 30 ? 'text-green-600' :
                      bucket.correctionRate < 60 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {bucket.correctionRate}%
                    </span>
                  </div>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      bucket.correctionRate < 30 ? 'bg-green-500' :
                      bucket.correctionRate < 60 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${bucket.correctionRate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Actionable Insights */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Actionable Insights</h2>
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
          <div className="space-y-3">
            {analytics.insights.map((insight, index) => (
              <div key={index} className="flex gap-3 items-start">
                <div className="text-lg">{insight.charAt(0)}</div>
                <div className="flex-1 text-sm text-gray-700 leading-relaxed">
                  {insight.substring(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Image-Level Analysis */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Image-Level Analysis</h2>
          <button
            onClick={handleExportPDF}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Export Report
          </button>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {analytics.imageAnalysis.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No image analysis data available yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Image</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Filename</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">AI Confidence</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Corrections</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Correction %</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {analytics.imageAnalysis.slice(0, 20).map(img => (
                    <tr key={img.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Image
                          src={img.thumbnail_path}
                          alt={img.original_filename}
                          width={60}
                          height={60}
                          className="rounded object-cover"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">
                        {img.original_filename}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          (img.ai_confidence_score || 0) >= 0.85 ? 'bg-green-100 text-green-800' :
                          (img.ai_confidence_score || 0) >= 0.70 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {((img.ai_confidence_score || 0) * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {img.corrections ? (
                          <div className="space-y-1">
                            {img.corrections.tags_added.length > 0 && (
                              <div className="text-green-600">
                                +{img.corrections.tags_added.length} added
                              </div>
                            )}
                            {img.corrections.tags_removed.length > 0 && (
                              <div className="text-red-600">
                                -{img.corrections.tags_removed.length} removed
                              </div>
                            )}
                            {img.corrections.tags_added.length === 0 &&
                             img.corrections.tags_removed.length === 0 && (
                              <div className="text-gray-400">None</div>
                            )}
                          </div>
                        ) : (
                          <div className="text-gray-400">No data</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          img.correctionPercentage === 0 ? 'bg-green-100 text-green-800' :
                          img.correctionPercentage < 30 ? 'bg-blue-100 text-blue-800' :
                          img.correctionPercentage < 60 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {img.correctionPercentage}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setSelectedImage(img)}
                          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {analytics.imageAnalysis.length > 20 && (
            <div className="p-4 bg-gray-50 text-center text-sm text-gray-600">
              Showing top 20 images with most corrections. {analytics.imageAnalysis.length - 20} more images available.
            </div>
          )}
        </div>
      </section>

      {/* Image Detail Modal */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold">Image Analysis Details</h3>
                <button
                  onClick={() => setSelectedImage(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Image
                    src={selectedImage.thumbnail_path}
                    alt={selectedImage.original_filename}
                    width={400}
                    height={400}
                    className="rounded-lg w-full object-cover"
                  />
                  <div className="mt-2 text-sm text-gray-600">{selectedImage.original_filename}</div>
                  <div className="mt-1 text-xs text-gray-500">
                    Tagged: {new Date(selectedImage.tagged_at).toLocaleDateString()}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-semibold text-gray-600 mb-1">AI Confidence</div>
                    <div className="text-2xl font-bold">
                      {((selectedImage.ai_confidence_score || 0) * 100).toFixed(1)}%
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-semibold text-gray-600 mb-2">AI Suggested Tags</div>
                    <div className="space-y-2 text-sm">
                      {selectedImage.ai_suggested_tags && Object.entries(selectedImage.ai_suggested_tags).map(([key, values]) => (
                        <div key={key}>
                          <span className="font-medium capitalize">{key}: </span>
                          <span className="text-gray-600">
                            {Array.isArray(values) ? values.join(', ') : 'None'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-semibold text-gray-600 mb-2">Actual Tags (Designer Selected)</div>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium">Industries: </span>
                        <span className="text-gray-600">{selectedImage.actual_tags.industries.join(', ') || 'None'}</span>
                      </div>
                      <div>
                        <span className="font-medium">Project Types: </span>
                        <span className="text-gray-600">{selectedImage.actual_tags.project_types.join(', ') || 'None'}</span>
                      </div>
                      <div>
                        <span className="font-medium">Styles: </span>
                        <span className="text-gray-600">{selectedImage.actual_tags.styles.join(', ') || 'None'}</span>
                      </div>
                      <div>
                        <span className="font-medium">Moods: </span>
                        <span className="text-gray-600">{selectedImage.actual_tags.moods.join(', ') || 'None'}</span>
                      </div>
                      <div>
                        <span className="font-medium">Elements: </span>
                        <span className="text-gray-600">{selectedImage.actual_tags.elements.join(', ') || 'None'}</span>
                      </div>
                    </div>
                  </div>

                  {selectedImage.corrections && (
                    <div>
                      <div className="text-sm font-semibold text-gray-600 mb-2">Corrections Made</div>
                      <div className="space-y-2 text-sm">
                        {selectedImage.corrections.tags_added.length > 0 && (
                          <div className="bg-green-50 border border-green-200 rounded p-2">
                            <div className="font-medium text-green-800">Tags Added ({selectedImage.corrections.tags_added.length})</div>
                            <div className="text-green-700">{selectedImage.corrections.tags_added.join(', ')}</div>
                          </div>
                        )}
                        {selectedImage.corrections.tags_removed.length > 0 && (
                          <div className="bg-red-50 border border-red-200 rounded p-2">
                            <div className="font-medium text-red-800">Tags Removed ({selectedImage.corrections.tags_removed.length})</div>
                            <div className="text-red-700">{selectedImage.corrections.tags_removed.join(', ')}</div>
                          </div>
                        )}
                        {selectedImage.corrections.tags_added.length === 0 &&
                         selectedImage.corrections.tags_removed.length === 0 && (
                          <div className="text-gray-500">No corrections made - AI was perfect!</div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t">
                    <Link
                      href={`/tagger/gallery`}
                      className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      View in Gallery
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
