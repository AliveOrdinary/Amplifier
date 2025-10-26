import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import type { SearchReferencesRequest, SearchReferencesResponse, ReferenceImage } from '@/lib/types';

// Note: This API route won't work with output: 'export' in production
// For static export, vocabulary config should be fetched client-side from Supabase
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { keywords }: SearchReferencesRequest = await request.json();

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { images: [], error: 'Invalid keywords provided' } as SearchReferencesResponse,
        { status: 400 }
      );
    }

    // Initialize Supabase client with service role key
    const supabase = createServerClient();

    // 1. Get active vocabulary config
    const { data: config, error: configError } = await supabase
      .from('vocabulary_config')
      .select('structure')
      .eq('is_active', true)
      .single();

    if (configError || !config) {
      console.error('No active vocabulary configuration:', configError);
      return NextResponse.json(
        { images: [], error: 'No active vocabulary configuration. Please configure vocabulary first.' } as SearchReferencesResponse,
        { status: 500 }
      );
    }

    const categories = config.structure.categories;

    // 2. Fetch all tagged and approved images
    const { data: images, error } = await supabase
      .from('reference_images')
      .select('*')
      .in('status', ['tagged', 'approved']);

    if (error) {
      console.error('Error fetching images:', error);
      return NextResponse.json(
        { images: [], error: 'Failed to fetch images from database' } as SearchReferencesResponse,
        { status: 500 }
      );
    }

    if (!images || images.length === 0) {
      return NextResponse.json({
        images: [],
        warning: 'No images in collection yet'
      } as SearchReferencesResponse);
    }

    // 3. Calculate match scores for each image using dynamic vocabulary config
    const scoredImages = images.map(image => {
      let score = 0;
      const matchedKeywords: string[] = [];
      const matchedOn: Record<string, string[]> = {};

      keywords.forEach(keyword => {
        const keywordLower = keyword.toLowerCase();

        // Iterate through all categories from vocabulary config
        categories.forEach((category: any) => {
          const weight = category.search_weight;
          const path = category.storage_path;
          const categoryKey = category.key;

          // Get value from image based on storage path
          let value;
          if (path.includes('.')) {
            // Nested path like "tags.style"
            const parts = path.split('.');
            value = image[parts[0]]?.[parts[1]];
          } else {
            // Direct path like "industries"
            value = image[path];
          }

          // Check for matches based on storage type
          if (category.storage_type === 'array' || category.storage_type === 'jsonb_array') {
            if (Array.isArray(value)) {
              value.forEach((item: string) => {
                if (item.toLowerCase().includes(keywordLower) || keywordLower.includes(item.toLowerCase())) {
                  score += weight;
                  if (!matchedKeywords.includes(keyword)) matchedKeywords.push(keyword);

                  // Store matched items by category key
                  if (!matchedOn[categoryKey]) {
                    matchedOn[categoryKey] = [];
                  }
                  if (!matchedOn[categoryKey].includes(item)) {
                    matchedOn[categoryKey].push(item);
                  }
                }
              });
            }
          } else if (category.storage_type === 'text') {
            if (typeof value === 'string' && value.toLowerCase().includes(keywordLower)) {
              score += weight;
              if (!matchedKeywords.includes(keyword)) matchedKeywords.push(keyword);
            }
          }
        });
      });

      // Build result with dynamic category fields from the image
      const result: ReferenceImage = {
        id: image.id,
        thumbnail_path: image.thumbnail_path,
        storage_path: image.storage_path,
        original_filename: image.original_filename,
        notes: image.notes,
        match_score: score,
        matched_keywords: matchedKeywords,
        matched_on: matchedOn
      };

      // Copy all dynamic category fields from image based on vocabulary config
      categories.forEach((category: any) => {
        const path = category.storage_path;
        let value;
        
        if (path.includes('.')) {
          // Nested path like "tags.style"
          const parts = path.split('.');
          if (!result[parts[0]]) {
            result[parts[0]] = {};
          }
          value = image[parts[0]]?.[parts[1]];
          if (value !== undefined) {
            result[parts[0]][parts[1]] = value;
          }
        } else {
          // Direct path like "industries"
          value = image[path];
          if (value !== undefined) {
            result[path] = value;
          }
        }
      });

      return result;
    });

    // Filter by minimum score and sort
    let threshold = 2;
    let results = scoredImages.filter(img => img.match_score! >= threshold)
      .sort((a, b) => b.match_score! - a.match_score!)
      .slice(0, 40);

    // If less than 10 results, try lower threshold
    if (results.length < 10) {
      threshold = 1;
      results = scoredImages.filter(img => img.match_score! >= threshold)
        .sort((a, b) => b.match_score! - a.match_score!)
        .slice(0, 40);
    }

    // If still no results, return all with any score
    if (results.length === 0) {
      results = scoredImages.filter(img => img.match_score! > 0)
        .sort((a, b) => b.match_score! - a.match_score!)
        .slice(0, 40);
    }

    return NextResponse.json({
      images: results,
      warning: results.length === 0 ? 'No matching images found. Try different keywords.' : undefined
    } as SearchReferencesResponse);

  } catch (error) {
    console.error('Error in reference search:', error);
    return NextResponse.json(
      {
        images: [],
        error: 'Failed to search references'
      } as SearchReferencesResponse,
      { status: 500 }
    );
  }
}
