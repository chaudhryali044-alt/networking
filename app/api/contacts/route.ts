import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const region = searchParams.get('region');
  const urgency = searchParams.get('urgency');
  const search = searchParams.get('search');
  const sort = searchParams.get('sort') ?? 'last_contact_date';

  let query = supabase.from('contacts').select('*');

  if (status) query = query.eq('true_status', status);
  if (region) query = query.eq('region', region);
  if (urgency) query = query.eq('urgency', urgency);
  if (search) {
    query = query.or(`name.ilike.%${search}%,company.ilike.%${search}%`);
  }

  const sortField = ['last_contact_date', 'urgency', 'name', 'company'].includes(sort)
    ? sort
    : 'last_contact_date';

  query = query.order(sortField, { ascending: sortField === 'name' || sortField === 'company', nullsFirst: false });

  const { data, error } = await query.limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ contacts: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, notes } = await req.json();
  const { data, error } = await supabase
    .from('contacts')
    .update({ notes })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contact: data });
}
