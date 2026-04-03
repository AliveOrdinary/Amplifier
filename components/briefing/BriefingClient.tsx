'use client';

import { useState, useEffect } from 'react';
import StepIndicator from './StepIndicator';
import QuestionStep from './QuestionStep';
import KeywordExtraction from './KeywordExtraction';
import KeywordEditor from './KeywordEditor';
import ImageGallery from './ImageGallery';
import BriefingSummary from './BriefingSummary';
import SuccessScreen from './SuccessScreen';
import type { QuestionnaireResponses, ReferenceImage } from '@/lib/types';

const STEP_LABELS = [
  'Client Info',
  'Strategy',
  'Personality',
  'Visual Style',
  'Audience',
  'Vision',
  'Keywords',
  'Gallery',
  'Review',
  'Submit'
];

const STORAGE_KEY = 'briefing_progress';

export default function BriefingClient() {
  const [currentStep, setCurrentStep] = useState(1);
  const [responses, setResponses] = useState<QuestionnaireResponses>({
    clientName: '',
    clientEmail: '',
    projectName: '',
    visualApproach: '',
    creativeDocuments: '',
    problemSolved: '',
    deeperReason: '',
    customerWords: '',
    differentiators: '',
    strategicThoughts: '',
    dinnerPartyBehavior: '',
    neverFeelLike: '',
    energyMood: '',
    soundtrackGenre: '',
    artistsDiversification: '',
    colorAssociations: '',
    visualStyle: '',
    admiredBrands: '',
    aestheticInspiration: '',
    decolonizationVisual: '',
    audienceDescription: '',
    idealClient: '',
    desiredFeeling: '',
    customerFrustrations: '',
    avoidCustomerTypes: '',
    brandRole: '',
    fiveYearVision: '',
    expansionPlans: '',
    dreamPartnerships: '',
    bigDream: '',
    successBeyondSales: '',
    longTermFocus: '',
    existingCollection: '',
    competitors: '',
  });

  const [extractedKeywords, setExtractedKeywords] = useState<string[]>([]);
  const [editedKeywords, setEditedKeywords] = useState<string[]>([]);
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [favoritedImageIds, setFavoritedImageIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [savedProgress, setSavedProgress] = useState<{
    currentStep: number;
    responses: QuestionnaireResponses;
    extractedKeywords: string[];
    editedKeywords: string[];
  } | null>(null);

  // Auto-save progress to localStorage
  useEffect(() => {
    if (currentStep > 1 && !isSubmitted) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ currentStep, responses, extractedKeywords, editedKeywords }));
    }
  }, [currentStep, responses, extractedKeywords, editedKeywords, isSubmitted]);

  // Load saved progress
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSavedProgress(parsed);
      } catch {
        console.error('Failed to load saved progress');
      }
    }
  }, []);

  const handleRestoreProgress = () => {
    if (savedProgress) {
      setCurrentStep(savedProgress.currentStep);
      setResponses(savedProgress.responses);
      setExtractedKeywords(savedProgress.extractedKeywords || []);
      setEditedKeywords(savedProgress.editedKeywords || []);
      setSavedProgress(null);
    }
  };

  const handleDiscardProgress = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSavedProgress(null);
  };

  const updateResponse = (field: keyof QuestionnaireResponses, value: string) => {
    setResponses(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    setCurrentStep(prev => prev + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExtractKeywords = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/extract-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses }),
      });

      const data = await response.json();

      if (data.keywords && data.keywords.length > 0) {
        setExtractedKeywords(data.keywords);
        setEditedKeywords(data.keywords);
        handleNext();
      } else {
        setError('Failed to extract keywords. Please try again.');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchReferences = async (keywords: string[]) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/search-references', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords }),
      });

      const data = await response.json();

      if (data.images && data.images.length > 0) {
        setReferenceImages(data.images);
        setEditedKeywords(keywords);
        handleNext();
      } else if (data.warning) {
        // Empty database - show empty state but allow to continue
        setReferenceImages([]);
        setEditedKeywords(keywords);
        handleNext();
      } else {
        setError(data.error || 'No images found. Try editing the keywords.');
      }
    } catch (err) {
      setError('Failed to search images. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/send-briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          briefingData: {
            responses,
            extractedKeywords,
            editedKeywords,
            referenceImages,
            favoritedImageIds,
            timestamp: new Date().toISOString(),
          },
        }),
      });

      const data = await response.json();

      if (data.success) {
        setIsSubmitted(true);
        localStorage.removeItem(STORAGE_KEY);
        handleNext();
      } else {
        setError(data.message || 'Failed to submit briefing.');
      }
    } catch (err) {
      setError('Failed to submit. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setCurrentStep(1);
    setResponses({
      clientName: '',
      clientEmail: '',
      projectName: '',
      visualApproach: '',
      creativeDocuments: '',
      problemSolved: '',
      deeperReason: '',
      customerWords: '',
      differentiators: '',
      strategicThoughts: '',
      dinnerPartyBehavior: '',
      neverFeelLike: '',
      energyMood: '',
      soundtrackGenre: '',
      artistsDiversification: '',
      colorAssociations: '',
      visualStyle: '',
      admiredBrands: '',
      aestheticInspiration: '',
      decolonizationVisual: '',
      audienceDescription: '',
      idealClient: '',
      desiredFeeling: '',
      customerFrustrations: '',
      avoidCustomerTypes: '',
      brandRole: '',
      fiveYearVision: '',
      expansionPlans: '',
      dreamPartnerships: '',
      bigDream: '',
      successBeyondSales: '',
      longTermFocus: '',
      existingCollection: '',
      competitors: '',
    });
    setExtractedKeywords([]);
    setEditedKeywords([]);
    setReferenceImages([]);
    setFavoritedImageIds([]);
    setIsSubmitted(false);
    setError(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  if (isSubmitted) {
    return <SuccessScreen onReset={resetForm} />;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <StepIndicator currentStep={currentStep} totalSteps={10} stepLabels={STEP_LABELS} />

        {error && (
          <div className="bg-red-900/50 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {savedProgress && (
          <div className="bg-gray-900 border border-gray-700 rounded-lg px-5 py-4 mb-6 flex items-center justify-between gap-4">
            <p className="text-sm text-gray-300">You have saved progress from a previous session.</p>
            <div className="flex gap-3 shrink-0">
              <button
                onClick={handleDiscardProgress}
                className="px-4 py-2 text-sm border border-gray-600 text-gray-400 rounded-lg hover:text-white hover:border-gray-400 transition-colors"
              >
                Start Fresh
              </button>
              <button
                onClick={handleRestoreProgress}
                className="px-4 py-2 text-sm bg-white text-black rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {renderStep()}
      </div>
    </div>
  );

  function renderStep() {
    switch (currentStep) {
      case 1:
        return renderClientInfo();
      case 2:
        return renderStrategyQuestions();
      case 3:
        return renderPersonalityQuestions();
      case 4:
        return renderVisualStyleQuestions();
      case 5:
        return renderAudienceQuestions();
      case 6:
        return renderVisionQuestions();
      case 7:
        return <KeywordExtraction onExtract={handleExtractKeywords} isLoading={isLoading} />;
      case 8:
        return (
          <KeywordEditor
            keywords={editedKeywords}
            onChange={setEditedKeywords}
            onSearch={handleSearchReferences}
            isLoading={isLoading}
          />
        );
      case 9:
        return (
          <ImageGallery
            referenceImages={referenceImages}
            favoritedImageIds={favoritedImageIds}
            onToggleFavoriteImage={(id) => {
              setFavoritedImageIds(prev =>
                prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
              );
            }}
            onRegenerate={() => setCurrentStep(8)}
            onNext={handleNext}
          />
        );
      case 10:
        return (
          <BriefingSummary
            responses={responses}
            keywords={editedKeywords.length > 0 ? editedKeywords : extractedKeywords}
            favoritedImages={referenceImages.filter(img => favoritedImageIds.includes(img.id))}
            onBack={handleBack}
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />
        );
      default:
        return null;
    }
  }

  function renderClientInfo() {
    return (
      <form onSubmit={(e) => { e.preventDefault(); handleNext(); }} className="space-y-6">
        <h2 className="text-3xl font-rightserif font-bold mb-6">Let&apos;s get started</h2>
        <QuestionStep
          question="Your Name"
          value={responses.clientName}
          onChange={(v) => updateResponse('clientName', v)}
          type="text"
          placeholder="Jane Doe"
        />
        <QuestionStep
          question="Email Address"
          value={responses.clientEmail}
          onChange={(v) => updateResponse('clientEmail', v)}
          type="email"
          placeholder="jane@example.com"
        />
        <QuestionStep
          question="Project Name"
          value={responses.projectName || ''}
          onChange={(v) => updateResponse('projectName', v)}
          type="text"
          placeholder="Museum Rebrand 2025"
          required={false}
          helpText="Optional"
        />
        <div className="flex justify-end pt-6">
          <button type="submit" className="px-8 py-3 bg-white text-black rounded-lg hover:bg-gray-200 transition-colors font-medium">
            Next
          </button>
        </div>
      </form>
    );
  }

  function renderStrategyQuestions() {
    return (
      <form onSubmit={(e) => { e.preventDefault(); handleNext(); }} className="space-y-6">
        <h2 className="text-3xl font-rightserif font-bold mb-6">Brand Strategy & Positioning</h2>
        <QuestionStep
          question="Do you personally think the new brand should be disruptive visually or instead be quiet and simple and let the disruption come through the new collection and messaging?"
          value={responses.visualApproach}
          onChange={(v) => updateResponse('visualApproach', v)}
        />
        <QuestionStep
          question="Do you have any creative sentences or documents written about the new direction?"
          value={responses.creativeDocuments}
          onChange={(v) => updateResponse('creativeDocuments', v)}
        />
        <QuestionStep
          question="What problem does your brand solve in people's lives?"
          value={responses.problemSolved}
          onChange={(v) => updateResponse('problemSolved', v)}
        />
        <QuestionStep
          question="Why did you start this business, what's the deeper reason beyond profit?"
          value={responses.deeperReason}
          onChange={(v) => updateResponse('deeperReason', v)}
        />
        <QuestionStep
          question="How would your customers describe your product/service in three words?"
          value={responses.customerWords}
          onChange={(v) => updateResponse('customerWords', v)}
        />
        <QuestionStep
          question="What makes you truly different from your competitors?"
          value={responses.differentiators}
          onChange={(v) => updateResponse('differentiators', v)}
        />
        <QuestionStep
          question="Any additional strategic thoughts?"
          value={responses.strategicThoughts || ''}
          onChange={(v) => updateResponse('strategicThoughts', v)}
          required={false}
        />
        <div className="flex justify-between pt-6">
          <button type="button" onClick={handleBack} className="px-8 py-3 border border-gray-600 text-gray-300 rounded-lg hover:text-white hover:border-gray-400 transition-colors font-medium">
            Back
          </button>
          <button type="submit" className="px-8 py-3 bg-white text-black rounded-lg hover:bg-gray-200 transition-colors font-medium">
            Next
          </button>
        </div>
      </form>
    );
  }

  function renderPersonalityQuestions() {
    return (
      <form onSubmit={(e) => { e.preventDefault(); handleNext(); }} className="space-y-6">
        <h2 className="text-3xl font-rightserif font-bold mb-6">Brand Personality & Tone</h2>
        <QuestionStep
          question="If your brand were a person, how would they behave at a dinner party?"
          value={responses.dinnerPartyBehavior}
          onChange={(v) => updateResponse('dinnerPartyBehavior', v)}
        />
        <QuestionStep
          question="What should your brand NEVER feel like to people?"
          value={responses.neverFeelLike}
          onChange={(v) => updateResponse('neverFeelLike', v)}
        />
        <QuestionStep
          question="What kind of energy or mood should your brand communicate?"
          value={responses.energyMood}
          onChange={(v) => updateResponse('energyMood', v)}
        />
        <QuestionStep
          question="If your brand had a soundtrack, what genre would it be?"
          value={responses.soundtrackGenre}
          onChange={(v) => updateResponse('soundtrackGenre', v)}
        />
        <QuestionStep
          question="Can you tell us which artists you're looking to add to the collection and exhibitions to diversify the collection and programming?"
          value={responses.artistsDiversification}
          onChange={(v) => updateResponse('artistsDiversification', v)}
        />
        <div className="flex justify-between pt-6">
          <button type="button" onClick={handleBack} className="px-8 py-3 border border-gray-600 text-gray-300 rounded-lg hover:text-white hover:border-gray-400 transition-colors font-medium">
            Back
          </button>
          <button type="submit" className="px-8 py-3 bg-white text-black rounded-lg hover:bg-gray-200 transition-colors font-medium">
            Next
          </button>
        </div>
      </form>
    );
  }

  function renderVisualStyleQuestions() {
    return (
      <form onSubmit={(e) => { e.preventDefault(); handleNext(); }} className="space-y-6">
        <h2 className="text-3xl font-rightserif font-bold mb-6">Visual Identity & Style</h2>
        <QuestionStep
          question="What colours do you instinctively associate with your brand? Any you want to avoid?"
          value={responses.colorAssociations}
          onChange={(v) => updateResponse('colorAssociations', v)}
        />
        <QuestionStep
          question="Do you prefer clean and minimalist visuals, or rich and layered ones?"
          value={responses.visualStyle}
          onChange={(v) => updateResponse('visualStyle', v)}
        />
        <QuestionStep
          question="What brands do you admire visually even outside your industry?"
          value={responses.admiredBrands}
          onChange={(v) => updateResponse('admiredBrands', v)}
        />
        <QuestionStep
          question="Is there a specific era, cultural reference, movie or aesthetic that inspires you?"
          value={responses.aestheticInspiration}
          onChange={(v) => updateResponse('aestheticInspiration', v)}
        />
        <QuestionStep
          question="How should the brand visually communicate the departure from an Anglo-Western centric narrative of the Museum to a de-colonizing one? Would you like this to be visually clear or hinted at?"
          value={responses.decolonizationVisual}
          onChange={(v) => updateResponse('decolonizationVisual', v)}
        />
        <div className="flex justify-between pt-6">
          <button type="button" onClick={handleBack} className="px-8 py-3 border border-gray-600 text-gray-300 rounded-lg hover:text-white hover:border-gray-400 transition-colors font-medium">
            Back
          </button>
          <button type="submit" className="px-8 py-3 bg-white text-black rounded-lg hover:bg-gray-200 transition-colors font-medium">
            Next
          </button>
        </div>
      </form>
    );
  }

  function renderAudienceQuestions() {
    return (
      <form onSubmit={(e) => { e.preventDefault(); handleNext(); }} className="space-y-6">
        <h2 className="text-3xl font-rightserif font-bold mb-6">Target Audience</h2>
        <QuestionStep
          question="Can you tell us more about your audience? Students, faculty, researchers, local Hamilton community, national art audience? How will your audience react to your new Mission and Vision?"
          value={responses.audienceDescription}
          onChange={(v) => updateResponse('audienceDescription', v)}
        />
        <QuestionStep
          question="Describe your ideal client or customer."
          value={responses.idealClient}
          onChange={(v) => updateResponse('idealClient', v)}
        />
        <QuestionStep
          question="What do you want your audience to feel when they discover your brand?"
          value={responses.desiredFeeling}
          onChange={(v) => updateResponse('desiredFeeling', v)}
        />
        <QuestionStep
          question="What frustrates your ideal customer?"
          value={responses.customerFrustrations}
          onChange={(v) => updateResponse('customerFrustrations', v)}
        />
        <QuestionStep
          question="Are there customer types you do not want to attract?"
          value={responses.avoidCustomerTypes || ''}
          onChange={(v) => updateResponse('avoidCustomerTypes', v)}
          required={false}
        />
        <QuestionStep
          question="What role does your brand play in your customers' lives (e.g., guide, friend, expert)?"
          value={responses.brandRole}
          onChange={(v) => updateResponse('brandRole', v)}
        />
        <div className="flex justify-between pt-6">
          <button type="button" onClick={handleBack} className="px-8 py-3 border border-gray-600 text-gray-300 rounded-lg hover:text-white hover:border-gray-400 transition-colors font-medium">
            Back
          </button>
          <button type="submit" className="px-8 py-3 bg-white text-black rounded-lg hover:bg-gray-200 transition-colors font-medium">
            Next
          </button>
        </div>
      </form>
    );
  }

  function renderVisionQuestions() {
    return (
      <form onSubmit={(e) => { e.preventDefault(); handleNext(); }} className="space-y-6">
        <h2 className="text-3xl font-rightserif font-bold mb-6">Vision & Growth</h2>
        <QuestionStep
          question="Where do you want the brand to be in 5 years?"
          value={responses.fiveYearVision}
          onChange={(v) => updateResponse('fiveYearVision', v)}
        />
        <QuestionStep
          question="Do you plan to expand your product or service offering?"
          value={responses.expansionPlans}
          onChange={(v) => updateResponse('expansionPlans', v)}
        />
        <QuestionStep
          question="Is there a dream partnership or collaboration that would feel 'just right'?"
          value={responses.dreamPartnerships}
          onChange={(v) => updateResponse('dreamPartnerships', v)}
        />
        <QuestionStep
          question="What's a big dream or milestone you'd love to reach as a brand?"
          value={responses.bigDream}
          onChange={(v) => updateResponse('bigDream', v)}
        />
        <QuestionStep
          question="What does success look like for you, beyond sales?"
          value={responses.successBeyondSales}
          onChange={(v) => updateResponse('successBeyondSales', v)}
        />
        <QuestionStep
          question="Will the focus of the Museum be geared towards these new statements for the permanent future? Should the brand also encompass other future thoughts?"
          value={responses.longTermFocus}
          onChange={(v) => updateResponse('longTermFocus', v)}
        />
        <QuestionStep
          question="How will the existing collection exist within this new narrative? Will it be questioned or presented as it has been so far?"
          value={responses.existingCollection}
          onChange={(v) => updateResponse('existingCollection', v)}
        />
        <QuestionStep
          question="Who are your main competitors? Local galleries? Educational Institutions?"
          value={responses.competitors}
          onChange={(v) => updateResponse('competitors', v)}
        />
        <div className="flex justify-between pt-6">
          <button type="button" onClick={handleBack} className="px-8 py-3 border border-gray-600 text-gray-300 rounded-lg hover:text-white hover:border-gray-400 transition-colors font-medium">
            Back
          </button>
          <button type="submit" className="px-8 py-3 bg-white text-black rounded-lg hover:bg-gray-200 transition-colors font-medium">
            Next
          </button>
        </div>
      </form>
    );
  }
}
