import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// GET: Fetch current active vocabulary config
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const supabase = createServerClient();

    const { data: config, error } = await supabase
      .from('vocabulary_config')
      .select('*')
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('[API] Vocabulary config error:', error);

      // If no config found, return empty structure
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          config: {
            structure: { categories: [] },
            message: 'No active vocabulary configuration found'
          }
        });
      }

      throw error;
    }

    return NextResponse.json({ config });
  } catch (error: unknown) {
    console.error('[API] Vocabulary config failed:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
