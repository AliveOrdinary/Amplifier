'use client';

interface QuestionStepProps {
  question: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  helpText?: string;
  type?: 'text' | 'textarea' | 'email';
}

export default function QuestionStep({
  question,
  value,
  onChange,
  placeholder,
  required = true,
  helpText,
  type = 'textarea'
}: QuestionStepProps) {
  const inputClasses = "w-full px-4 py-3 border border-gray-700 bg-gray-950 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors placeholder:text-gray-500";

  return (
    <div className="mb-8">
      <label className="block mb-3">
        <span className="text-lg font-medium text-white">
          {question}
          {required && <span className="text-red-400 ml-1">*</span>}
        </span>
        {helpText && (
          <span className="block text-sm text-gray-400 mt-1">{helpText}</span>
        )}
      </label>

      {type === 'textarea' ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          rows={3}
          className={`${inputClasses} resize-y`}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className={inputClasses}
        />
      )}
    </div>
  );
}
