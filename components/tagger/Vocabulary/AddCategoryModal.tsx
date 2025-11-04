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
      <div className="bg-gray-800 rounded-2xl max-w-3xl w-full shadow-2xl border-2 border-gray-700 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-8 py-6 border-b-2 border-gray-700">
          <h2 className="text-3xl font-bold text-white">📂 Add New Category</h2>
          <p className="text-gray-300 mt-2">Configure a new category for organizing your tags</p>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1">
          <form id="add-category-form" onSubmit={onSubmit} className="px-8 py-6 space-y-6">
          <div>
            <label className="block text-sm font-bold text-white mb-3 uppercase tracking-wide">
              Category Key *
            </label>
            <p className="text-xs text-gray-400 mb-2">
              💡 Lowercase with underscores only (e.g., "color_palette")
            </p>
            <input
              type="text"
              value={newCategory.key}
              onChange={(e) => setNewCategory({
                ...newCategory,
                key: e.target.value.toLowerCase().replace(/[^a-z_]/g, '')
              })}
              placeholder="color_palette"
              className="w-full border-2 border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-mono bg-gray-900 text-white placeholder-gray-500 transition-all hover:border-gray-500"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-white mb-3 uppercase tracking-wide">
              Display Label *
            </label>
            <input
              type="text"
              value={newCategory.label}
              onChange={(e) => setNewCategory({...newCategory, label: e.target.value})}
              placeholder="Color Palette"
              className="w-full border-2 border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-gray-900 text-white placeholder-gray-500 transition-all hover:border-gray-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-white mb-3 uppercase tracking-wide">
              Storage Type *
            </label>
            <select
              value={newCategory.storage_type}
              onChange={(e) => setNewCategory({
                ...newCategory,
                storage_type: e.target.value as 'array' | 'jsonb_array' | 'text'
              })}
              className="w-full border-2 border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-gray-900 text-white font-semibold transition-all hover:border-gray-500 cursor-pointer"
              required
            >
              <option value="jsonb_array">JSONB Array (for nested in tags.*)</option>
              <option value="array">Array (for direct fields)</option>
              <option value="text">Text (for notes/descriptions)</option>
            </select>
            <div className="mt-3 p-4 bg-blue-900/50 border-2 border-blue-600 rounded-lg">
              <p className="text-sm text-blue-300 leading-relaxed">
                <span className="font-bold">Array:</span> Direct database field (e.g., industries)<br/>
                <span className="font-bold">JSONB Array:</span> Nested in tags field (e.g., tags.style)<br/>
                <span className="font-bold">Text:</span> Single text field (e.g., notes)
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-white mb-3 uppercase tracking-wide">
              Storage Path *
            </label>
            <p className="text-xs text-gray-400 mb-2">
              {newCategory.storage_type === 'jsonb_array'
                ? '💡 Use format: tags.your_category_key'
                : '💡 Use format: your_category_key'}
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
              className="w-full border-2 border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-mono bg-gray-900 text-white placeholder-gray-500 transition-all hover:border-gray-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-white mb-3 uppercase tracking-wide">
              Search Weight *
            </label>
            <p className="text-xs text-gray-400 mb-2">
              🔍 1-10, higher = more important in search
            </p>
            <input
              type="number"
              min="1"
              max="10"
              value={newCategory.search_weight}
              onChange={(e) => setNewCategory({
                ...newCategory,
                search_weight: parseInt(e.target.value)
              })}
              className="w-full border-2 border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-gray-900 text-white placeholder-gray-500 transition-all hover:border-gray-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-white mb-3 uppercase tracking-wide">
              Description
              <span className="text-gray-400 text-xs font-normal ml-2 lowercase">(optional)</span>
            </label>
            <textarea
              value={newCategory.description}
              onChange={(e) => setNewCategory({...newCategory, description: e.target.value})}
              placeholder="What this category is for..."
              className="w-full border-2 border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-gray-900 text-white placeholder-gray-500 transition-all hover:border-gray-500 resize-none"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-white mb-3 uppercase tracking-wide">
              Placeholder
              <span className="text-gray-400 text-xs font-normal ml-2 lowercase">(optional)</span>
            </label>
            <input
              type="text"
              value={newCategory.placeholder}
              onChange={(e) => setNewCategory({...newCategory, placeholder: e.target.value})}
              placeholder="e.g., warm, cool, vibrant..."
              className="w-full border-2 border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-gray-900 text-white placeholder-gray-500 transition-all hover:border-gray-500"
            />
          </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 bg-gray-900 rounded-b-2xl border-t-2 border-gray-700">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-700 border-2 border-gray-600 text-white rounded-lg hover:bg-gray-600 hover:border-gray-500 transition-all font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="add-category-form"
              className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 hover:shadow-lg transition-all font-semibold"
            >
              ✓ Add Category
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
