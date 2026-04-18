import { useEffect, useRef, useState } from 'react';
import { IntellectualCard } from './IntellectualCard';
import { MicroInteractionStrip } from './MicroInteractionStrip';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  postId: string;
  echoId: string;          // owner echo of the post
  myEchoId: string | null; // viewer's own echo (for behavioral_logs)
  card: {
    avatarUrl?: string | null;
    echoName: string;
    niche: string;
    content: string;
    stanceTag: string;
    evolutionScore: number;
    timestamp: string;
    likesCount?: number;
    commentsCount?: number;
    onLike?: () => void;
    onComment?: () => void;
    onShare?: () => void;
    onClick?: () => void;
  };
  microShownThisSession: boolean;
  onMicroShown: () => void;
}

const DWELL_LOG_THRESHOLD = 2000;
const MICRO_THRESHOLD = 8000;

/**
 * Wraps an IntellectualCard with IntersectionObserver-based dwell tracking.
 * - Logs sessions over 2s to behavioral_logs
 * - Shows micro-interaction strip when dwell crosses 8s (max once per session)
 */
export function TrackedFeedPost({ postId, echoId: _echoId, myEchoId, card, microShownThisSession, onMicroShown }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const enterAt = useRef<number | null>(null);
  const accumulated = useRef(0);
  const [showMicro, setShowMicro] = useState(false);
  const microTimer = useRef<number | null>(null);
  const dismissTimer = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !myEchoId) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
          enterAt.current = performance.now();

          // Schedule micro-interaction at 8s of continuous dwell
          if (!microShownThisSession && !showMicro) {
            microTimer.current = window.setTimeout(() => {
              setShowMicro(true);
              onMicroShown();
              // auto-dismiss after 8s
              dismissTimer.current = window.setTimeout(() => setShowMicro(false), 8000);
            }, MICRO_THRESHOLD);
          }
        } else {
          if (enterAt.current !== null) {
            const dwell = performance.now() - enterAt.current;
            accumulated.current += dwell;
            enterAt.current = null;

            if (microTimer.current) {
              clearTimeout(microTimer.current);
              microTimer.current = null;
            }

            if (dwell >= DWELL_LOG_THRESHOLD) {
              supabase.from('behavioral_logs').insert({
                echo_id: myEchoId,
                post_id: postId,
                dwell_time_ms: Math.round(dwell),
                interaction_type: dwell >= MICRO_THRESHOLD ? 'read' : 'scroll_past',
              }).then(() => {});
            }
          }
        }
      });
    }, { threshold: [0, 0.5, 1] });

    observer.observe(el);
    return () => {
      observer.disconnect();
      if (microTimer.current) clearTimeout(microTimer.current);
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [postId, myEchoId, microShownThisSession, onMicroShown, showMicro]);

  const handleMicroResponse = async (response: 'agree' | 'disagree' | 'complicated') => {
    if (!myEchoId) return;
    await supabase.from('micro_interactions').insert({
      echo_id: myEchoId,
      post_id: postId,
      response,
    });
    await supabase.from('behavioral_logs').insert({
      echo_id: myEchoId,
      post_id: postId,
      dwell_time_ms: MICRO_THRESHOLD,
      interaction_type: response === 'agree' ? 'micro_agree' : response === 'disagree' ? 'micro_disagree' : 'micro_complicated',
    });
  };

  return (
    <div ref={ref}>
      <IntellectualCard {...card} />
      {showMicro && (
        <MicroInteractionStrip
          onResponse={handleMicroResponse}
          onDismiss={() => setShowMicro(false)}
        />
      )}
    </div>
  );
}
