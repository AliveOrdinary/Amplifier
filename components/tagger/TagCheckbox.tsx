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
    <label className="flex items-center space-x-2 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 text-blue-600 border-gray-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer bg-gray-900"
      />
      <span className={`text-sm group-hover:text-white select-none flex items-center gap-1.5 ${
        aiSuggested ? 'text-blue-400 font-medium' : 'text-gray-300'
      }`}>
        {aiSuggested && <span className="text-xs">✨</span>}
        {label}
      </span>
    </label>
  );
});

export default TagCheckbox;
