import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  onResponse: (response: 'agree' | 'disagree' | 'complicated') => void;
  onDismiss: () => void;
}

/**
 * Slim strip that surfaces below a feed post when the user dwells on it.
 * One-tap response only. Auto-collapses externally after 8s.
 */
export function MicroInteractionStrip({ onResponse, onDismiss }: Props) {
  const [picked, setPicked] = useState<string | null>(null);

  const handle = (r: 'agree' | 'disagree' | 'complicated') => {
    setPicked(r);
    onResponse(r);
    setTimeout(onDismiss, 800);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8, height: 0 }}
        animate={{ opacity: 1, y: 0, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className="overflow-hidden"
      >
        <div className="mt-2 px-4 py-2 rounded-xl border border-echo-purple/20 bg-echo-purple/5 flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground shrink-0">Quick read?</span>
          <div className="flex gap-1.5">
            {(['agree', 'complicated', 'disagree'] as const).map((r) => (
              <button
                key={r}
                disabled={!!picked}
                onClick={() => handle(r)}
                className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all border ${
                  picked === r
                    ? 'bg-echo-purple text-white border-echo-purple'
                    : 'bg-white/5 text-foreground border-white/10 hover:border-echo-purple/40'
                }`}
              >
                {r === 'agree' ? 'Agree' : r === 'complicated' ? "It's complicated" : 'Disagree'}
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
