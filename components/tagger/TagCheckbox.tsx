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
        className="w-4 h-4 text-black border-gray-300 rounded focus:ring-2 focus:ring-black cursor-pointer"
      />
      <span className={`text-sm group-hover:text-gray-900 select-none flex items-center gap-1.5 ${
        aiSuggested ? 'text-blue-700 font-medium' : 'text-gray-700'
      }`}>
        {aiSuggested && <span className="text-xs">✨</span>}
        {label}
      </span>
    </label>
  );
});

export default TagCheckbox;
