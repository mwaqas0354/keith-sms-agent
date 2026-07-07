import {
  Radio, AlertTriangle, Pause, Trophy, XCircle, type LucideIcon,
} from 'lucide-react';

export type ConversationStatus = 'active' | 'escalated' | 'paused' | 'won' | 'lost';

export const STATUS_OPTIONS: ConversationStatus[] = ['active', 'escalated', 'paused', 'won', 'lost'];

export const STATUS_CONFIG: Record<ConversationStatus, {
  label: string;
  description: string;
  icon: LucideIcon;
  badge: string;
  dot: string;
  ring: string;
  hover: string;
  glow: string;
}> = {
  active: {
    label: 'Active',
    description: 'AI is handling the conversation',
    icon: Radio,
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    dot: 'bg-emerald-400',
    ring: 'ring-emerald-500/50',
    hover: 'hover:bg-emerald-500/10',
    glow: 'shadow-[0_0_12px_rgba(52,211,153,0.35)]',
  },
  escalated: {
    label: 'Escalated',
    description: 'Requires human attention',
    icon: AlertTriangle,
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    dot: 'bg-amber-400',
    ring: 'ring-amber-500/50',
    hover: 'hover:bg-amber-500/10',
    glow: 'shadow-[0_0_12px_rgba(251,191,36,0.35)]',
  },
  paused: {
    label: 'Paused',
    description: 'Agent took over — AI paused',
    icon: Pause,
    badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    dot: 'bg-sky-400',
    ring: 'ring-sky-500/50',
    hover: 'hover:bg-sky-500/10',
    glow: 'shadow-[0_0_12px_rgba(56,189,248,0.35)]',
  },
  won: {
    label: 'Won',
    description: 'Deal closed successfully',
    icon: Trophy,
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    dot: 'bg-emerald-400',
    ring: 'ring-emerald-500/50',
    hover: 'hover:bg-emerald-500/10',
    glow: 'shadow-[0_0_12px_rgba(52,211,153,0.35)]',
  },
  lost: {
    label: 'Lost',
    description: 'Deal closed — no sale',
    icon: XCircle,
    badge: 'bg-red-500/20 text-red-300 border-red-500/40',
    dot: 'bg-red-400',
    ring: 'ring-red-500/50',
    hover: 'hover:bg-red-500/10',
    glow: 'shadow-[0_0_12px_rgba(248,113,113,0.35)]',
  },
};

export function getStatusConfig(status: string) {
  return STATUS_CONFIG[status as ConversationStatus] ?? STATUS_CONFIG.active;
}
