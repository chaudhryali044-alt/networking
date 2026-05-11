'use client';

const CONFIG: Record<string, { cls: string; label: string }> = {
  'Meeting Confirmed':          { cls: 'badge badge-recent-meeting',     label: 'Meeting ✓'      },
  'Active':                     { cls: 'badge badge-opportunity-active', label: 'Active'         },
  'Replied — Follow Up Needed': { cls: 'badge badge-needs-response',    label: 'Follow Up'      },
  'Awaiting Reply':             { cls: 'badge badge-awaiting-reply',     label: 'Awaiting Reply' },
  'No Response':                { cls: 'badge badge-no-response',        label: 'No Response'    },
  'Gone Cold':                  { cls: 'badge badge-gone-cold',          label: 'Gone Cold'      },
  // Legacy statuses
  'Needs Response':             { cls: 'badge badge-needs-response',     label: 'Needs Response' },
  'Meeting Had — Follow Up':    { cls: 'badge badge-meeting-had',        label: 'Meeting Had'    },
  'Recent Meeting':             { cls: 'badge badge-recent-meeting',     label: 'Recent Meeting' },
  'Opportunity Active':         { cls: 'badge badge-opportunity-active', label: 'Opportunity'    },
  'Unverified':                 { cls: 'badge badge-unverified',         label: 'Unverified'     },
};

export default function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const cfg = CONFIG[status] ?? { cls: 'badge badge-unverified', label: status };
  return <span className={cfg.cls}>{cfg.label}</span>;
}
