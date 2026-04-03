'use client';

import { memo } from 'react';

interface TagCheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  aiSuggested?: boolean;
}

const TagCheckbox = memo(function TagCheckbox({
  label,
  checked,
  onChange,
  aiSuggested = false
}: TagCheckboxProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-1 px-3 py-1 text-sm rounded-full border transition-colors ${
        checked
          ? 'bg-blue-600 border-blue-500 text-white'
          : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-300'
      }`}
    >
      {label}
      {aiSuggested && <span className="text-[10px] font-medium uppercase opacity-70">ai</span>}
    </button>
  );
});

export default TagCheckbox;
