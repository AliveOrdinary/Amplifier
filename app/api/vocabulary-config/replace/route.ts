import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { vocabularyConfigSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

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
    const body = await request.json();

    // Validate with Zod schema
    const validationResult = vocabularyConfigSchema.safeParse(body);

    if (!validationResult.success) {
      const errors = validationResult.error?.issues?.map((err) => `${err.path.join('.')}: ${err.message}`) || ['Unknown validation error'];
      console.error('Vocabulary config validation failed:', errors);
      console.error('Validation error details:', validationResult.error);

      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: errors.slice(0, 5).join('; ')
      }, { status: 400 });
    }

    // Use validated data
    const { structure, config_name, description } = validationResult.data;

    // Initialize Supabase client with service role key
    const supabase = createServerClient();

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

    // 5. Sync database schema with new vocabulary structure
    console.log('Syncing database schema with new vocabulary structure...');

    // Get current columns in reference_images table
    let currentColumns: any[] = [];

    // Try RPC function first
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_table_columns', {
      table_name: 'reference_images'
    });

    if (rpcError) {
      // If RPC function doesn't exist, query information_schema directly
      const { data: schemaData } = await supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_name', 'reference_images');
      currentColumns = schemaData || [];
    } else {
      currentColumns = rpcData || [];
    }

    const existingColumns = new Set(
      currentColumns.map((col: any) => col.column_name || col) || []
    );

    // Collect required columns from vocabulary config
    const requiredColumns = new Set<string>();
    const columnsToAdd: Array<{ name: string; type: string }> = [];

    structure.categories.forEach(category => {
      if (category.storage_type === 'array') {
        // Direct array column
        requiredColumns.add(category.storage_path);
        if (!existingColumns.has(category.storage_path)) {
          columnsToAdd.push({ name: category.storage_path, type: 'text[]' });
        }
      } else if (category.storage_type === 'jsonb_array') {
        // JSONB nested - ensure tags column exists
        const rootColumn = category.storage_path.split('.')[0];
        requiredColumns.add(rootColumn);
        // tags column already exists, no need to add
      } else if (category.storage_type === 'text') {
        // Text column
        requiredColumns.add(category.storage_path);
        // notes column already exists, no need to add
      }
    });

    // Add new columns if needed
    if (columnsToAdd.length > 0) {
      console.log(`Adding ${columnsToAdd.length} new columns:`, columnsToAdd.map(c => c.name));

      for (const column of columnsToAdd) {
        const { data: syncResult, error: syncError } = await supabase.rpc(
          'sync_reference_images_schema',
          {
            column_name: column.name,
            column_type: column.type
          }
        );

        if (syncError) {
          console.error(`Failed to add column ${column.name}:`, syncError);
          return NextResponse.json({
            success: false,
            error: `Failed to sync database schema`,
            details: `Could not add column ${column.name}: ${syncError.message}`
          }, { status: 500 });
        }

        console.log(`Column ${column.name}: ${syncResult.action} - ${syncResult.message}`);
      }
    }

    // 6. Insert new vocabulary config
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

    // 7. Insert tags from categories (if provided)
    console.log('Inserting tags from categories...');
    let totalTagsInserted = 0;

    for (const category of structure.categories) {
      // Skip if no tags or if storage_type is 'text'
      if (!category.tags || category.tags.length === 0 || category.storage_type === 'text') {
        continue;
      }

      // Use the category key directly as the category (fully dynamic)
      // The tag_vocabulary.category column is varchar, so it accepts any string
      const tagCategory = category.key

      // Prepare tag inserts
      const tagInserts = category.tags.map((tag, index) => ({
        category: tagCategory,
        tag_value: tag.trim().toLowerCase(),
        description: null,
        sort_order: index + 1,
        is_active: true,
        times_used: 0,
      }));

      // Insert tags in batches (Supabase has a limit)
      const batchSize = 50;
      for (let i = 0; i < tagInserts.length; i += batchSize) {
        const batch = tagInserts.slice(i, i + batchSize);
        const { error: tagInsertError } = await supabase
          .from('tag_vocabulary')
          .insert(batch);

        if (tagInsertError) {
          console.error(`Error inserting tags for category ${category.key}:`, tagInsertError);
          // Continue with other categories even if one fails
        } else {
          totalTagsInserted += batch.length;
        }
      }
    }

    console.log(`Inserted ${totalTagsInserted} tags across categories`);
    console.log('Vocabulary replacement completed successfully');

    return NextResponse.json({
      success: true,
      message: 'Vocabulary replaced successfully. System is ready for fresh tagging.',
      config: newConfig,
      stats: {
        images_deleted: images?.length || 0,
        storage_files_deleted: images?.length ? images.length * 2 : 0,
        tags_inserted: totalTagsInserted
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
