import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';
import { ConversationStatus, STATUS_CONFIG, STATUS_OPTIONS } from './statusConfig';

interface Props {
  value: string;
  onChange: (status: ConversationStatus) => void;
  disabled?: boolean;
}

export default function StatusSelector({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = getSafeConfig(value);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const select = (status: ConversationStatus) => {
    onChange(status);
    setOpen(false);
  };

  const CurrentIcon = current.icon;

  return (
    <div ref={ref} className="relative">
      <motion.button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        whileTap={{ scale: 0.98 }}
        className={`
          flex items-center gap-2.5 pl-2.5 pr-3 py-2 rounded-xl border text-sm font-medium
          transition-all duration-200 disabled:opacity-50
          ${current.badge} ${open ? `ring-2 ${current.ring} ${current.glow}` : ''}
        `}
      >
        <span className="relative flex h-2.5 w-2.5">
          {value === 'active' && (
            <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${current.dot}`} />
          )}
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${current.dot}`} />
        </span>
        <CurrentIcon className="w-4 h-4 shrink-0" />
        <span className="capitalize">{current.label}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-4 h-4 opacity-70" />
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute right-0 top-full mt-2 w-64 z-50 card p-1.5 shadow-2xl border-slate-700/80"
          >
            <p className="px-3 py-2 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              Update Status
            </p>
            {STATUS_OPTIONS.map((status, i) => {
              const cfg = STATUS_CONFIG[status];
              const Icon = cfg.icon;
              const isSelected = status === value;

              return (
                <motion.button
                  key={status}
                  type="button"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.15 }}
                  whileHover={{ scale: 1.02, x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => select(status)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors
                    ${isSelected ? `${cfg.badge} border` : `border border-transparent ${cfg.hover}`}
                  `}
                >
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />
                  <span className={`p-1.5 rounded-lg ${isSelected ? 'bg-black/20' : 'bg-slate-800/80'}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium capitalize">{cfg.label}</span>
                    <span className="block text-[11px] text-slate-400 truncate">{cfg.description}</span>
                  </span>
                  {isSelected && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    >
                      <Check className="w-4 h-4 shrink-0" />
                    </motion.span>
                  )}
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function getSafeConfig(status: string) {
  return STATUS_CONFIG[status as ConversationStatus] ?? STATUS_CONFIG.active;
}
