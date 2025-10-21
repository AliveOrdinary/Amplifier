import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface ReplaceVocabularyRequest {
  structure: {
    categories: Array<{
      key: string;
      label: string;
      storage_type: 'array' | 'jsonb_array' | 'text';
      storage_path: string;
      search_weight: number;
      description?: string;
      placeholder?: string;
    }>;
  };
  config_name: string;
  description?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { structure, config_name, description }: ReplaceVocabularyRequest = await request.json();

    // Validate structure
    if (!structure?.categories || !Array.isArray(structure.categories)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid structure: categories array is required'
      }, { status: 400 });
    }

    // Validate each category
    for (const category of structure.categories) {
      if (!category.key || !category.label || !category.storage_type || !category.storage_path) {
        return NextResponse.json({
          success: false,
          error: `Invalid category: missing required fields (key, label, storage_type, storage_path)`
        }, { status: 400 });
      }

      if (!['array', 'jsonb_array', 'text'].includes(category.storage_type)) {
        return NextResponse.json({
          success: false,
          error: `Invalid storage_type: ${category.storage_type}. Must be 'array', 'jsonb_array', or 'text'`
        }, { status: 400 });
      }

      if (typeof category.search_weight !== 'number' || category.search_weight < 0) {
        return NextResponse.json({
          success: false,
          error: `Invalid search_weight for ${category.key}: must be a positive number`
        }, { status: 400 });
      }
    }

    if (!config_name || config_name.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: 'config_name is required'
      }, { status: 400 });
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Start replacement process
    console.log('Starting vocabulary replacement...');

    // 1. Delete all images and their storage files
    console.log('Deleting all images and storage files...');
    const { data: images, error: fetchError } = await supabase
      .from('reference_images')
      .select('id, storage_path, thumbnail_path');

    if (fetchError) {
      console.error('Error fetching images:', fetchError);
    }

    // Delete storage files
    if (images && images.length > 0) {
      const storagePaths: string[] = [];
      images.forEach(img => {
        if (img.storage_path) {
          // Extract just the filename from the full URL
          const pathMatch = img.storage_path.match(/reference-images\/(.+)$/);
          if (pathMatch) storagePaths.push(pathMatch[1]);
        }
        if (img.thumbnail_path) {
          const pathMatch = img.thumbnail_path.match(/reference-images\/(.+)$/);
          if (pathMatch) storagePaths.push(pathMatch[1]);
        }
      });

      if (storagePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('reference-images')
          .remove(storagePaths);

        if (storageError) {
          console.error('Error deleting storage files:', storageError);
        }
      }
    }

    // Delete all reference_images records
    const { error: deleteImagesError } = await supabase
      .from('reference_images')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (deleteImagesError) {
      console.error('Error deleting images:', deleteImagesError);
    }

    // 2. Delete all tag corrections
    console.log('Deleting all tag corrections...');
    const { error: deleteCorrectionsError } = await supabase
      .from('tag_corrections')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (deleteCorrectionsError) {
      console.error('Error deleting corrections:', deleteCorrectionsError);
    }

    // 3. Delete all tags from vocabulary
    console.log('Deleting all vocabulary tags...');
    const { error: deleteTagsError } = await supabase
      .from('tag_vocabulary')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (deleteTagsError) {
      console.error('Error deleting tags:', deleteTagsError);
    }

    // 4. Delete old vocabulary config
    console.log('Deleting old vocabulary config...');
    const { error: deleteConfigError } = await supabase
      .from('vocabulary_config')
      .delete()
      .eq('is_active', true);

    if (deleteConfigError) {
      console.error('Error deleting old config:', deleteConfigError);
    }

    // 5. Insert new vocabulary config
    console.log('Inserting new vocabulary config...');
    const { data: newConfig, error: insertError } = await supabase
      .from('vocabulary_config')
      .insert({
        config_name: config_name.trim(),
        description: description || null,
        structure,
        is_active: true
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting new config:', insertError);
      return NextResponse.json({
        success: false,
        error: 'Failed to insert new vocabulary configuration',
        details: insertError.message
      }, { status: 500 });
    }

    console.log('Vocabulary replacement completed successfully');

    return NextResponse.json({
      success: true,
      message: 'Vocabulary replaced successfully. System is ready for fresh tagging.',
      config: newConfig,
      stats: {
        images_deleted: images?.length || 0,
        storage_files_deleted: images?.length ? images.length * 2 : 0
      }
    });

  } catch (error) {
    console.error('Error in vocabulary replacement:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to replace vocabulary',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
