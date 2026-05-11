import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSheetsClient, readAllContacts } from '@/lib/sheets';
import { getGmailClient, getThreadsForEmail, computeTrueStatus, verifyGmailAccess } from '@/lib/gmail';
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
    return NextResponse.json(
      { error: 'No access token — please sign out and sign in again' },
      { status: 401 }
    );
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
        console.log('Reading spreadsheet ID:', SPREADSHEET_ID);

        if (!SPREADSHEET_ID) {
          sendError('SPREADSHEET_ID env var is not set');
          controller.close();
          return;
        }

        // Gmail auth check
        console.log('Fetching Gmail...');
        const gmail = getGmailClient(accessToken);
        const gmailCheck = await verifyGmailAccess(gmail);
        console.log('Gmail response:', JSON.stringify(gmailCheck).slice(0, 200));

        if (!gmailCheck.ok) {
          sendError('Gmail access failed — token may be missing gmail.readonly scope', gmailCheck.error);
        }

        // Read Google Sheets
        send('Reading spreadsheet...');
        console.log('Fetching sheets data...');

        const sheets = getSheetsClient(accessToken);
        let sheetContacts: Awaited<ReturnType<typeof readAllContacts>> = [];

        try {
          sheetContacts = await readAllContacts(sheets, SPREADSHEET_ID);
          console.log('Sheets response: contacts found:', sheetContacts.length,
            '| first:', JSON.stringify(sheetContacts[0] ?? null).slice(0, 200));
          send('Spreadsheet read', `${sheetContacts.length} contacts found`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('Sheets response: ERROR:', msg);
          sendError('Failed to read Google Sheets', err);
          sheetContacts = [];
        }

        send('Scanning Gmail threads...');

        let gmailThreadsRead = 0;
        const processed: Record<string, unknown>[] = [];
        const cacheThreshold = new Date(Date.now() - CACHE_HOURS * 3600 * 1000).toISOString();

        send('Processing contacts...', `${sheetContacts.length} total`);

        for (let i = 0; i < sheetContacts.length; i++) {
          const contact = sheetContacts[i];
          send(`Analysing ${i + 1}/${sheetContacts.length}`, contact.name);

          if (!force) {
            try {
              let cacheQuery = supabase
                .from('contacts')
                .select('id, last_synced')
                .eq('name', contact.name)
                .gte('last_synced', cacheThreshold);
              if (contact.company) {
                cacheQuery = cacheQuery.eq('company', contact.company);
              }
              const { data: cached } = await cacheQuery.maybeSingle();

              if (cached) {
                console.log('[Sync] Cache hit for', contact.name);
                processed.push({ _cached: true });
                continue;
              }
            } catch (err) {
              console.warn('[Sync] Cache check failed for', contact.name, err);
            }
          }

          let threadInfo = null;
          if (contact.email) {
            if (!gmailCheck.ok) {
              console.warn('[Sync] Skipping Gmail for', contact.name, '— Gmail auth failed');
            } else {
              try {
                console.log(`[Gmail] Fetching threads for ${contact.name} <${contact.email}>`);
                threadInfo = await getThreadsForEmail(gmail, contact.email, 'chaudhry.ali044@gmail.com');
                gmailThreadsRead++;
                console.log(
                  `[Gmail] ${contact.name}: sent=${threadInfo.emailsSent} received=${threadInfo.emailsReceived}`,
                  `meeting=${threadInfo.meetingHappened} snippets=${threadInfo.snippets.length}`
                );
              } catch (err) {
                console.warn('[Gmail] Lookup failed for', contact.name, err instanceof Error ? err.message : err);
              }
            }
          } else {
            console.log(`[Gmail] No email for ${contact.name} — skipping`);
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
            send(`AI summary for ${contact.name}...`);
            try {
              const analysis = await analyzeThread(contact.name, contact.company ?? '', threadInfo.snippets);
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

        // ── Save to Supabase ─────────────────────────────────────────────
        const toSave = processed.filter(c => !c._cached);
        send(`Saving ${toSave.length} contacts...`);
        console.log('[Sync] Upserting', toSave.length, 'contacts (cached:', processed.length - toSave.length, ')');

        if (toSave.length > 0) {
          // Upsert all contacts using name+company as the unique conflict key.
          // Requires unique constraint: ALTER TABLE contacts ADD CONSTRAINT
          // contacts_name_company_unique UNIQUE (name, company);
          const { error: upsertErr } = await supabase
            .from('contacts')
            .upsert(toSave, { onConflict: 'name,company', ignoreDuplicates: false });

          if (upsertErr) {
            console.error('[Sync] Upsert error:', upsertErr.message);
            sendError('Supabase upsert error', upsertErr.message);
          } else {
            console.log('[Sync] Upserted', toSave.length, 'contacts (conflict key: name,company)');
          }
        }

        const { error: logErr } = await supabase.from('sync_log').insert({
          contacts_processed: processed.length,
          gmail_threads_read: gmailThreadsRead,
          status: 'success',
        });
        if (logErr) console.error('[Sync] Failed to write sync_log:', logErr.message);

        const summary = `${processed.length} contacts, ${gmailThreadsRead} Gmail threads`;
        send('Sync complete!', summary);
        console.log('[Sync] Done —', summary);

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[Sync] Unhandled error:', msg);
        controller.enqueue(encoder.encode(JSON.stringify({ step: 'Error', detail: msg }) + '\n'));
        try {
          await supabase.from('sync_log').insert({ contacts_processed: 0, gmail_threads_read: 0, status: `error: ${msg}` });
        } catch { /* ignore */ }
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
  try {
    const { data, error } = await supabase
      .from('sync_log')
      .select('*')
      .order('synced_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[Sync] GET sync_log error:', error.message);
      return NextResponse.json({ status: 'sync route alive', lastSync: null, error: error.message });
    }
    return NextResponse.json({ status: 'sync route alive', lastSync: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ status: 'sync route alive', lastSync: null, error: msg });
  }
}
