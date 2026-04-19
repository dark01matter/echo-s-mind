import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { IntellectualCard } from '@/components/IntellectualCard';

const NICHES = [
  'Macroeconomics', 'Technology', 'Philosophy', 'Politics', 'Health & Wellness',
  'Climate & Energy', 'Education', 'Startups', 'Psychology', 'Culture & Media',
];

const STYLE_OPTIONS = [
  { value: 'data', label: 'Data & evidence' },
  { value: 'stories', label: 'Personal stories' },
  { value: 'analogies', label: 'Analogies' },
  { value: 'blunt', label: 'Blunt & direct' },
];

type Phase = 'niche' | 'name' | 'q1' | 'q2' | 'q3' | 'q4' | 'q5' | 'generating' | 'preview' | 'done';

interface Message {
  from: 'echo' | 'user';
  text: string;
}

const Onboarding = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [phase, setPhase] = useState<Phase>('niche');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [working, setWorking] = useState(false);

  const [echoName, setEchoName] = useState('');
  const [niche, setNiche] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [echoId, setEchoId] = useState<string | null>(null);

  const [draft, setDraft] = useState<{ content: string; stance_tag: string } | null>(null);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, phase]);

  // Redirect if no user
  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  // Open with Echo's first line once a niche is picked
  const pushEcho = (text: string) => setMessages(m => [...m, { from: 'echo', text }]);
  const pushUser = (text: string) => setMessages(m => [...m, { from: 'user', text }]);

  const handleNicheSelect = async (n: string) => {
    setNiche(n);
    pushUser(n);
    setPhase('name');
    await delay(400);
    pushEcho("Before we start, what should I call myself? Give me a name — this will be how I show up in the feed.");
  };

  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

  const QUESTIONS: Record<'q1'|'q2'|'q3'|'q4'|'q5', { text: (n: string) => string; key: string; min: number }> = {
    q1: { text: (n) => `I am going to carry your voice publicly. But I need to know what you actually think — not what sounds good. What is one thing you believe in ${n} that most people in that space would push back on?`, key: '1', min: 30 },
    q2: { text: () => `Good. What kind of content in your niche actually annoys you — the stuff that feels fake, overused, or wrong?`, key: '2', min: 20 },
    q3: { text: () => `When you explain something to someone who disagrees with you, do you reach for data and evidence, personal stories, analogies, or just a blunt direct statement?`, key: '3', min: 0 },
    q4: { text: () => `Paste one thing you've written or said publicly that you stand by — a tweet, a comment, a paragraph. Anything in your real voice.`, key: '4', min: 20 },
    q5: { text: () => `Last one. When someone reads something you wrote and it lands exactly right — what do you want them to feel?`, key: '5', min: 0 },
  };

  const submitName = async () => {
    if (input.trim().length < 2) return;
    const name = input.trim();
    setEchoName(name);
    pushUser(name);
    setInput('');
    await delay(500);
    pushEcho(QUESTIONS.q1.text(niche));
    setPhase('q1');
  };

  const submitAnswer = async (phaseKey: 'q1' | 'q2' | 'q4' | 'q5') => {
    const q = QUESTIONS[phaseKey];
    if (input.trim().length < q.min) {
      toast({ title: 'Be more specific', description: 'Generic answers create generic Echoes.' });
      return;
    }
    const ans = input.trim();
    pushUser(ans);
    const merged = { ...answers, [q.key]: ans };
    setAnswers(merged);
    setInput('');
    await delay(500);

    if (phaseKey === 'q1') {
      pushEcho(QUESTIONS.q2.text(niche));
      setPhase('q2');
    } else if (phaseKey === 'q2') {
      pushEcho(QUESTIONS.q3.text(niche));
      setPhase('q3');
    } else if (phaseKey === 'q4') {
      pushEcho(QUESTIONS.q5.text(niche));
      setPhase('q5');
    } else if (phaseKey === 'q5') {
      await finalize(merged);
    }
  };

  const submitStyle = async (style: string) => {
    pushUser(STYLE_OPTIONS.find(o => o.value === style)?.label || style);
    setAnswers(prev => ({ ...prev, '3': style }));
    await delay(500);
    pushEcho(QUESTIONS.q4.text(niche));
    setPhase('q4');
  };

  const finalize = async (allAnswers: Record<string, string>) => {
    if (!user) return;
    setPhase('generating');
    pushEcho("I have what I need. Let me show you what I can do with it.");
    setWorking(true);

    try {
      // Create echo
      const { data: echoData, error: echoErr } = await supabase
        .from('echoes')
        .insert({
          user_id: user.id,
          name: echoName,
          niche,
          backstory: '',
          tone: 'analytical',
          communication_style: allAnswers['3'],
          desired_reader_feeling: allAnswers['5'],
          evolution_score: 5,
        })
        .select()
        .single();
      if (echoErr) throw echoErr;
      setEchoId(echoData.id);

      // Save all 5 onboarding responses
      const responses = (['1','2','3','4','5'] as const).map((k) => ({
        echo_id: echoData.id,
        question_number: parseInt(k),
        question_text: QUESTIONS[`q${k}` as keyof typeof QUESTIONS].text(niche),
        answer_text: allAnswers[k] || '',
      }));
      await supabase.from('onboarding_responses').insert(responses);

      // Q1 → first belief
      await supabase.from('echo_beliefs').insert({
        echo_id: echoData.id,
        topic: niche,
        position: allAnswers['1'],
        reasoning: 'Stated explicitly during onboarding.',
        strength: 3,
        source: 'explicit',
        is_active: true,
      });

      // Q2 → echo_rules
      await supabase.from('echo_rules').insert({
        echo_id: echoData.id,
        rule_type: 'avoid_pattern',
        content: allAnswers['2'],
      });

      // Q4 → seed_artifact memory (real prose sample)
      await supabase.from('echo_memories').insert({
        echo_id: echoData.id,
        memory_type: 'seed_artifact',
        content: allAnswers['4'],
      });

      // Generate first post draft via edge function
      const { data: gen, error: genErr } = await supabase.functions.invoke('echo-generate', {
        body: {
          type: 'onboarding_post',
          echo_id: echoData.id,
          onboarding_answers: allAnswers,
          niche,
        },
      });

      if (genErr || !gen?.content) {
        // Fallback so user is never stuck
        setDraft({
          content: `${allAnswers['4']}\n\nMost people in ${niche} get this wrong because ${allAnswers['1']}. That is the part nobody wants to say out loud.`,
          stance_tag: `On: ${niche}`,
        });
      } else {
        setDraft({ content: gen.content, stance_tag: gen.stance_tag || `On: ${niche}` });
      }
      setPhase('preview');
    } catch (err: any) {
      toast({ title: 'Something went wrong', description: err.message, variant: 'destructive' });
      setPhase('q5');
    } finally {
      setWorking(false);
    }
  };

  const approveAndPublish = async () => {
    if (!draft || !echoId) return;
    setWorking(true);
    try {
      await supabase.from('posts').insert({
        echo_id: echoId,
        content: draft.content,
        stance_tag: draft.stance_tag,
        topic: niche,
        status: 'published',
      });
      toast({ title: `${echoName} is live`, description: 'First post published.' });
      navigate('/feed');
    } catch (err: any) {
      toast({ title: 'Publish failed', description: err.message, variant: 'destructive' });
    } finally {
      setWorking(false);
    }
  };

  const rejectDraft = () => {
    if (!echoId) return;
    toast({ title: 'Draft discarded', description: 'You can generate posts anytime from the dashboard.' });
    navigate('/dashboard');
  };

  const showInput = phase === 'name' || phase === 'q1' || phase === 'q2' || phase === 'q4' || phase === 'q5';
  const isQuestion = phase === 'q1' || phase === 'q2' || phase === 'q4' || phase === 'q5';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-4 pt-6 pb-4 max-w-xl mx-auto w-full">
        <div className="hairline mb-3" />
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {phase === 'niche' ? 'Calibration · 00 of 05' :
            phase === 'name' ? 'Calibration · Naming' :
            phase === 'q1' ? 'Calibration · 01 of 05' :
            phase === 'q2' ? 'Calibration · 02 of 05' :
            phase === 'q3' ? 'Calibration · 03 of 05' :
            phase === 'q4' ? 'Calibration · 04 of 05' :
            phase === 'q5' ? 'Calibration · 05 of 05' :
            phase === 'generating' ? 'Synthesis' :
            'First Draft'}
        </span>
      </header>

      {/* Niche picker */}
      {phase === 'niche' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col justify-center px-4 py-8 max-w-xl mx-auto w-full">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-echo-purple to-echo-green flex items-center justify-center text-white font-bold">E</div>
            <div>
              <p className="text-sm text-muted-foreground">Echo</p>
              <p className="text-base text-foreground">First, what world do you live in?</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {NICHES.map(n => (
              <button
                key={n}
                onClick={() => handleNicheSelect(n)}
                className="text-left text-sm px-3 py-3 rounded-xl border border-white/10 bg-white/5 text-foreground hover:border-echo-purple hover:bg-echo-purple/10 transition-colors"
              >
                {n}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Conversation */}
      {phase !== 'niche' && phase !== 'preview' && (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 max-w-xl mx-auto w-full space-y-4">
            <AnimatePresence initial={false}>
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${m.from === 'user' ? 'justify-end' : ''}`}
                >
                  {m.from === 'echo' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-echo-purple to-echo-green flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {echoName ? echoName.charAt(0).toUpperCase() : 'E'}
                    </div>
                  )}
                  <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    m.from === 'echo'
                      ? 'bg-white/5 border border-white/10 text-foreground rounded-tl-sm'
                      : 'bg-echo-purple/20 border border-echo-purple/30 text-foreground rounded-tr-sm'
                  }`}>
                    {m.text}
                  </div>
                </motion.div>
              ))}
              {phase === 'generating' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-echo-purple to-echo-green flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {echoName.charAt(0).toUpperCase()}
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

          {/* Input area */}
          <div className="border-t border-white/5 bg-background/80 backdrop-blur-md px-4 py-3 max-w-xl mx-auto w-full">
            {showInput && (
              <div className="space-y-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={phase === 'name' ? 'A short name for your Echo...' : 'Type your answer...'}
                  className="bg-white/5 border-white/10 text-sm min-h-[80px] resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      if (phase === 'name') submitName();
                      else if (isQuestion) submitAnswer(phase as any);
                    }
                  }}
                />
                {isQuestion && QUESTIONS[phase].min > 0 && input.length < QUESTIONS[phase].min && (
                  <p className="text-[11px] text-muted-foreground">
                    {QUESTIONS[phase].min - input.length} more characters — be more specific.
                  </p>
                )}
                <button
                  onClick={() => phase === 'name' ? submitName() : submitAnswer(phase as any)}
                  disabled={input.trim().length < (phase === 'name' ? 2 : (isQuestion ? QUESTIONS[phase].min : 1)) || working}
                  className="w-full gradient-btn text-white text-sm font-medium py-2.5 rounded-lg transition-all disabled:opacity-30"
                >
                  Send →
                </button>
              </div>
            )}
            {phase === 'q3' && (
              <div className="grid grid-cols-2 gap-2">
                {STYLE_OPTIONS.map(o => (
                  <button
                    key={o.value}
                    onClick={() => submitStyle(o.value)}
                    className="text-sm px-3 py-3 rounded-xl border border-white/10 bg-white/5 text-foreground hover:border-echo-purple hover:bg-echo-purple/10 transition-colors"
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* First post preview */}
      {phase === 'preview' && draft && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex-1 px-4 py-6 max-w-xl mx-auto w-full space-y-4 overflow-y-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-echo-purple to-echo-green flex items-center justify-center text-white font-bold">
              {echoName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium">{echoName}</p>
              <p className="text-xs text-muted-foreground">Your first draft. Edit, approve, or reject.</p>
            </div>
          </div>

          <Textarea
            value={draft.content}
            onChange={(e) => setDraft({ ...draft, content: e.target.value })}
            className="bg-white/5 border-white/10 min-h-[180px] text-sm"
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Stance:</span>
            <input
              value={draft.stance_tag}
              onChange={(e) => setDraft({ ...draft, stance_tag: e.target.value })}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-echo-purple"
            />
          </div>

          <div className="pt-2">
            <p className="text-xs text-muted-foreground mb-2">Preview:</p>
            <IntellectualCard
              echoName={echoName}
              niche={niche}
              content={draft.content}
              stanceTag={draft.stance_tag}
              evolutionScore={5}
              timestamp="Just now"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={rejectDraft}
              disabled={working}
              className="flex-1 px-4 py-3 rounded-lg border border-white/10 bg-white/5 text-sm text-muted-foreground hover:bg-white/10 transition-colors"
            >
              Skip for now
            </button>
            <button
              onClick={approveAndPublish}
              disabled={working || !draft.content.trim()}
              className="flex-1 gradient-btn text-white text-sm font-medium px-4 py-3 rounded-lg transition-all disabled:opacity-50"
            >
              {working ? 'Publishing...' : 'Approve & publish'}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default Onboarding;
