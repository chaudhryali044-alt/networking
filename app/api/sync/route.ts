import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSheetsClient, readAllContacts } from '@/lib/sheets';
import { getGmailClient, getThreadsForEmail, computeTrueStatus } from '@/lib/gmail';
import { analyzeThread } from '@/lib/gemini';
import { supabase } from '@/lib/supabase';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID!;
const CACHE_HOURS = 6;

export async function POST(req: NextRequest) {
  console.log('Sync started');

  const session = await getServerSession(authOptions);

  console.log('Session:', session?.user?.email ?? null);
  console.log('Access token present:', !!session?.accessToken);

  if (!session) {
    console.log('[Sync] No session — returning 401');
    return NextResponse.json({ error: 'Not authenticated. Please sign in.' }, { status: 401 });
  }

  if (session.error === 'RefreshAccessTokenError' || session.error === 'RefreshTokenMissing') {
    console.log('[Sync] Token error:', session.error);
    return NextResponse.json(
      { error: 'Google OAuth token expired. Please sign out and sign in again.' },
      { status: 401 }
    );
  }

  const accessToken = session.accessToken;

  if (!accessToken) {
    console.log('[Sync] No access token in session');
    return NextResponse.json(
      { error: 'No access token — please sign out and sign in again' },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => ({ force: false }));
  const force = body?.force ?? false;
  console.log('[Sync] Force sync:', force);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (step: string, detail?: string) => {
        const msg = detail ? `${step} — ${detail}` : step;
        console.log('[Sync]', msg);
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
        send('Reading spreadsheet...');

        if (!SPREADSHEET_ID) {
          sendError('SPREADSHEET_ID env var is not set');
          controller.close();
          return;
        }

        const sheets = getSheetsClient(accessToken);
        let sheetContacts: Awaited<ReturnType<typeof readAllContacts>> = [];

        try {
          sheetContacts = await readAllContacts(sheets, SPREADSHEET_ID);
          send('Spreadsheet read', `${sheetContacts.length} contacts found`);
        } catch (err) {
          sendError('Failed to read Google Sheets', err);
          sheetContacts = [];
        }

        send('Scanning Gmail (last 10 months)...');
        const gmail = getGmailClient(accessToken);

        let gmailThreadsRead = 0;
        const processed: Record<string, unknown>[] = [];
        const cacheThreshold = new Date(Date.now() - CACHE_HOURS * 3600 * 1000).toISOString();

        send('Processing contacts...', `${sheetContacts.length} total`);

        for (let i = 0; i < sheetContacts.length; i++) {
          const contact = sheetContacts[i];
          send(`Analysing contact ${i + 1}/${sheetContacts.length}`, contact.name);

          if (!force && contact.email) {
            try {
              const { data: cached } = await supabase
                .from('contacts')
                .select('id, last_synced')
                .eq('email', contact.email)
                .gte('last_synced', cacheThreshold)
                .maybeSingle();

              if (cached) {
                console.log('[Sync] Cache hit for', contact.name);
                processed.push({ _cached: true, email: contact.email });
                continue;
              }
            } catch (err) {
              console.warn('[Sync] Cache check failed for', contact.name, err);
            }
          }

          let threadInfo = null;
          if (contact.email) {
            try {
              threadInfo = await getThreadsForEmail(
                gmail,
                contact.email,
                'chaudhry.ali044@gmail.com'
              );
              gmailThreadsRead++;
              console.log(
                '[Sync] Gmail for', contact.name,
                '— sent:', threadInfo.emailsSent,
                'received:', threadInfo.emailsReceived
              );
            } catch (err) {
              console.warn('[Sync] Gmail lookup failed for', contact.name, err);
            }
          } else {
            console.log('[Sync] No email for', contact.name, '— skipping Gmail');
          }

          const trueStatus = threadInfo
            ? computeTrueStatus(threadInfo, contact.status)
            : (contact.status ?? 'Unverified');

          let aiSummary: string | null = null;
          let nextAction: string | null = null;
          let urgency: string | null = null;

          const hasRecentActivity =
            threadInfo?.lastContactDate &&
            Date.now() - threadInfo.lastContactDate.getTime() < 60 * 24 * 60 * 60 * 1000;

          if (hasRecentActivity && threadInfo && threadInfo.snippets.length > 0) {
            send(`Generating AI summary for ${contact.name}...`);
            try {
              const analysis = await analyzeThread(
                contact.name,
                contact.company ?? '',
                threadInfo.snippets
              );
              if (analysis) {
                aiSummary = analysis.summary;
                nextAction = analysis.nextAction;
                urgency = analysis.urgency;
              }
            } catch (err) {
              console.warn('[Sync] Gemini summary failed for', contact.name, err);
            }
          }

          processed.push({
            name: contact.name,
            company: contact.company,
            role: contact.role,
            email: contact.email,
            region: contact.region,
            spreadsheet_status: contact.status,
            true_status: trueStatus,
            first_contact_date: threadInfo?.firstContactDate?.toISOString().split('T')[0] ?? null,
            last_contact_date: threadInfo?.lastContactDate?.toISOString().split('T')[0] ?? null,
            emails_sent: threadInfo?.emailsSent ?? 0,
            emails_received: threadInfo?.emailsReceived ?? 0,
            meeting_happened: threadInfo?.meetingHappened ?? false,
            meeting_date: threadInfo?.meetingDate?.toISOString().split('T')[0] ?? null,
            ai_summary: aiSummary,
            next_action: nextAction,
            urgency,
            notes: contact.notes,
            thread_snippet: threadInfo?.snippets?.[0] ?? null,
            last_synced: new Date().toISOString(),
          });
        }

        const toSave = processed.filter((c) => !c._cached);
        send(`Saving ${toSave.length} contacts to database...`);
        console.log('[Sync] Upserting', toSave.length, 'contacts to Supabase');

        if (toSave.length > 0) {
          const withEmail = toSave.filter((c) => c.email);
          const withoutEmail = toSave.filter((c) => !c.email);

          if (withEmail.length > 0) {
            const { error: upsertErr } = await supabase
              .from('contacts')
              .upsert(withEmail, { onConflict: 'email', ignoreDuplicates: false });

            if (upsertErr) {
              console.error('[Sync] Upsert (with email) error:', upsertErr);
              sendError('Supabase upsert error', upsertErr.message);
            } else {
              console.log('[Sync] Upserted', withEmail.length, 'contacts with email');
            }
          }

          if (withoutEmail.length > 0) {
            const { error: insertErr } = await supabase
              .from('contacts')
              .insert(withoutEmail);

            if (insertErr) {
              console.warn('[Sync] Insert (without email) error (may be duplicate):', insertErr.message);
            } else {
              console.log('[Sync] Inserted', withoutEmail.length, 'contacts without email');
            }
          }
        }

        const { error: logErr } = await supabase.from('sync_log').insert({
          contacts_processed: processed.length,
          gmail_threads_read: gmailThreadsRead,
          status: 'success',
        });

        if (logErr) {
          console.error('[Sync] Failed to write sync_log:', logErr);
        }

        const summary = `${processed.length} contacts processed, ${gmailThreadsRead} Gmail threads read`;
        send('Sync complete!', summary);
        console.log('[Sync] Done —', summary);

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[Sync] Unhandled error:', err);
        controller.enqueue(
          encoder.encode(JSON.stringify({ step: 'Error', detail: msg }) + '\n')
        );

        try {
          await supabase.from('sync_log').insert({
            contacts_processed: 0,
            gmail_threads_read: 0,
            status: `error: ${msg}`,
          });
        } catch (logErr) {
          console.error('[Sync] Could not write error to sync_log:', logErr);
        }
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
  console.log('Sync route hit');
  console.log('[Sync] GET /api/sync — fetching last sync status');

  try {
    const { data, error } = await supabase
      .from('sync_log')
      .select('*')
      .order('synced_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[Sync] GET sync_log error:', error);
      return NextResponse.json({ status: 'sync route alive', lastSync: null, error: error.message });
    }

    console.log('[Sync] Last sync:', data?.synced_at ?? 'never');
    return NextResponse.json({ status: 'sync route alive', lastSync: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Sync] GET error:', msg);
    return NextResponse.json({ status: 'sync route alive', lastSync: null, error: msg });
  }
}
