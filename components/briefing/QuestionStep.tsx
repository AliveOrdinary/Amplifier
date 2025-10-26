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
  const inputClasses = "w-full px-4 py-3 border-2 border-gray-700 bg-black text-white rounded-md focus:border-white focus:outline-none transition-colors font-montreal placeholder:text-gray-500";

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
          rows={6}
          className={`${inputClasses} resize-y min-h-[120px]`}
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
