import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getGmailClient, verifyGmailAccess, buildContactsFromGmail } from '@/lib/gmail';
import { supabase } from '@/lib/supabase';

// Before first sync, run in Supabase SQL editor:
// ALTER TABLE contacts ADD CONSTRAINT contacts_email_unique UNIQUE (email);

export async function POST(req: NextRequest) {
  console.log('[Sync] POST started');

  const session = await getServerSession(authOptions);
  console.log('[Sync] Session:', session?.user?.email ?? null);

  if (!session) {
    return NextResponse.json({ error: 'Not authenticated. Please sign in.' }, { status: 401 });
  }
  if (session.error === 'RefreshAccessTokenError' || session.error === 'RefreshTokenMissing') {
    return NextResponse.json(
      { error: 'Google OAuth token expired. Please sign out and sign in again.' },
      { status: 401 },
    );
  }

  const accessToken = session.accessToken;
  if (!accessToken) {
    return NextResponse.json(
      { error: 'No access token — please sign out and sign in again' },
      { status: 401 },
    );
  }

  await req.json().catch(() => ({}));

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (step: string, detail?: string) => {
        console.log('[Sync]', step, detail ?? '');
        controller.enqueue(encoder.encode(JSON.stringify({ step, detail }) + '\n'));
      };

      try {
        // ── Gmail auth ──────────────────────────────────────────────────────
        send('Checking Gmail access...');
        const gmail = getGmailClient(accessToken);
        const gmailCheck = await verifyGmailAccess(gmail);
        if (!gmailCheck.ok) {
          send('Error', `Gmail auth failed: ${gmailCheck.error}`);
          controller.close();
          return;
        }

        // ── Read Gmail ─────────────────────────────────────────────────────
        send('Scanning Gmail — last 10 months...');
        const contacts = await buildContactsFromGmail(gmail, (msg) => send('Reading Gmail...', msg));
        send('Gmail read', `${contacts.length} contacts found`);

        if (contacts.length === 0) {
          send('Sync complete!', '0 contacts found in Gmail');
          controller.close();
          return;
        }

        // ── Save to Supabase ─────────────────────────────────────────────
        send('Saving to database...', `${contacts.length} contacts`);

        const rows = contacts.map(c => ({
          name: c.name,
          email: c.email,
          company: c.company,
          first_contact_date: c.firstContacted,
          last_contact_date: c.lastContact,
          emails_sent: c.emailsSent,
          emails_received: c.repliesReceived,
          meeting_happened: c.meetingHappened,
          thread_snippet: c.latestSnippet || null,
          true_status: c.status,
          spreadsheet_status: null,
          last_synced: new Date().toISOString(),
        }));

        const { error: upsertErr } = await supabase
          .from('contacts')
          .upsert(rows, { onConflict: 'email', ignoreDuplicates: false });

        if (upsertErr) {
          console.error('[Sync] Upsert error:', upsertErr.message);
          if (upsertErr.message.includes('constraint') || upsertErr.message.includes('conflict')) {
            send('Saving (fallback)...', 'Run ALTER TABLE contacts ADD CONSTRAINT contacts_email_unique UNIQUE (email) in Supabase SQL editor');
            for (const row of rows) {
              await supabase.from('contacts').upsert(row, { onConflict: 'name,company', ignoreDuplicates: false });
            }
          } else {
            send('Error', `Database save failed: ${upsertErr.message}`);
          }
        } else {
          console.log('[Sync] Saved', rows.length, 'contacts');
        }

        // ── Log ──────────────────────────────────────────────────────────────────
        await supabase.from('sync_log').insert({
          contacts_processed: contacts.length,
          gmail_threads_read: contacts.length,
          status: 'success',
        });

        send('Sync complete!', `${contacts.length} contacts found in Gmail`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[Sync] Unhandled error:', msg);
        controller.enqueue(encoder.encode(JSON.stringify({ step: 'Error', detail: msg }) + '\n'));
        await supabase.from('sync_log').insert({
          contacts_processed: 0,
          gmail_threads_read: 0,
          status: `error: ${msg}`,
        });
      }

      controller.close();
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Transfer-Encoding': 'chunked',
    },
  });
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('sync_log')
      .select('*')
      .order('synced_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ status: 'sync route alive', lastSync: null, error: error.message });
    }
    return NextResponse.json({ status: 'sync route alive', lastSync: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ status: 'sync route alive', lastSync: null, error: msg });
  }
}
