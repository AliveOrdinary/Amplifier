import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { calculateSimilarity } from '@/lib/file-hash'
import { requireAuth } from '@/lib/api-auth'

/**
 * Duplicate Check API Endpoint
 *
 * Checks for duplicate images using three methods:
 * 1. Content hash (SHA-256) - Exact match
 * 2. Perceptual hash (pHash) - Visual similarity
 * 3. Filename - Conflict warning
 */

interface DuplicateCheckRequest {
  filename: string
  fileHash?: string
  fileSize?: number
  perceptualHash?: string
}

// Similarity threshold for perceptual hash (90% = very strict)
// Adjust this value based on desired strictness:
// - 95+ = Extremely strict (fewer false positives, might miss some duplicates)
// - 90-95 = Very strict (recommended for production)
// - 85-90 = Balanced
// - <85 = Loose (many false positives)
const SIMILARITY_THRESHOLD = 90

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { filename, fileHash, fileSize, perceptualHash }: DuplicateCheckRequest = await request.json()

    if (!filename) {
      return NextResponse.json(
        { error: 'Filename required' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // ============================================================
    // PRIORITY 1: Check by content hash (exact match)
    // ============================================================
    if (fileHash) {
      const { data: hashMatch, error: hashError } = await supabase
        .from('reference_images')
        .select('id, original_filename, tagged_at, status, file_hash, file_size, perceptual_hash, thumbnail_path')
        .eq('file_hash', fileHash)
        .maybeSingle() // Use maybeSingle to avoid error when no match

      if (hashError) {
        console.error('Hash check error:', hashError)
      }

      if (hashMatch) {
        return NextResponse.json({
          isDuplicate: true,
          matchType: 'exact',
          confidence: 100,
          existingImage: hashMatch,
          message: 'Exact duplicate found (identical file content)'
        })
      }
    }

    // ============================================================
    // PRIORITY 2: Check by perceptual hash (visual similarity)
    // ============================================================
    if (perceptualHash) {
      const { data: allImages, error: allError } = await supabase
        .from('reference_images')
        .select('id, original_filename, tagged_at, status, file_hash, file_size, perceptual_hash, thumbnail_path')
        .not('perceptual_hash', 'is', null)

      if (allError) {
        console.error('Perceptual hash check error:', allError)
      }

      if (allImages && allImages.length > 0) {
        // Calculate similarity with all existing images
        // This is O(n) but acceptable for reasonable dataset sizes (<10,000 images)
        for (const image of allImages) {
          if (!image.perceptual_hash) continue

          try {
            const similarity = calculateSimilarity(perceptualHash, image.perceptual_hash)

            if (similarity >= SIMILARITY_THRESHOLD) {
              return NextResponse.json({
                isDuplicate: true,
                matchType: 'similar',
                confidence: similarity,
                existingImage: image,
                message: `Visually similar image found (${similarity}% match)`
              })
            }
          } catch (error) {
            console.error('Error comparing perceptual hashes:', error)
            continue
          }
        }
      }
    }

    // ============================================================
    // PRIORITY 3: Check by filename (warning only)
    // ============================================================
    const { data: filenameMatch, error: filenameError } = await supabase
      .from('reference_images')
      .select('id, original_filename, tagged_at, status, file_hash, file_size, perceptual_hash, thumbnail_path')
      .eq('original_filename', filename)
      .maybeSingle()

    if (filenameError) {
      console.error('Filename check error:', filenameError)
    }

    if (filenameMatch) {
      // Check if it's likely the same file by comparing size
      const isSameSize = fileSize && filenameMatch.file_size === fileSize

      return NextResponse.json({
        isDuplicate: true,
        matchType: 'filename',
        confidence: isSameSize ? 80 : 50,
        existingImage: filenameMatch,
        message: isSameSize
          ? 'Same filename and file size (likely duplicate)'
          : 'Same filename but different file size (possibly different image)'
      })
    }

    // ============================================================
    // No duplicates found
    // ============================================================
    return NextResponse.json({
      isDuplicate: false
    })

  } catch (error: unknown) {
    console.error('❌ Duplicate check error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
