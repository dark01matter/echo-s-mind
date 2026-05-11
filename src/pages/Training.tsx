import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useEcho } from '@/hooks/useEcho';
import { supabase } from '@/integrations/supabase/client';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

interface Checkin {
  id: string;
  echo_response: string | null;
  user_message: string | null;
  created_at: string;
  processed: boolean;
}

const Training = () => {
  const { echo } = useEcho();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [echoPrompt, setEchoPrompt] = useState<string | null>(null);
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptFailed, setPromptFailed] = useState(false);
  const [response, setResponse] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<Checkin[]>([]);

  const fetchHistory = async (echoId: string) => {
    const { data } = await supabase
      .from('training_sessions')
      .select('*')
      .eq('echo_id', echoId)
      .order('created_at', { ascending: false })
      .limit(10);
    setHistory((data as Checkin[]) || []);
  };

  const generatePrompt = async () => {
    if (!echo) return;
    setPromptLoading(true);
    setPromptFailed(false);
    try {
      const { data, error } = await supabase.functions.invoke('echo-generate', {
        body: { type: 'checkin', echo_id: echo.id },
      });
      if (error || !data?.content || data?.error) {
        console.error('Checkin prompt failed:', error || data?.error);
        setPromptFailed(true);
        setEchoPrompt(null);
      } else {
        setEchoPrompt(data.content);
      }
    } catch (err) {
      console.error('Checkin prompt threw:', err);
      setPromptFailed(true);
      setEchoPrompt(null);
    } finally {
      setPromptLoading(false);
    }
  };

  useEffect(() => {
    if (!echo) return;
    generatePrompt();
    fetchHistory(echo.id);
  }, [echo]);

  const handleSubmit = async () => {
    if (!echo || !response.trim() || !echoPrompt) return;
    setSubmitting(true);
    try {
      await supabase.from('training_sessions').insert({
        echo_id: echo.id,
        echo_response: echoPrompt,
        user_message: response,
        processed: false,
      });

      await supabase.from('echo_memories').insert({
        echo_id: echo.id,
        content: `Training: Echo asked "${echoPrompt}" — creator replied: "${response}"`,
        memory_type: 'training_response',
      });

      // Training answers are pulled into the next reflection cycle automatically.

      toast({ title: 'Check-in complete', description: 'Echo is learning from your response.' });
      setResponse('');
      fetchHistory(echo.id);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!echo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-echo-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => navigate('/dashboard')} className="text-sm text-muted-foreground hover:text-foreground">← Dashboard</button>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Daily check-in</span>
          <div />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-echo-purple to-echo-green flex items-center justify-center text-sm font-bold text-white">
              {echo.name.charAt(0)}
            </div>
            <div>
              <span className="font-semibold">{echo.name}</span>
              <span className="ml-2 text-xs text-muted-foreground">is reflecting...</span>
            </div>
          </div>
          {promptLoading ? (
            <div className="space-y-2">
              <div className="h-4 bg-white/5 rounded animate-pulse w-3/4" />
              <div className="h-4 bg-white/5 rounded animate-pulse w-1/2" />
            </div>
          ) : promptFailed ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{echo.name} couldn't form a question right now.</p>
              <button
                onClick={generatePrompt}
                className="text-xs font-medium px-3 py-1.5 rounded-full border border-white/15 hover:border-white/40 hover:bg-white/5 transition-all"
              >
                Try again
              </button>
            </div>
          ) : echoPrompt ? (
            <p className="text-sm text-foreground/90 leading-relaxed italic">"{echoPrompt}"</p>
          ) : null}
        </motion.div>

        {echoPrompt && !promptFailed && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-6">
            <h3 className="text-sm font-medium mb-3">Your response</h3>
            <Textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="Share your thoughts in 2-3 sentences..."
              className="bg-white/5 border-white/10 min-h-[100px]"
            />
            <button
              onClick={handleSubmit}
              disabled={!response.trim() || submitting}
              className="mt-3 w-full gradient-btn text-white font-medium py-2.5 rounded-lg text-sm transition-all disabled:opacity-50"
            >
              {submitting ? 'Processing...' : 'Submit Response'}
            </button>
          </motion.div>
        )}

        {history.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Previous Check-ins</h3>
            {history.map((checkin) => (
              <motion.div key={checkin.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-4 space-y-3">
                <div className="text-xs text-muted-foreground">
                  {new Date(checkin.created_at).toLocaleDateString()}
                </div>
                {checkin.echo_response && (
                  <div className="p-3 rounded-lg bg-echo-purple/5 border border-echo-purple/10">
                    <p className="text-xs text-echo-purple mb-1 font-medium">Echo asked:</p>
                    <p className="text-sm text-foreground/80 italic">"{checkin.echo_response}"</p>
                  </div>
                )}
                {checkin.user_message && (
                  <div className="p-3 rounded-lg bg-echo-green/5 border border-echo-green/10">
                    <p className="text-xs text-echo-green mb-1 font-medium">You responded:</p>
                    <p className="text-sm text-foreground/80">"{checkin.user_message}"</p>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Training;
