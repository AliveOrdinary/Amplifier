/**
 * File hashing utilities for duplicate detection
 *
 * This module provides functions for generating content hashes (SHA-256) and
 * perceptual hashes (pHash) for image duplicate detection.
 */

/**
 * Generate SHA-256 hash from File object in browser
 * Uses Web Crypto API for secure, fast hashing
 *
 * @param file - File to hash
 * @returns Hex string of SHA-256 hash
 */
export async function generateFileHash(file: File): Promise<string> {
  try {
    const buffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    return hashHex
  } catch (error) {
    console.error('Error generating file hash:', error)
    throw error
  }
}

/**
 * Generate perceptual hash for visual similarity detection
 * Uses canvas to create a simplified 8x8 grayscale representation
 *
 * Algorithm:
 * 1. Load image to canvas
 * 2. Resize to 8x8 pixels
 * 3. Convert to grayscale
 * 4. Calculate average pixel value
 * 5. Generate binary hash (1 if above avg, 0 if below)
 * 6. Convert to hex string
 *
 * @param file - Image file
 * @returns Perceptual hash string (16 hex chars = 64 bits)
 */
export async function generatePerceptualHash(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      reject(new Error('Could not get canvas context'))
      return
    }

    img.onload = () => {
      try {
        // Resize to 8x8 for pHash (64 pixels total)
        const size = 8
        canvas.width = size
        canvas.height = size

        // Draw and convert to grayscale
        ctx.drawImage(img, 0, 0, size, size)
        const imageData = ctx.getImageData(0, 0, size, size)
        const pixels = imageData.data

        // Convert to grayscale using luminosity method
        const grayscale: number[] = []
        let sum = 0

        for (let i = 0; i < pixels.length; i += 4) {
          // Standard luminosity formula: 0.299 R + 0.587 G + 0.114 B
          const gray = pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114
          grayscale.push(gray)
          sum += gray
        }

        const avg = sum / grayscale.length

        // Generate binary hash based on whether each pixel is above/below average
        let hash = ''
        for (let i = 0; i < grayscale.length; i++) {
          hash += grayscale[i] >= avg ? '1' : '0'
        }

        // Convert binary to hex (more compact storage)
        const hexHash = parseInt(hash, 2).toString(16).padStart(16, '0')
        resolve(hexHash)

        // Cleanup
        URL.revokeObjectURL(img.src)
      } catch (error) {
        reject(error)
      }
    }

    img.onerror = () => {
      reject(new Error('Failed to load image for hashing'))
    }

    img.src = URL.createObjectURL(file)
  })
}

/**
 * Calculate Hamming distance between two hex hashes
 * Hamming distance = number of different bits
 *
 * Used to compare perceptual hashes:
 * - 0 = identical
 * - Low value = very similar
 * - High value = very different
 *
 * @param hash1 - First hash (hex string)
 * @param hash2 - Second hash (hex string)
 * @returns Number of different bits (0 = identical)
 */
export function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    throw new Error('Hashes must be same length')
  }

  let distance = 0

  // Compare each hex character by converting to binary
  for (let i = 0; i < hash1.length; i++) {
    const xor = parseInt(hash1[i], 16) ^ parseInt(hash2[i], 16)

    // Count set bits in XOR result
    let bits = xor
    while (bits > 0) {
      distance += bits & 1
      bits >>= 1
    }
  }

  return distance
}

/**
 * Calculate similarity percentage between perceptual hashes
 *
 * @param hash1 - First perceptual hash
 * @param hash2 - Second perceptual hash
 * @returns 0-100 (100 = identical, 0 = completely different)
 */
export function calculateSimilarity(hash1: string, hash2: string): number {
  const distance = hammingDistance(hash1, hash2)
  const maxDistance = hash1.length * 4 // Each hex char = 4 bits
  const similarity = ((maxDistance - distance) / maxDistance) * 100
  return Math.round(similarity)
}

/**
 * Get file size in bytes
 *
 * @param file - File object
 * @returns File size in bytes
 */
export function getFileSize(file: File): number {
  return file.size
}

/**
 * Format file size for human-readable display
 *
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "2.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
