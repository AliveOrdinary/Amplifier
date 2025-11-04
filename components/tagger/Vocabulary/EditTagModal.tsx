'use client'

import { useState } from 'react'
import { ErrorMessages, getErrorMessage } from '@/lib/error-messages'
import { Modal, ModalHeader, ModalContent, ModalFooter, Button, ButtonGroup, useToast } from '@/components/ui'

interface VocabularyTag {
  id: string
  category: string
  tag_value: string
  description: string | null
  sort_order: number
  is_active: boolean
  times_used: number
  last_used_at: string | null
  created_at: string
}

interface EditTagModalProps {
  tag: VocabularyTag
  onClose: () => void
  onSave: (updatedTag: VocabularyTag) => void
  supabase: any
}

export default function EditTagModal({ tag, onClose, onSave, supabase }: EditTagModalProps) {
  const [tagValue, setTagValue] = useState(tag.tag_value)
  const [description, setDescription] = useState(tag.description || '')
  const [isSaving, setIsSaving] = useState(false)
  const toast = useToast()

  const handleSave = async () => {
    setIsSaving(true)

    const { data, error } = await supabase
      .from('tag_vocabulary')
      .update({
        tag_value: tagValue,
        description: description || null
      })
      .eq('id', tag.id)
      .select()
      .single()

    if (error) {
      console.error('Failed to update tag:', error)
      toast.error('Failed to update tag', getErrorMessage(error, ErrorMessages.TAG_UPDATE_FAILED))
      setIsSaving(false)
      return
    }

    toast.success('Tag updated successfully', `Updated "${tagValue}"`)
    onSave(data)
    onClose()
  }

  return (
    <Modal isOpen={true} onClose={onClose} size="md">
      <ModalHeader title="Edit Tag" icon="✏️" onClose={onClose} />

      <ModalContent>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white mb-1">
              Tag Name
            </label>
            <input
              type="text"
              value={tagValue}
              onChange={(e) => setTagValue(e.target.value)}
              className="w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
              placeholder="Add a description for this tag..."
            />
          </div>
        </div>
      </ModalContent>

      <ModalFooter>
        <ButtonGroup>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            variant="success"
            onClick={handleSave}
            disabled={!tagValue.trim()}
            isLoading={isSaving}
            loadingText="Saving..."
          >
            Save Changes
          </Button>
        </ButtonGroup>
      </ModalFooter>
    </Modal>
  )
}
