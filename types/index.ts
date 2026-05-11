export type TrueStatus =
  | 'Meeting Confirmed'
  | 'Active'
  | 'Replied — Follow Up Needed'
  | 'Awaiting Reply'
  | 'No Response'
  | 'Gone Cold'
  // Legacy
  | 'Recent Meeting'
  | 'Meeting Had — Follow Up'
  | 'Needs Response'
  | 'Opportunity Active'
  | 'Unverified';

export type Urgency = 'high' | 'medium' | 'low';

export interface Contact {
  id: string;
  name: string;
  company: string | null;
  role: string | null;
  email: string | null;
  region: string | null;
  spreadsheet_status: string | null;
  true_status: TrueStatus | null;
  first_contact_date: string | null;
  last_contact_date: string | null;
  emails_sent: number;
  emails_received: number;
  meeting_happened: boolean;
  meeting_date: string | null;
  ai_summary: string | null;
  next_action: string | null;
  urgency: Urgency | null;
  notes: string | null;
  thread_snippet: string | null;
  last_synced: string;
  created_at: string;
}

export interface SyncLog {
  id: string;
  synced_at: string;
  contacts_processed: number;
  gmail_threads_read: number;
  status: string;
}

export interface SyncProgress {
  step: string;
  detail?: string;
}

export interface EmailDraft {
  subject: string;
  body: string;
}

export interface AIAnalysis {
  summary: string;
  nextAction: string;
  urgency: Urgency;
}

export interface DiscoverSuggestion {
  name: string;
  role: string;
  reason: string;
  outreachAngle: string;
}

export interface GmailThread {
  id: string;
  thread_id: string;
  subject: string | null;
  from_address: string | null;
  to_address: string | null;
  latest_date: string | null;
  snippet: string | null;
  has_reply: boolean;
  contact_email: string | null;
  contact_name: string | null;
  synced_at: string;
}
