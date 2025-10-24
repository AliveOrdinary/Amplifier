// DEPRECATED: This route has been replaced by /api/search-references
// Keeping for reference only - not used in production

import { NextResponse } from 'next/server';

export async function POST() {
  // Return error - this endpoint is deprecated
  return NextResponse.json(
    {
      blocks: [],
      error: 'This endpoint has been replaced by /api/search-references. Please use the new internal reference search.'
    },
    { status: 410 }
  );
}
