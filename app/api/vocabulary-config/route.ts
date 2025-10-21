import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// GET: Fetch current active vocabulary config
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from('vocabulary_config')
      .select('*')
      .eq('is_active', true)
      .single();

    if (error) {
      return NextResponse.json({
        error: 'No active vocabulary configuration found',
        details: error.message
      }, { status: 404 });
    }

    return NextResponse.json({ config: data });

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to fetch vocabulary configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
