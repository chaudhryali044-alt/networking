import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSheetsClient, readAllContacts } from '@/lib/sheets';
import { getGmailClient, getThreadSummariesForEmail, verifyGmailAccess } from '@/lib/gmail';
import { supabase } from '@/lib/supabase';

// Required Supabase table (run once in Supabase SQL editor):
// CREATE TABLE IF NOT EXISTS gmail_threads (
//   thread_id TEXT PRIMARY KEY,
//   subject TEXT,
//   from_address TEXT,
//   to_address TEXT,
//   latest_date TIMESTAMPTZ,
//   snippet TEXT,
//   has_reply BOOLEAN DEFAULT FALSE,
//   contact_email TEXT,
//   contact_name TEXT,
//   synced_at TIMESTAMPTZ DEFAULT NOW()
// );

const SPREADSHEET_ID = process.env.SPREADSHEET_ID!;

export async function POST(req: NextRequest) {
  console.log('[Sync] POST started');

  const session = await getServerSession(authOptions);
  console.log('[Sync] Session:', session?.user?.email ?? null);
  console.log('[Sync] Access token present:', !!session?.accessToken);

  if (!session) {
    return NextResponse.json({ error: 'Not authenticated. Please sign in.' }, { status: 401 });
  }

  if (session.error === 'RefreshAccessTokenError' || session.error === 'RefreshTokenMissing') {
    return NextResponse.json(
      { error: 'Google OAuth token expired. Please sign out and sign in again.' },
      { status: 401 }
    );
  }

  const accessToken = session.accessToken;
  if (!accessToken) {
    return NextResponse.json({ error: 'No access token — please sign out and sign in again' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({ force: false }));
  const force = body?.force ?? false;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (step: string, detail?: string) => {
        console.log('[Sync]', step, detail ?? '');
        controller.enqueue(encoder.encode(JSON.stringify({ step, detail }) + '\n'));
      };

      const sendError = (msg: string, err?: unknown) => {
        const detail = err instanceof Error ? err.message : String(err ?? '');
        console.error('[Sync] ERROR:', msg, detail);
        controller.enqueue(
          encoder.encode(JSON.stringify({ step: 'Error', detail: `${msg}${detail ? ': ' + detail : ''}` }) + '\n')
        );
      };

      try {
        if (!SPREADSHEET_ID) {
          sendError('SPREADSHEET_ID env var is not set');
          controller.close();
          return;
        }

        // ── Gmail auth check ───────────────────────────────────────
        const gmail = getGmailClient(accessToken);
        const gmailCheck = await verifyGmailAccess(gmail);
        if (!gmailCheck.ok) {
          send('Gmail auth failed — will save sheet contacts only', gmailCheck.error);
        }

        // ── Read Google Sheets ─────────────────────────────────────
        send('Reading spreadsheet...');
        const sheets = getSheetsClient(accessToken);
        let sheetContacts: Awaited<ReturnType<typeof readAllContacts>> = [];

        try {
          sheetContacts = await readAllContacts(sheets, SPREADSHEET_ID);
          send('Spreadsheet read', `${sheetContacts.length} contacts found`);
        } catch (err) {
          sendError('Failed to read Google Sheets', err);
          sheetContacts = [];
        }

        // ── Save sheet contacts (sheet fields only) ────────────────
        send('Saving sheet contacts...', `${sheetContacts.length} contacts`);

        const sheetRows = sheetContacts.map(c => ({
          name: c.name,
          company: c.company,
          role: c.role,
          email: c.email,
          region: c.region,
          spreadsheet_status: c.status,
          notes: c.notes,
          last_synced: new Date().toISOString(),
        }));

        if (sheetRows.length > 0) {
          const { error: upsertErr } = await supabase
            .from('contacts')
            .upsert(sheetRows, { onConflict: 'name,company', ignoreDuplicates: false });

          if (upsertErr) {
            sendError('Contacts upsert error', upsertErr.message);
          } else {
            console.log('[Sync] Saved', sheetRows.length, 'contacts from sheet');
          }
        }

        // ── Fetch Gmail threads per contact ────────────────────────
        let gmailThreadsFound = 0;
        const emailContacts = sheetContacts.filter(c => c.email);

        if (gmailCheck.ok && emailContacts.length > 0) {
          send('Scanning Gmail threads...', `${emailContacts.length} contacts with email`);

          for (let i = 0; i < emailContacts.length; i++) {
            const contact = emailContacts[i];
            send(`Gmail ${i + 1}/${emailContacts.length}`, contact.name);

            // Cache check — skip if synced within 6h and not force
            if (!force) {
              try {
                const { data: cached } = await supabase
                  .from('gmail_threads')
                  .select('thread_id')
                  .eq('contact_email', contact.email)
                  .gte('synced_at', new Date(Date.now() - 6 * 3600 * 1000).toISOString())
                  .limit(1)
                  .maybeSingle();

                if (cached) {
                  console.log('[Gmail] Cache hit for', contact.name);
                  continue;
                }
              } catch {
                // ignore cache errors, proceed with fetch
              }
            }

            try {
              const threads = await getThreadSummariesForEmail(gmail, contact.email!, 'chaudhry.ali044@gmail.com');
              console.log(`[Gmail] ${contact.name}: ${threads.length} threads found`);

              if (threads.length > 0) {
                const rows = threads.map(t => ({
                  thread_id: t.threadId,
                  subject: t.subject,
                  from_address: t.fromAddress,
                  to_address: t.toAddress,
                  latest_date: t.latestDate?.toISOString() ?? null,
                  snippet: t.snippet,
                  has_reply: t.hasReply,
                  contact_email: contact.email,
                  contact_name: contact.name,
                  synced_at: new Date().toISOString(),
                }));

                const { error: threadErr } = await supabase
                  .from('gmail_threads')
                  .upsert(rows, { onConflict: 'thread_id', ignoreDuplicates: false });

                if (threadErr) {
                  console.error('[Gmail] Thread upsert error:', threadErr.message);
                } else {
                  gmailThreadsFound += threads.length;
                }
              }
            } catch (err) {
              console.warn('[Gmail] Failed for', contact.name, err instanceof Error ? err.message : err);
            }
          }
        } else if (!gmailCheck.ok) {
          send('Skipped Gmail — auth failed');
        }

        // ── Log sync ───────────────────────────────────────────────
        await supabase.from('sync_log').insert({
          contacts_processed: sheetContacts.length,
          gmail_threads_read: gmailThreadsFound,
          status: 'success',
        });

        const summary = `${sheetContacts.length} sheet contacts, ${gmailThreadsFound} Gmail threads`;
        send('Sync complete!', summary);
        console.log('[Sync] Done —', summary);

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
