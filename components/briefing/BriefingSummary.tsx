'use client';

import { useState } from 'react';
import type { QuestionnaireResponses, ArenaBlock, ReferenceImage } from '@/lib/types';

interface BriefingSummaryProps {
  responses: QuestionnaireResponses;
  keywords: string[];
  favoritedBlocks: ArenaBlock[];
  favoritedImages?: ReferenceImage[];
  onBack: () => void;
  onSubmit: () => void;
  isLoading: boolean;
}

export default function BriefingSummary({
  responses,
  keywords,
  favoritedBlocks,
  favoritedImages = [],
  onBack,
  onSubmit,
  isLoading,
}: BriefingSummaryProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  const sections = [
    {
      title: 'Client Information',
      items: [
        { label: 'Name', value: responses.clientName },
        { label: 'Email', value: responses.clientEmail },
        ...(responses.projectName ? [{ label: 'Project', value: responses.projectName }] : []),
      ],
    },
    {
      title: 'Brand Strategy & Positioning',
      items: [
        { label: 'Visual Approach', value: responses.visualApproach },
        { label: 'Creative Direction', value: responses.creativeDocuments },
        { label: 'Problem Solved', value: responses.problemSolved },
        { label: 'Deeper Reason', value: responses.deeperReason },
        { label: 'Customer Words', value: responses.customerWords },
        { label: 'Differentiators', value: responses.differentiators },
        ...(responses.strategicThoughts ? [{ label: 'Additional Thoughts', value: responses.strategicThoughts }] : []),
      ],
    },
    {
      title: 'Brand Personality & Tone',
      items: [
        { label: 'Dinner Party Behavior', value: responses.dinnerPartyBehavior },
        { label: 'Never Feel Like', value: responses.neverFeelLike },
        { label: 'Energy/Mood', value: responses.energyMood },
        { label: 'Soundtrack Genre', value: responses.soundtrackGenre },
        { label: 'Artists/Diversification', value: responses.artistsDiversification },
      ],
    },
    {
      title: 'Visual Identity & Style',
      items: [
        { label: 'Color Associations', value: responses.colorAssociations },
        { label: 'Visual Style', value: responses.visualStyle },
        { label: 'Admired Brands', value: responses.admiredBrands },
        { label: 'Aesthetic Inspiration', value: responses.aestheticInspiration },
        { label: 'Decolonization Approach', value: responses.decolonizationVisual },
      ],
    },
    {
      title: 'Target Audience',
      items: [
        { label: 'Audience Description', value: responses.audienceDescription },
        { label: 'Ideal Client', value: responses.idealClient },
        { label: 'Desired Feeling', value: responses.desiredFeeling },
        { label: 'Customer Frustrations', value: responses.customerFrustrations },
        ...(responses.avoidCustomerTypes ? [{ label: 'Avoid Customer Types', value: responses.avoidCustomerTypes }] : []),
        { label: 'Brand Role', value: responses.brandRole },
      ],
    },
    {
      title: 'Vision & Growth',
      items: [
        { label: '5-Year Vision', value: responses.fiveYearVision },
        { label: 'Expansion Plans', value: responses.expansionPlans },
        { label: 'Dream Partnerships', value: responses.dreamPartnerships },
        { label: 'Big Dream', value: responses.bigDream },
        { label: 'Success Beyond Sales', value: responses.successBeyondSales },
        { label: 'Long-term Focus', value: responses.longTermFocus },
        { label: 'Existing Collection', value: responses.existingCollection },
        { label: 'Competitors', value: responses.competitors },
      ],
    },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-rightserif font-bold mb-6 text-white">Review Your Briefing</h2>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-8">
        <p className="text-gray-300">
          Please review your responses before submitting. This briefing will be sent to the studio team along with your curated visual references.
        </p>
      </div>

      {/* Keywords */}
      <div className="mb-8 p-6 bg-gray-900 border-2 border-gray-800 rounded-lg">
        <h3 className="text-xl font-bold mb-4 text-white">Visual Keywords</h3>
        <div className="flex flex-wrap gap-2">
          {keywords.map((keyword, index) => (
            <span key={index} className="bg-white text-black px-4 py-2 rounded-full text-sm font-medium">
              {keyword}
            </span>
          ))}
        </div>
      </div>

      {/* Favorited Images */}
      {(favoritedImages.length > 0 || favoritedBlocks.length > 0) && (
        <div className="mb-8 p-6 bg-gray-900 border-2 border-gray-800 rounded-lg">
          <h3 className="text-xl font-bold mb-4 text-white">
            Selected Visual References ({favoritedImages.length > 0 ? favoritedImages.length : favoritedBlocks.length})
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {favoritedImages.length > 0 ? (
              favoritedImages.map(image => (
                <img
                  key={image.id}
                  src={image.thumbnail_path}
                  alt={image.original_filename}
                  className="w-full h-24 object-cover rounded-md border border-gray-700"
                />
              ))
            ) : (
              favoritedBlocks.map(block => (
                <img
                  key={block.id}
                  src={block.image?.thumb?.url || block.image?.display?.url || ''}
                  alt={block.title || 'Favorited image'}
                  className="w-full h-24 object-cover rounded-md border border-gray-700"
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* Collapsible Sections */}
      <div className="space-y-4 mb-8">
        {sections.map((section, index) => (
          <div key={index} className="border-2 border-gray-800 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection(section.title)}
              className="w-full px-6 py-4 bg-gray-900 hover:bg-gray-800 transition-colors flex items-center justify-between"
            >
              <h3 className="text-lg font-bold text-left text-white">{section.title}</h3>
              <span className="text-2xl text-white">{expandedSections.has(section.title) ? '−' : '+'}</span>
            </button>

            {expandedSections.has(section.title) && (
              <div className="px-6 py-4 bg-black border-t border-gray-800 space-y-4">
                {section.items.map((item, itemIndex) => (
                  <div key={itemIndex}>
                    <p className="font-medium text-white mb-1">{item.label}</p>
                    <p className="text-gray-300 pl-4 border-l-2 border-gray-700">{item.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center pt-6 border-t-2 border-gray-800">
        <button
          onClick={onBack}
          disabled={isLoading}
          className="px-6 py-3 border-2 border-white text-white rounded-md hover:bg-gray-900 transition-colors font-bold disabled:opacity-50"
        >
          ← Back to Gallery
        </button>

        {isLoading ? (
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
            <span className="text-gray-400">Submitting...</span>
          </div>
        ) : (
          <button
            onClick={onSubmit}
            className="px-8 py-3 bg-white text-black rounded-md hover:bg-gray-200 transition-colors font-bold"
          >
            Submit Briefing
          </button>
        )}
      </div>
    </div>
  );
}
