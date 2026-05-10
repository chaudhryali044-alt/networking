'use client';

const statusMap: Record<string, string> = {
  'Needs Response': 'badge badge-needs-response',
  'Awaiting Reply': 'badge badge-awaiting-reply',
  'Gone Cold': 'badge badge-gone-cold',
  'Meeting Had — Follow Up': 'badge badge-meeting-had',
  'Recent Meeting': 'badge badge-recent-meeting',
  'Opportunity Active': 'badge badge-opportunity-active',
  'No Response': 'badge badge-no-response',
  'Unverified': 'badge badge-unverified',
};

const labelMap: Record<string, string> = {
  'Needs Response': 'Needs Response',
  'Awaiting Reply': 'Awaiting Reply',
  'Gone Cold': 'Gone Cold',
  'Meeting Had — Follow Up': 'Meeting Had',
  'Recent Meeting': 'Recent Meeting',
  'Opportunity Active': 'Opportunity',
  'No Response': 'No Response',
  'Unverified': 'Unverified',
};

export default function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const cls = statusMap[status] ?? 'badge badge-unverified';
  const label = labelMap[status] ?? status;
  return <span className={cls}>{label}</span>;
}
