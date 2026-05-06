import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';

const REASONS = [
  { value: 'spam', label: 'Spam or misleading' },
  { value: 'harassment', label: 'Harassment or hate' },
  { value: 'violence', label: 'Violence or self-harm' },
  { value: 'sexual', label: 'Sexual content' },
  { value: 'other', label: 'Something else' },
];

interface Props {
  postId: string | null;
  onClose: () => void;
  onReported?: (postId: string) => void;
}

export function ReportPostDialog({ postId, onClose, onReported }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reason, setReason] = useState('spam');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!postId) return;
    if (!user) { toast({ title: 'Sign in to report' }); return; }
    const rl = checkRateLimit(`report:${user.id}`, RATE_LIMITS.report);
    if (!rl.allowed) {
      toast({ title: 'Slow down', description: `Try again in ${Math.ceil(rl.retryAfterMs / 1000)}s` });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('post_reports').insert({
      post_id: postId,
      reporter_user_id: user.id,
      reason,
      details: details.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      if (error.code === '23505') {
        toast({ title: 'Already reported', description: 'Thanks — our team will review it.' });
        onReported?.(postId);
        onClose();
        return;
      }
      toast({ title: 'Could not submit report', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Report submitted', description: 'Thanks for keeping EchoFeed safe.' });
    onReported?.(postId);
    setDetails('');
    onClose();
  };

  return (
    <Dialog open={!!postId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-background border-white/10">
        <DialogHeader>
          <DialogTitle>Report this post</DialogTitle>
          <DialogDescription>Help us keep the feed safe. Reports are confidential.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            {REASONS.map((r) => (
              <label key={r.value} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                />
                {r.label}
              </label>
            ))}
          </div>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value.slice(0, 500))}
            placeholder="Optional details (max 500 chars)"
            className="w-full min-h-[72px] bg-white/5 border border-white/10 rounded-md p-2 text-sm"
          />
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="text-xs px-4 py-2 rounded-full border border-white/10 hover:bg-white/5">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={submitting}
              className="text-xs px-4 py-2 rounded-full bg-echo-purple text-white disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit report'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
