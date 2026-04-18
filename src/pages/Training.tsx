import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useEcho } from '@/hooks/useEcho';
import { supabase } from '@/integrations/supabase/client';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

interface Checkin {
  id: string;
  echo_response: string | null;       // the prompt Echo generated
  user_message: string | null;        // creator's reply
  created_at: string;
  processed: boolean;
}

const Training = () => {
  const { echo } = useEcho();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [echoPrompt, setEchoPrompt] = useState('');
  const [promptLoading, setPromptLoading] = useState(false);
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

  useEffect(() => {
    if (!echo) return;

    const generatePrompt = async () => {
      setPromptLoading(true);
      try {
        const { data } = await supabase.functions.invoke('echo-generate', {
          body: { type: 'checkin', echo_id: echo.id },
        });
        setEchoPrompt(data?.content || "I've been reflecting on our recent discussions. What's been on your mind?");
      } catch {
        setEchoPrompt("I've been thinking about our conversations. What's your take on recent developments?");
      } finally {
        setPromptLoading(false);
      }
    };

    generatePrompt();
    fetchHistory(echo.id);
  }, [echo]);

  const handleSubmit = async () => {
    if (!echo || !response.trim()) return;
    setSubmitting(true);
    try {
      // Save training session: echo_response = the prompt Echo asked, user_message = creator's reply
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

      await supabase
        .from('echoes')
        .update({ evolution_score: (echo.evolution_score || 0) + 2 })
        .eq('id', echo.id);

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
          <span className="font-bold gradient-text">Daily Check-in</span>
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
          ) : (
            <p className="text-sm text-foreground/90 leading-relaxed italic">"{echoPrompt}"</p>
          )}
        </motion.div>

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
