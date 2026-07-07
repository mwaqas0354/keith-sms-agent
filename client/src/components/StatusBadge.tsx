const statusStyles: Record<string, string> = {
  active: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  escalated: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  paused: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  closed: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  won: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  lost: 'bg-red-500/20 text-red-300 border-red-500/30',
};

export default function StatusBadge({ status, small }: { status: string; small?: boolean }) {
  return (
    <span
      className={`inline-flex items-center capitalize border rounded-full ${
        small ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs'
      } ${statusStyles[status] || statusStyles.active}`}
    >
      {status}
    </span>
  );
}
