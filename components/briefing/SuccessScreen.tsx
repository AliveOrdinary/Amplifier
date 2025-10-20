'use client';

import Link from 'next/link';

interface SuccessScreenProps {
  onReset: () => void;
}

export default function SuccessScreen({ onReset }: SuccessScreenProps) {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="max-w-2xl mx-auto text-center">
        <div className="mb-8">
          <div className="inline-block p-4 bg-green-900 rounded-full mb-6">
            <svg
              className="w-16 h-16 text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <h1 className="text-4xl font-rightserif font-bold mb-4 text-white">
            Briefing Submitted Successfully!
          </h1>

          <p className="text-lg text-gray-300 mb-2">
            Thank you for completing the visual briefing.
          </p>
          <p className="text-gray-400">
            We've sent your responses and curated visual references to the studio team. They'll be in touch soon to discuss your project.
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-8">
          <h3 className="font-bold text-lg mb-2 text-white">What happens next?</h3>
          <ul className="text-left space-y-2 text-gray-300">
            <li className="flex items-start">
              <span className="mr-2">1.</span>
              <span>The studio team will review your briefing and visual references</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">2.</span>
              <span>You'll receive a follow-up email within 2-3 business days</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">3.</span>
              <span>We'll schedule a discovery call to discuss your project in detail</span>
            </li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={onReset}
            className="px-8 py-3 border-2 border-white text-white rounded-md hover:bg-gray-900 transition-colors font-bold"
          >
            Start New Briefing
          </button>

          <Link
            href="/"
            className="px-8 py-3 bg-white text-black rounded-md hover:bg-gray-200 transition-colors font-bold inline-block"
          >
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}
