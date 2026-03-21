import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { requireAuth } from '@/lib/api-auth'

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  try {
    const supabase = createServerClient()

    // Step 1: Get all images
    const { data: images, error: fetchError } = await supabase
      .from('reference_images')
      .select('id, storage_path, thumbnail_path')

    if (fetchError) {
      console.error('❌ Error fetching images:', fetchError)
      throw fetchError
    }

    if (!images || images.length === 0) {
      return NextResponse.json({
        message: 'No images to delete',
        deletedCount: 0
      })
    }

    // Step 2: Delete from storage
    const storagePaths: string[] = []

    // Extract storage paths from full URLs
    for (const img of images) {
      try {
        if (img.storage_path) {
          const url = new URL(img.storage_path)
          const path = url.pathname.split('/reference-images/')[1]
          if (path) storagePaths.push(path)
        }
        if (img.thumbnail_path) {
          const url = new URL(img.thumbnail_path)
          const path = url.pathname.split('/reference-images/')[1]
          if (path) storagePaths.push(path)
        }
      } catch (urlError) {
        console.error('⚠️ Error parsing storage URL:', urlError)
        // Continue with other files
      }
    }

    if (storagePaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('reference-images')
        .remove(storagePaths)

      if (storageError) {
        console.error('⚠️ Storage deletion error:', storageError)
        // Continue anyway - better to clean DB even if storage fails
      }
    }

    // Step 3: Delete correction records (cascade cleanup)
    const imageIds = images.map(img => img.id)

    const { error: correctionsError } = await supabase
      .from('tag_corrections')
      .delete()
      .in('image_id', imageIds)

    if (correctionsError) {
      console.error('⚠️ Corrections deletion error:', correctionsError)
    }

    // Step 4: Delete from database
    const { error: deleteError } = await supabase
      .from('reference_images')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

    if (deleteError) {
      console.error('❌ Database deletion error:', deleteError)
      throw deleteError
    }

    // Step 5: Reset tag vocabulary usage counts
    const { error: resetError } = await supabase
      .from('tag_vocabulary')
      .update({ times_used: 0, last_used_at: null })
      .neq('id', '00000000-0000-0000-0000-000000000000') // Update all

    if (resetError) {
      console.error('⚠️ Vocabulary reset error:', resetError)
    }

    return NextResponse.json({
      success: true,
      message: 'All images deleted successfully',
      deletedCount: images.length
    })

  } catch (error: unknown) {
    console.error('❌ Delete all images error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred'
      },
      { status: 500 }
    )
  }
}
