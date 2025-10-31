'use client'

import { useState, useCallback } from 'react'
import { generateFileHash, generatePerceptualHash, getFileSize, formatFileSize } from '@/lib/file-hash'
import type { UseImageUploadReturn, UploadedImage } from './useImageUpload'

// File validation constants
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const DEFAULT_VALID_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

export interface DuplicateCheckData {
  file: File
  fileHash: string
  fileSize: number
  perceptualHash: string
  existingImage: any
  matchType: 'exact' | 'similar' | 'filename'
  confidence: number
  message: string
}

export interface UseDuplicateDetectionParams {
  imageUploadHook: UseImageUploadReturn
  maxFileSize?: number
  validTypes?: string[]
}

export interface UseDuplicateDetectionReturn {
  duplicateData: DuplicateCheckData | null
  isChecking: boolean
  checkFiles: (files: File[]) => Promise<void>
  skipDuplicate: () => Promise<void>
  keepDuplicate: () => Promise<void>
  viewExisting: () => void
}

/**
 * Hook to manage duplicate detection workflow with hash generation
 *
 * Features:
 * - File type and size validation
 * - SHA-256 content hash generation (exact duplicates)
 * - Perceptual hash generation (visual similarity)
 * - API-based duplicate checking
 * - User decision workflow (skip/keep/view)
 * - Pending files queue management
 *
 * @param params - Configuration and dependencies
 * @returns {UseDuplicateDetectionReturn} Duplicate detection state and functions
 *
 * @example
 * ```tsx
 * const duplicateDetection = useDuplicateDetection({
 *   imageUploadHook: imageUpload
 * })
 *
 * // Process files with duplicate checking
 * await duplicateDetection.checkFiles(fileArray)
 *
 * // User chooses to skip duplicate
 * duplicateDetection.skipDuplicate()
 *
 * // User chooses to keep duplicate
 * duplicateDetection.keepDuplicate()
 * ```
 */
export function useDuplicateDetection({
  imageUploadHook,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  validTypes = DEFAULT_VALID_TYPES
}: UseDuplicateDetectionParams): UseDuplicateDetectionReturn {
  const [duplicateData, setDuplicateData] = useState<DuplicateCheckData | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])

  /**
   * Process a list of files with duplicate detection
   * Adds non-duplicate images to upload queue via imageUploadHook
   */
  const processFiles = useCallback(async (filesToProcess: File[]) => {
    if (filesToProcess.length === 0) return

    setIsChecking(true)
    const newImages: UploadedImage[] = []

    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i]

      // Validate file type
      if (!validTypes.includes(file.type)) {
        alert(`❌ Invalid file type: ${file.name}\nPlease upload JPG, PNG, or WEBP images.`)
        continue
      }

      // Validate file size
      if (file.size > maxFileSize) {
        alert(`❌ File too large: ${file.name}\nMaximum size is ${maxFileSize / (1024 * 1024)}MB.`)
        continue
      }

      try {
        console.log(`🔍 Processing: ${file.name}`)

        // Generate hashes (parallel for speed)
        console.log(`  ⏳ Generating hashes...`)
        const [fileHash, perceptualHash] = await Promise.all([
          generateFileHash(file),
          generatePerceptualHash(file)
        ])
        const fileSize = getFileSize(file)

        console.log(`  ✅ Hashes generated`)
        console.log(`     SHA-256: ${fileHash.substring(0, 16)}...`)
        console.log(`     pHash: ${perceptualHash}`)
        console.log(`     Size: ${formatFileSize(fileSize)}`)

        // Check for duplicates
        console.log(`  🔍 Checking for duplicates...`)
        const response = await fetch('/api/check-duplicate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            fileHash,
            fileSize,
            perceptualHash
          })
        })

        if (!response.ok) {
          console.error('  ⚠️ Duplicate check failed, proceeding anyway')
          // Continue with upload if check fails
        } else {
          const result = await response.json()

          if (result.isDuplicate) {
            console.log(`  ⚠️ ${result.message}`)
            console.log(`  📦 API Response:`, result)

            // Save remaining files to process after user decision
            const remainingFiles = filesToProcess.slice(i + 1)
            if (remainingFiles.length > 0) {
              console.log(`  📦 Saving ${remainingFiles.length} remaining file(s) for later`)
              setPendingFiles(remainingFiles)
            }

            // Add any images we've already processed
            if (newImages.length > 0) {
              imageUploadHook.addImages(newImages)
              console.log(`\n✅ Added ${newImages.length} image${newImages.length > 1 ? 's' : ''} to queue (before duplicate)\n`)
            }

            // Show duplicate modal and wait for user decision
            const duplicateCheckData: DuplicateCheckData = {
              file,
              fileHash,
              fileSize,
              perceptualHash,
              existingImage: result.existingImage,
              matchType: result.matchType,
              confidence: result.confidence || 100,
              message: result.message
            }

            console.log(`  🎯 Setting duplicate check state:`, duplicateCheckData)
            setDuplicateData(duplicateCheckData)

            console.log(`  ⏹️ Hiding loading overlay`)
            setIsChecking(false)

            console.log(`  ⏸️ Pausing file processing (${remainingFiles.length} files pending)`)
            return // Pause processing, wait for user decision
          }

          console.log(`  ✅ No duplicate found`)
        }

        // Not a duplicate - proceed with adding to upload queue
        const id = crypto.randomUUID()
        const previewUrl = imageUploadHook.createPreviewUrl(file)

        newImages.push({
          id,
          file,
          previewUrl,
          filename: file.name,
          status: 'pending',
          fileHash,
          fileSize,
          perceptualHash
        })

        console.log(`  📸 Added to queue`)

      } catch (error) {
        console.error(`❌ Error processing ${file.name}:`, error)
        alert(`Failed to process ${file.name}. You can try uploading it again.`)
      }
    }

    // All files processed successfully (no duplicates found)
    if (newImages.length > 0) {
      imageUploadHook.addImages(newImages)
      console.log(`\n✅ Added ${newImages.length} image${newImages.length > 1 ? 's' : ''} to queue\n`)
    }

    setIsChecking(false)
  }, [imageUploadHook, validTypes, maxFileSize])

  /**
   * Check files for duplicates (entry point)
   */
  const checkFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return
    await processFiles(files)
  }, [processFiles])

  /**
   * User chooses to skip duplicate and continue with remaining files
   */
  const skipDuplicate = useCallback(async () => {
    console.log('⏭️ User skipped duplicate')
    setDuplicateData(null)

    // Continue processing remaining files
    if (pendingFiles.length > 0) {
      console.log(`▶️ Continuing with ${pendingFiles.length} remaining file(s)`)
      const filesToProcess = [...pendingFiles]
      setPendingFiles([]) // Clear pending files
      await processFiles(filesToProcess)
    } else {
      console.log('✅ No more files to process')
    }
  }, [pendingFiles, processFiles])

  /**
   * User chooses to keep duplicate and continue with remaining files
   */
  const keepDuplicate = useCallback(async () => {
    if (!duplicateData) return

    console.log('📸 User chose to keep duplicate')

    const id = crypto.randomUUID()
    const previewUrl = imageUploadHook.createPreviewUrl(duplicateData.file)

    imageUploadHook.addImages([{
      id,
      file: duplicateData.file,
      previewUrl,
      filename: duplicateData.file.name,
      status: 'pending',
      fileHash: duplicateData.fileHash,
      fileSize: duplicateData.fileSize,
      perceptualHash: duplicateData.perceptualHash
    }])

    setDuplicateData(null)

    // Continue processing remaining files
    if (pendingFiles.length > 0) {
      console.log(`▶️ Continuing with ${pendingFiles.length} remaining file(s)`)
      const filesToProcess = [...pendingFiles]
      setPendingFiles([]) // Clear pending files
      await processFiles(filesToProcess)
    } else {
      console.log('✅ No more files to process')
    }
  }, [duplicateData, pendingFiles, imageUploadHook, processFiles])

  /**
   * Open gallery to view existing duplicate image
   */
  const viewExisting = useCallback(() => {
    if (!duplicateData) return
    const url = `/tagger/gallery?highlight=${duplicateData.existingImage.id}`
    console.log('👁️ Opening gallery:', url)
    window.open(url, '_blank')
  }, [duplicateData])

  return {
    duplicateData,
    isChecking,
    checkFiles,
    skipDuplicate,
    keepDuplicate,
    viewExisting
  }
}
