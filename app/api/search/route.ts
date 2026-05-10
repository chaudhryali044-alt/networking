import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { naturalLanguageSearch } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { query } = await req.json();
  if (!query?.trim()) return NextResponse.json({ contacts: [], explanation: '' });

  const parsed = await naturalLanguageSearch(query);
  const explanation = parsed?.explanation ?? `Searching for: ${query}`;

  // Build a flexible query based on the natural language input
  const lower = query.toLowerCase();

  let dbQuery = supabase.from('contacts').select('*');

  // Company match
  const companyMatch = lower.match(/at ([a-z\s]+?)(?:\?|$| in | who| and)/i);
  if (companyMatch) {
    dbQuery = dbQuery.ilike('company', `%${companyMatch[1].trim()}%`);
  }
  // Meeting
  else if (lower.includes('coffee') || lower.includes('meeting') || lower.includes('call') || lower.includes('met')) {
    dbQuery = dbQuery.eq('meeting_happened', true);
  }
  // Needs response
  else if (lower.includes('replied') || lower.includes('responded') || lower.includes('haven\'t followed')) {
    dbQuery = dbQuery.eq('true_status', 'Needs Response');
  }
  // Region
  else if (lower.includes('dubai') || lower.includes('uae')) {
    dbQuery = dbQuery.eq('region', 'Dubai');
  } else if (lower.includes('london') || lower.includes('uk')) {
    dbQuery = dbQuery.eq('region', 'London');
  }
  // Generic name/company search
  else {
    dbQuery = dbQuery.or(`name.ilike.%${query}%,company.ilike.%${query}%,role.ilike.%${query}%`);
  }

  const { data, error } = await dbQuery.limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ contacts: data ?? [], explanation });
}
