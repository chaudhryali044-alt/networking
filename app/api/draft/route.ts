import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { draftEmail } from '@/lib/gemini';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { contactId } = await req.json();

  const { data: contact } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', contactId)
    .single();

  if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

  const snippets = [contact.thread_snippet, contact.ai_summary].filter(Boolean) as string[];
  const draft = await draftEmail(contact.name, contact.company ?? '', snippets);

  if (!draft) {
    return NextResponse.json({ error: 'Failed to generate draft' }, { status: 500 });
  }

  return NextResponse.json({ draft, contact });
}
