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
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { force } = await req.json().catch(() => ({ force: false }));
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (step: string, detail?: string) => {
        const data = JSON.stringify({ step, detail }) + '\n';
        controller.enqueue(encoder.encode(data));
      };

      try {
        send('Reading spreadsheet...');
        const sheets = getSheetsClient(session.accessToken!);
        const sheetContacts = await readAllContacts(sheets, SPREADSHEET_ID);
        send('Spreadsheet read', `${sheetContacts.length} contacts found`);

        const gmail = getGmailClient(session.accessToken!);
        send('Scanning Gmail (last 10 months)...');

        let gmailThreadsRead = 0;
        const processed: Record<string, unknown>[] = [];

        const cacheThreshold = new Date(Date.now() - CACHE_HOURS * 3600 * 1000).toISOString();

        for (let i = 0; i < sheetContacts.length; i++) {
          const contact = sheetContacts[i];
          send(`Analysing contact ${i + 1}/${sheetContacts.length}`, contact.name);

          // Check cache
          if (!force && contact.email) {
            const { data: cached } = await supabase
              .from('contacts')
              .select('*')
              .eq('email', contact.email)
              .gte('last_synced', cacheThreshold)
              .single();

            if (cached) {
              processed.push({ ...cached, _cached: true });
              continue;
            }
          }

          let threadInfo = null;
          if (contact.email) {
            threadInfo = await getThreadsForEmail(gmail, contact.email, 'chaudhry.ali044@gmail.com');
            gmailThreadsRead++;
          }

          const trueStatus = threadInfo
            ? computeTrueStatus(threadInfo, contact.status)
            : contact.status ?? 'Unverified';

          let aiSummary = null;
          let nextAction = null;
          let urgency = null;

          const hasRecentActivity = threadInfo &&
            threadInfo.lastContactDate &&
            (Date.now() - threadInfo.lastContactDate.getTime()) < 60 * 24 * 60 * 60 * 1000;

          if (hasRecentActivity && threadInfo && threadInfo.snippets.length > 0) {
            send(`Generating AI summary for ${contact.name}...`);
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
          }

          const record = {
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
          };

          processed.push(record);
        }

        send(`Saving ${processed.length} contacts to database...`);

        // Upsert all contacts
        const toSave = processed.filter((c) => !(c as Record<string, unknown>)._cached);
        if (toSave.length > 0) {
          const { error } = await supabase
            .from('contacts')
            .upsert(toSave, { onConflict: 'email' });

          if (error) {
            // Try insert without conflict resolution
            await supabase.from('contacts').insert(toSave);
          }
        }

        // Log sync
        await supabase.from('sync_log').insert({
          contacts_processed: processed.length,
          gmail_threads_read: gmailThreadsRead,
          status: 'success',
        });

        send('Sync complete!', `${processed.length} contacts processed`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
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
  const { data } = await supabase
    .from('sync_log')
    .select('*')
    .order('synced_at', { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json({ lastSync: data });
}
