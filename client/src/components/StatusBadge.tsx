import { getStatusConfig } from './statusConfig';

export default function StatusBadge({ status, small }: { status: string; small?: boolean }) {
  const cfg = getStatusConfig(status);
  const Icon = cfg.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 capitalize border rounded-full ${
        small ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs'
      } ${cfg.badge}`}
    >
      <span className={`rounded-full shrink-0 ${small ? 'w-1.5 h-1.5' : 'w-2 h-2'} ${cfg.dot}`} />
      {!small && <Icon className="w-3 h-3 opacity-80" />}
      {cfg.label}
    </span>
  );
}
