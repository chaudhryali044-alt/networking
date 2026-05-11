import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('gmail_threads')
    .select('*')
    .order('latest_date', { ascending: false, nullsFirst: false })
    .limit(200);

  if (error) {
    console.error('[gmail-threads] Fetch error:', error.message);
    return NextResponse.json({ threads: [], error: error.message });
  }

  return NextResponse.json({ threads: data ?? [] });
}
