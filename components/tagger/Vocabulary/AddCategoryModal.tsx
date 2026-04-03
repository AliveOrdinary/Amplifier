'use client'

interface AddCategoryModalProps {
  newCategory: {
    key: string
    label: string
    storage_type: 'array' | 'jsonb_array' | 'text'
    storage_path: string
    search_weight: number
    description: string
    placeholder: string
  }
  setNewCategory: (category: any) => void
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export default function AddCategoryModal({ newCategory, setNewCategory, onSubmit, onClose }: AddCategoryModalProps) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-lg max-w-3xl w-full border border-gray-800 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">Add New Category</h2>
          <p className="text-gray-300 mt-2">Configure a new category for organizing your tags</p>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1">
          <form id="add-category-form" onSubmit={onSubmit} className="px-8 py-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Category Key *
            </label>
            <p className="text-xs text-gray-400 mb-2">
              Lowercase with underscores only (e.g., &quot;color_palette&quot;)
            </p>
            <input
              type="text"
              value={newCategory.key}
              onChange={(e) => setNewCategory({
                ...newCategory,
                key: e.target.value.toLowerCase().replace(/[^a-z_]/g, '')
              })}
              placeholder="color_palette"
              className="w-full border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono bg-gray-900 text-white placeholder-gray-500 transition-colors"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Display Label *
            </label>
            <input
              type="text"
              value={newCategory.label}
              onChange={(e) => setNewCategory({...newCategory, label: e.target.value})}
              placeholder="Color Palette"
              className="w-full border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-900 text-white placeholder-gray-500 transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Storage Type *
            </label>
            <select
              value={newCategory.storage_type}
              onChange={(e) => setNewCategory({
                ...newCategory,
                storage_type: e.target.value as 'array' | 'jsonb_array' | 'text'
              })}
              className="w-full border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-900 text-white font-semibold transition-colors cursor-pointer"
              required
            >
              <option value="jsonb_array">JSONB Array (for nested in tags.*)</option>
              <option value="array">Array (for direct fields)</option>
              <option value="text">Text (for notes/descriptions)</option>
            </select>
            <div className="mt-3 p-3 bg-gray-950 border border-gray-800 rounded-lg">
              <p className="text-sm text-blue-300 leading-relaxed">
                <span className="font-medium">Array:</span> Direct database field (e.g., industries)<br/>
                <span className="font-medium">JSONB Array:</span> Nested in tags field (e.g., tags.style)<br/>
                <span className="font-medium">Text:</span> Single text field (e.g., notes)
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Storage Path *
            </label>
            <p className="text-xs text-gray-400 mb-2">
              {newCategory.storage_type === 'jsonb_array'
                ? 'Use format: tags.your_category_key'
                : 'Use format: your_category_key'}
            </p>
            <input
              type="text"
              value={newCategory.storage_path}
              onChange={(e) => setNewCategory({...newCategory, storage_path: e.target.value})}
              placeholder={
                newCategory.storage_type === 'jsonb_array'
                  ? 'tags.color_palette'
                  : 'color_palette'
              }
              className="w-full border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono bg-gray-900 text-white placeholder-gray-500 transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Search Weight *
            </label>
            <p className="text-xs text-gray-400 mb-2">
              1-10, higher = more important in search
            </p>
            <input
              type="number"
              min="1"
              max="10"
              value={newCategory.search_weight}
              onChange={(e) => setNewCategory({
                ...newCategory,
                search_weight: parseInt(e.target.value, 10) || 1
              })}
              className="w-full border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-900 text-white placeholder-gray-500 transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
              <span className="text-gray-400 text-xs font-normal ml-2 lowercase">(optional)</span>
            </label>
            <textarea
              value={newCategory.description}
              onChange={(e) => setNewCategory({...newCategory, description: e.target.value})}
              placeholder="What this category is for..."
              className="w-full border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-900 text-white placeholder-gray-500 transition-colors resize-none"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Placeholder
              <span className="text-gray-400 text-xs font-normal ml-2 lowercase">(optional)</span>
            </label>
            <input
              type="text"
              value={newCategory.placeholder}
              onChange={(e) => setNewCategory({...newCategory, placeholder: e.target.value})}
              placeholder="e.g., warm, cool, vibrant..."
              className="w-full border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-900 text-white placeholder-gray-500 transition-colors"
            />
          </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-gray-950 rounded-b-lg border-t border-gray-800">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="add-category-form"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Add Category
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
