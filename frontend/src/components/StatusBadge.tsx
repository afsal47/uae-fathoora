const colors: Record<string, string> = {
  DRAFT: 'badge-neutral',
  QUEUED: 'badge-warning',
  SUBMITTING: 'badge-info',
  SUBMITTED: 'badge-accent',
  ACCEPTED: 'badge-success',
  COMPLETED: 'badge-success',
  REJECTED: 'badge-danger',
  FAILED: 'badge-danger',
  CANCELLED: 'badge-neutral',
};

export default function StatusBadge({ status }: { status: string }) {
  const cls = colors[status] ?? 'badge-neutral';
  return <span className={`badge ${cls}`}>{status}</span>;
}
