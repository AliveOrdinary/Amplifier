'use client';

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  stepLabels: string[];
}

export default function StepIndicator({ currentStep, totalSteps, stepLabels }: StepIndicatorProps) {
  return (
    <div className="w-full max-w-4xl mx-auto mb-8">
      <div className="flex items-center justify-between mb-4">
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
          <div key={step} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors
                  ${step === currentStep
                    ? 'bg-white text-black'
                    : step < currentStep
                    ? 'bg-white text-black'
                    : 'bg-gray-800 text-gray-400'
                  }`}
              >
                {step < currentStep ? '✓' : step}
              </div>
              <div className={`text-sm mt-2 text-center hidden md:block ${
                step === currentStep ? 'font-bold text-white' : 'text-gray-500'
              }`}>
                {stepLabels[step - 1]}
              </div>
            </div>
            {step < totalSteps && (
              <div
                className={`h-0.5 flex-1 mx-2 transition-colors ${
                  step < currentStep ? 'bg-white' : 'bg-gray-800'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <div className="text-center md:hidden">
        <p className="text-sm text-gray-400">
          Step {currentStep} of {totalSteps}: <span className="font-bold text-white">{stepLabels[currentStep - 1]}</span>
        </p>
      </div>
    </div>
  );
}
