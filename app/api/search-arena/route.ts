// DEPRECATED: This route has been replaced by /api/search-references
// Keeping for reference only - not used in production

import { NextRequest, NextResponse } from 'next/server';
import type { SearchArenaRequest, SearchArenaResponse, ArenaBlock, ArenaSearchResponse } from '@/lib/types';

const ARENA_API_BASE = 'http://api.are.na/v2';
const RESULTS_PER_KEYWORD = 6; // Fetch 6 results per keyword
const MAX_TOTAL_RESULTS = 40; // Limit total results
const REQUEST_DELAY = 600; // 600ms delay between requests to be respectful

export async function POST(request: NextRequest) {
  // Return error - this endpoint is deprecated
  return NextResponse.json(
    {
      blocks: [],
      error: 'This endpoint has been replaced by /api/search-references. Please use the new internal reference search.'
    } as SearchArenaResponse,
    { status: 410 }
  );

  /* ORIGINAL CODE - COMMENTED OUT
export async function POST_DEPRECATED(request: NextRequest) {
  try {
    const { keywords }: SearchArenaRequest = await request.json();

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { blocks: [], error: 'Invalid keywords provided' } as SearchArenaResponse,
        { status: 400 }
      );
    }

    // Search Are.na for each keyword
    const allBlocks: ArenaBlock[] = [];
    const seenBlockIds = new Set<number>();

    for (const keyword of keywords) {
      try {
        // Add delay between requests to be respectful to Are.na API
        if (allBlocks.length > 0) {
          await delay(REQUEST_DELAY);
        }

        const searchUrl = `${ARENA_API_BASE}/search/blocks?q=${encodeURIComponent(keyword)}&per=${RESULTS_PER_KEYWORD}`;

        const response = await fetch(searchUrl, {
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          console.warn(`Are.na search failed for keyword "${keyword}": ${response.status}`);
          continue;
        }

        const data: ArenaSearchResponse = await response.json();
        const blocks = data.blocks || [];

        // Filter for image blocks and deduplicate
        for (const block of blocks) {
          if (isImageBlock(block) && !seenBlockIds.has(block.id)) {
            seenBlockIds.add(block.id);
            allBlocks.push(block);

            // Debug: Log first few blocks
            if (allBlocks.length <= 3) {
              console.log(`Block ${block.id}: has image:`, !!block.image, 'display url:', block.image?.display?.url);
            }

            // Stop if we've reached the maximum
            if (allBlocks.length >= MAX_TOTAL_RESULTS) {
              break;
            }
          }
        }

        if (allBlocks.length >= MAX_TOTAL_RESULTS) {
          break;
        }
      } catch (error) {
        console.error(`Error searching for keyword "${keyword}":`, error);
        // Continue with other keywords
      }
    }

    return NextResponse.json({
      blocks: allBlocks,
    } as SearchArenaResponse);

  } catch (error) {
    console.error('Error in Are.na search:', error);
    return NextResponse.json(
      {
        blocks: [],
        error: 'Failed to search Are.na'
      } as SearchArenaResponse,
      { status: 500 }
    );
  }
}

/**
 * Check if a block is an image block (Image or Link with image)
 */
function isImageBlock(block: ArenaBlock): boolean {
  // Image blocks have class 'Image'
  if (block.class === 'Image' && block.image) {
    return true;
  }

  // Link blocks may also have images (screenshots)
  if (block.class === 'Link' && block.image) {
    return true;
  }

  return false;
}

/**
 * Delay helper function
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
*/
