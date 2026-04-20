import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useEcho } from '@/hooks/useEcho';
import { supabase } from '@/integrations/supabase/client';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

type Phase = 'topic' | 'debate' | 'refining' | 'refined';

interface Turn {
  from: 'echo' | 'user';
  text: string;
}

const MIN_EXCHANGES_FOR_REFINE = 3;

const Spar = () => {
  const { user } = useAuth();
  const { echo, loading } = useEcho();
  const navigate = useNavigate();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [phase, setPhase] = useState<Phase>('topic');
  const [topic, setTopic] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [working, setWorking] = useState(false);
  const [refined, setRefined] = useState<{ content: string; stance_tag: string } | null>(null);

  useEffect(() => {
    if (!loading && !echo) navigate('/onboarding');
    if (!user) navigate('/login');
  }, [loading, echo, user, navigate]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, phase]);

  const userExchanges = turns.filter(t => t.from === 'user').length;

  const buildTranscript = (extra?: Turn[]) => {
    const all = extra ? [...turns, ...extra] : turns;
    return [
      `Topic: ${topic}`,
      ...all.map(t => `${t.from === 'echo' ? echo!.name : 'Creator'}: ${t.text}`),
    ].join('\n');
  };

  const startDebate = async () => {
    if (!echo || topic.trim().length < 10) {
      toast({ title: 'Be specific', description: 'Give Echo something real to push back on.' });
      return;
    }
    setWorking(true);
    setPhase('debate');
    try {
      const { data, error } = await supabase.functions.invoke('echo-generate', {
        body: { type: 'sparring', echo_id: echo.id, post_content: topic.trim(), topic: topic.trim() },
      });
      if (error || !data?.content || data?.error) {
        console.error('Sparring open failed:', error || data?.error);
        toast({ title: `${echo.name} stalled`, description: 'Try again.', variant: 'destructive' });
        setPhase('topic');
      } else {
        setTurns([{ from: 'echo', text: data.content }]);
      }
    } catch (err: any) {
      console.error('Sparring open threw:', err);
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      setPhase('topic');
    } finally {
      setWorking(false);
    }
  };

  const sendReply = async () => {
    if (!echo || !input.trim()) return;
    const userTurn: Turn = { from: 'user', text: input.trim() };
    setTurns(t => [...t, userTurn]);
    setInput('');
    setWorking(true);
    try {
      const transcript = buildTranscript([userTurn]);
      const { data, error } = await supabase.functions.invoke('echo-generate', {
        body: {
          type: 'sparring',
          echo_id: echo.id,
          post_content: `Original topic: "${topic}"\n\nDebate so far:\n${transcript}\n\nContinue your counter — push them harder.`,
          topic,
        },
      });
      if (error || !data?.content || data?.error) {
        console.error('Sparring reply failed:', error || data?.error);
        toast({ title: `${echo.name} couldn't respond`, description: 'Try sending again.', variant: 'destructive' });
      } else {
        setTurns(t => [...t, { from: 'echo', text: data.content }]);
      }
    } catch (err: any) {
      console.error('Sparring reply threw:', err);
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setWorking(false);
    }
  };

  const refineToPost = async () => {
    if (!echo) return;
    setPhase('refining');
    setWorking(true);
    try {
      const { data, error } = await supabase.functions.invoke('echo-generate', {
        body: {
          type: 'sparring_refine',
          echo_id: echo.id,
          post_content: buildTranscript(),
          topic,
        },
      });
      if (error || !data?.content || data?.error) {
        console.error('Refine failed:', error || data?.error);
        toast({ title: 'Refinement failed', description: 'Try again.', variant: 'destructive' });
        setPhase('debate');
      } else {
        setRefined({ content: data.content, stance_tag: data.stance_tag || `On: ${topic.slice(0, 40)}` });
        setPhase('refined');
      }
    } catch (err: any) {
      console.error('Refine threw:', err);
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      setPhase('debate');
    } finally {
      setWorking(false);
    }
  };

  const publish = async () => {
    if (!echo || !refined) return;
    setWorking(true);
    try {
      // Save the full sparring exchange as a memory so it shapes future generations
      await supabase.from('echo_memories').insert({
        echo_id: echo.id,
        memory_type: 'sparring_session',
        content: `Topic: ${topic}\n\nFinal position published: ${refined.content}\n\nKey objection raised: ${turns.find(t => t.from === 'echo')?.text || ''}`,
      });
      await supabase.from('posts').insert({
        echo_id: echo.id,
        content: refined.content,
        stance_tag: refined.stance_tag,
        topic,
        status: 'published',
      });
      toast({ title: 'Published', description: 'Your refined post is live on EchoFeed.' });
      navigate('/feed');
    } catch (err: any) {
      toast({ title: 'Publish failed', description: err.message, variant: 'destructive' });
    } finally {
      setWorking(false);
    }
  };

  const copyToClipboard = async () => {
    if (!refined) return;
    await navigator.clipboard.writeText(refined.content);
    toast({ title: 'Copied', description: 'Paste it anywhere.' });
  };

  if (loading || !echo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-echo-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-white/5">
        <div className="max-w-2xl mx-auto px-5 h-12 flex items-center justify-between">
          <button onClick={() => navigate('/dashboard')} className="text-xs text-muted-foreground hover:text-foreground transition-colors">← Dashboard</button>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Private · Sparring with {echo.name}
          </span>
          <div />
        </div>
      </header>

      {/* Topic phase */}
      {phase === 'topic' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex-1 flex flex-col justify-center px-5 py-10 max-w-2xl mx-auto w-full">
          <p className="font-display text-2xl text-foreground/95 mb-3 text-balance">
            What do you want to publish about?
          </p>
          <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
            {echo.name} will play your sharpest opponent before you post. Nothing here is public until you choose.
          </p>
          <Textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="One sentence is enough. Be specific."
            className="bg-white/5 border-white/10 min-h-[120px] text-sm"
            autoFocus
          />
          <button
            onClick={startDebate}
            disabled={topic.trim().length < 10 || working}
            className="mt-5 self-start gradient-btn text-white text-sm font-medium px-6 py-3 rounded-full transition-all disabled:opacity-40"
          >
            {working ? 'Opening…' : 'Start sparring →'}
          </button>
        </motion.div>
      )}

      {/* Debate phase */}
      {(phase === 'debate' || phase === 'refining') && (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6 max-w-2xl mx-auto w-full space-y-4">
            <div className="hairline" />
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Topic</p>
            <p className="text-sm text-foreground/80 italic mb-4">"{topic}"</p>
            <div className="hairline" />

            <AnimatePresence initial={false}>
              {turns.map((t, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${t.from === 'user' ? 'justify-end' : ''}`}
                >
                  {t.from === 'echo' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-echo-purple to-echo-green flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {echo.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    t.from === 'echo'
                      ? 'bg-white/5 border border-white/10 text-foreground rounded-tl-sm'
                      : 'bg-echo-purple/20 border border-echo-purple/30 text-foreground rounded-tr-sm'
                  }`}>
                    {t.text}
                  </div>
                </motion.div>
              ))}
              {(working || phase === 'refining') && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-echo-purple to-echo-green flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {echo.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="px-4 py-3 rounded-2xl bg-white/5 border border-white/10 flex gap-1">
                    {[0, 0.2, 0.4].map((d, i) => (
                      <motion.div key={i} className="w-2 h-2 rounded-full bg-echo-purple"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: d }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {phase === 'debate' && (
            <div className="border-t border-white/5 bg-background/80 backdrop-blur-md px-5 py-4 max-w-2xl mx-auto w-full space-y-3">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Push back on ${echo.name}…`}
                className="bg-white/5 border-white/10 text-sm min-h-[70px] resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    sendReply();
                  }
                }}
              />
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {userExchanges} / {MIN_EXCHANGES_FOR_REFINE} exchanges
                </span>
                <div className="flex gap-2">
                  {userExchanges >= MIN_EXCHANGES_FOR_REFINE && (
                    <button
                      onClick={refineToPost}
                      disabled={working}
                      className="text-xs font-medium px-4 py-2 rounded-full border border-white/15 hover:border-white/40 hover:bg-white/5 transition-all"
                    >
                      Show my refined argument →
                    </button>
                  )}
                  <button
                    onClick={sendReply}
                    disabled={!input.trim() || working}
                    className="gradient-btn text-white text-sm font-medium px-5 py-2 rounded-full transition-all disabled:opacity-40"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Refined output */}
      {phase === 'refined' && refined && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex-1 px-5 py-8 max-w-2xl mx-auto w-full space-y-6 overflow-y-auto">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
              Your actual argument
            </p>
            <Textarea
              value={refined.content}
              onChange={(e) => setRefined({ ...refined, content: e.target.value })}
              className="bg-white/5 border-white/10 min-h-[220px] text-base leading-relaxed"
            />
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs text-muted-foreground">Stance:</span>
              <input
                value={refined.stance_tag}
                onChange={(e) => setRefined({ ...refined, stance_tag: e.target.value })}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-echo-purple"
              />
            </div>
          </div>

          <div className="hairline" />

          <div className="flex flex-wrap gap-3">
            <button
              onClick={publish}
              disabled={working || !refined.content.trim()}
              className="gradient-btn text-white text-sm font-medium px-6 py-3 rounded-full transition-all disabled:opacity-40"
            >
              {working ? 'Publishing…' : 'Publish to EchoFeed'}
            </button>
            <button
              onClick={copyToClipboard}
              className="text-sm font-medium px-5 py-3 rounded-full border border-white/15 hover:border-white/40 hover:bg-white/5 transition-all"
            >
              Copy to clipboard
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-3"
            >
              Save as draft for now
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default Spar;
