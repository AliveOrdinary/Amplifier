import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// GET: Fetch current active vocabulary config
export async function GET() {
  try {
    // Use service role key for server-side API routes
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

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
  } catch (error: any) {
    console.error('[API] Vocabulary config failed:', error);
    return NextResponse.json(
      { error: 'Failed to load vocabulary configuration', details: error.message },
      { status: 500 }
    );
  }
}
