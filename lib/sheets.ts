import { google } from 'googleapis';

export function getSheetsClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.sheets({ version: 'v4', auth });
}

export interface SheetContact {
  name: string;
  company: string | null;
  role: string | null;
  email: string | null;
  region: string | null;
  status: string | null;
  notes: string | null;
}

function cleanStr(val: string | undefined): string | null {
  if (!val || val.trim() === '') return null;
  return val.trim();
}

export async function readAllContacts(
  sheets: ReturnType<typeof getSheetsClient>,
  spreadsheetId: string
): Promise<SheetContact[]> {
  const contacts: Map<string, SheetContact> = new Map();

  console.log('[Sheets] Reading spreadsheet ID:', spreadsheetId);

  let sheetNames: string[] = [];
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    sheetNames = (meta.data.sheets ?? []).map(s => s.properties?.title ?? '');
    console.log('[Sheets] Found sheets:', sheetNames);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Sheets] ERROR fetching spreadsheet metadata:', msg);
    throw err;
  }

  for (const sheetName of sheetNames) {
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${sheetName}'!A1:J200`,
      });

      const rows = res.data.values ?? [];
      console.log(`[Sheets] Sheet "${sheetName}": ${rows.length} rows`);

      if (rows.length < 2) {
        console.log(`[Sheets] Sheet "${sheetName}": skipping (< 2 rows)`);
        continue;
      }

      const header = rows[0].map((h: string) => String(h).toLowerCase().trim());
      console.log(`[Sheets] Sheet "${sheetName}" headers:`, header);

      const colIdx = (names: string[]) => {
        for (const n of names) {
          const i = header.findIndex(h => h.includes(n));
          if (i !== -1) return i;
        }
        return -1;
      };

      const nameIdx = colIdx(['contact name', 'name', 'first name']);
      const companyIdx = colIdx(['company', 'firm']);
      const statusIdx = colIdx(['status', 'campaign status']);
      const emailIdx = colIdx(['email']);
      const roleIdx = colIdx(['role', 'position', 'title']);
      const notesIdx = colIdx(['notes', 'note']);
      const lastNameIdx = colIdx(['last name']);

      if (nameIdx === -1) {
        console.log(`[Sheets] Sheet "${sheetName}": no name column found — skipping`);
        continue;
      }

      let addedFromSheet = 0;
      for (const row of rows.slice(1)) {
        let name = cleanStr(row[nameIdx]);
        if (!name) continue;

        if (lastNameIdx !== -1 && row[lastNameIdx]) {
          name = `${name} ${row[lastNameIdx]}`.trim();
        }

        const company = companyIdx !== -1 ? cleanStr(row[companyIdx]) : null;
        const key = `${name.toLowerCase()}|${(company ?? '').toLowerCase()}`;

        if (!contacts.has(key)) {
          const region = sheetName.toLowerCase().includes('dubai')
            ? 'Dubai'
            : sheetName.toLowerCase().includes('uk') || sheetName.toLowerCase().includes('london')
            ? 'London'
            : null;

          contacts.set(key, {
            name,
            company,
            role: roleIdx !== -1 ? cleanStr(row[roleIdx]) : null,
            email: emailIdx !== -1 ? cleanStr(row[emailIdx]) : null,
            region,
            status: statusIdx !== -1 ? cleanStr(row[statusIdx]) : null,
            notes: notesIdx !== -1 ? cleanStr(row[notesIdx]) : null,
          });
          addedFromSheet++;
        }
      }
      console.log(`[Sheets] Sheet "${sheetName}": added ${addedFromSheet} contacts`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Sheets] ERROR reading sheet "${sheetName}":`, msg);
    }
  }

  const total = contacts.size;
  console.log('[Sheets] Total unique contacts parsed:', total);
  return Array.from(contacts.values());
}
