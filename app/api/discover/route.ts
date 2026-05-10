import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { discoverContacts } from '@/lib/gemini';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { query } = await req.json();
  if (!query?.trim()) return NextResponse.json({ suggestions: [] });

  const suggestions = await discoverContacts(query);
  return NextResponse.json({ suggestions });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, role, company } = await req.json();

  const { data, error } = await supabase
    .from('contacts')
    .insert({
      name,
      role,
      company,
      true_status: 'No Response',
      spreadsheet_status: 'Discovered',
      emails_sent: 0,
      emails_received: 0,
      meeting_happened: false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contact: data });
}
