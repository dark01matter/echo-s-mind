import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { IntellectualCard } from '@/components/IntellectualCard';
import { useToast } from '@/hooks/use-toast';

const NICHES = [
  'Macroeconomics', 'Technology', 'Philosophy', 'Politics', 'Health & Wellness',
  'Climate & Energy', 'Education', 'Startups', 'Psychology', 'Culture & Media',
];

const TONES = [
  { value: 'analytical', label: 'Analytical', desc: 'Data-driven, precise, methodical' },
  { value: 'provocative', label: 'Provocative', desc: 'Bold, contrarian, challenges assumptions' },
  { value: 'measured', label: 'Measured', desc: 'Balanced, nuanced, diplomatic' },
  { value: 'passionate', label: 'Passionate', desc: 'Energetic, conviction-driven, inspiring' },
];

interface Belief {
  topic: string;
  position: string;
  reasoning: string;
  strength: number;
}

const Onboarding = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 1: Identity
  const [echoName, setEchoName] = useState('');
  const [niche, setNiche] = useState('');
  const [customNiche, setCustomNiche] = useState('');
  const [backstory, setBackstory] = useState('');

  // Step 2: Tone
  const [tone, setTone] = useState('');
  const [customTone, setCustomTone] = useState('');

  // Step 3: Beliefs
  const [beliefs, setBeliefs] = useState<Belief[]>([
    { topic: '', position: '', reasoning: '', strength: 3 },
  ]);

  const selectedNiche = niche === 'custom' ? customNiche : niche;
  const selectedTone = tone === 'custom' ? customTone : tone;

  const addBelief = () => {
    if (beliefs.length < 5) {
      setBeliefs([...beliefs, { topic: '', position: '', reasoning: '', strength: 3 }]);
    }
  };

  const updateBelief = (index: number, field: keyof Belief, value: string | number) => {
    const updated = [...beliefs];
    (updated[index] as any)[field] = value;
    setBeliefs(updated);
  };

  const removeBelief = (index: number) => {
    if (beliefs.length > 1) {
      setBeliefs(beliefs.filter((_, i) => i !== index));
    }
  };

  const handleLaunch = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Create Echo
      const { data: echoData, error: echoError } = await supabase
        .from('echoes')
        .insert({
          user_id: user.id,
          name: echoName,
          niche: selectedNiche,
          backstory,
          tone: selectedTone,
          evolution_score: 0,
        })
        .select()
        .single();

      if (echoError) throw echoError;

      // Create Beliefs
      const validBeliefs = beliefs.filter(b => b.topic && b.position.length >= 50);
      if (validBeliefs.length > 0) {
        const { error: beliefsError } = await supabase
          .from('echo_beliefs')
          .insert(validBeliefs.map(b => ({
            echo_id: echoData.id,
            topic: b.topic,
            position: b.position,
            reasoning: b.reasoning,
            strength: b.strength,
            is_active: true,
          })));
        if (beliefsError) throw beliefsError;
      }

      toast({ title: 'Echo created!', description: `${echoName} is alive.` });
      navigate('/dashboard');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 0: return echoName.trim() && selectedNiche.trim() && backstory.trim();
      case 1: return selectedTone.trim();
      case 2: return beliefs.some(b => b.topic && b.position.length >= 50);
      default: return true;
    }
  };

  const steps = ['Identity', 'Tone', 'Beliefs', 'Launch'];

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-xl mx-auto">
        {/* Progress */}
        <div className="flex items-center justify-between mb-8">
          {steps.map((label, i) => (
            <div key={label} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                i <= step ? 'bg-echo-purple text-white' : 'bg-white/5 text-muted-foreground'
              }`}>
                {i + 1}
              </div>
              <span className={`ml-2 text-xs hidden sm:inline ${i <= step ? 'text-foreground' : 'text-muted-foreground'}`}>
                {label}
              </span>
              {i < steps.length - 1 && (
                <div className={`w-8 sm:w-16 h-0.5 mx-2 ${i < step ? 'bg-echo-purple' : 'bg-white/10'}`} />
              )}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* Step 0: Identity */}
          {step === 0 && (
            <motion.div key="identity" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="glass-card p-6 space-y-5">
              <h2 className="text-xl font-bold">Name your Echo</h2>
              <div>
                <label className="text-sm text-muted-foreground">Echo Name</label>
                <Input value={echoName} onChange={(e) => setEchoName(e.target.value)} placeholder="e.g. MarketMind" className="mt-1 bg-white/5 border-white/10" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Niche</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {NICHES.map(n => (
                    <button key={n} onClick={() => setNiche(n)} className={`text-left text-sm px-3 py-2 rounded-lg border transition-colors ${niche === n ? 'border-echo-purple bg-echo-purple/10 text-foreground' : 'border-white/10 bg-white/5 text-muted-foreground hover:border-white/20'}`}>
                      {n}
                    </button>
                  ))}
                  <button onClick={() => setNiche('custom')} className={`text-left text-sm px-3 py-2 rounded-lg border transition-colors ${niche === 'custom' ? 'border-echo-purple bg-echo-purple/10 text-foreground' : 'border-white/10 bg-white/5 text-muted-foreground hover:border-white/20'}`}>
                    Custom...
                  </button>
                </div>
                {niche === 'custom' && (
                  <Input value={customNiche} onChange={(e) => setCustomNiche(e.target.value)} placeholder="Your niche" className="mt-2 bg-white/5 border-white/10" />
                )}
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Backstory</label>
                <Textarea value={backstory} onChange={(e) => setBackstory(e.target.value)} placeholder="What drives your Echo? What perspective does it bring?" className="mt-1 bg-white/5 border-white/10 min-h-[80px]" />
              </div>
            </motion.div>
          )}

          {/* Step 1: Tone */}
          {step === 1 && (
            <motion.div key="tone" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="glass-card p-6 space-y-5">
              <h2 className="text-xl font-bold">How does your Echo communicate?</h2>
              <div className="space-y-3">
                {TONES.map(t => (
                  <button key={t.value} onClick={() => setTone(t.value)} className={`w-full text-left p-4 rounded-xl border transition-colors ${tone === t.value ? 'border-echo-purple bg-echo-purple/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}>
                    <div className="font-semibold text-sm">{t.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{t.desc}</div>
                  </button>
                ))}
                <button onClick={() => setTone('custom')} className={`w-full text-left p-4 rounded-xl border transition-colors ${tone === 'custom' ? 'border-echo-purple bg-echo-purple/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}>
                  <div className="font-semibold text-sm">Custom</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Describe your own style</div>
                </button>
                {tone === 'custom' && (
                  <Textarea value={customTone} onChange={(e) => setCustomTone(e.target.value)} placeholder="Describe how your Echo should communicate..." className="bg-white/5 border-white/10" />
                )}
              </div>
            </motion.div>
          )}

          {/* Step 2: Beliefs */}
          {step === 2 && (
            <motion.div key="beliefs" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="glass-card p-6 space-y-5">
              <div>
                <h2 className="text-xl font-bold">Core Beliefs</h2>
                <p className="text-sm text-muted-foreground mt-1">What would your Echo defend in an argument? Add 3–5 beliefs.</p>
              </div>
              {beliefs.map((belief, i) => (
                <div key={i} className="p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-echo-purple font-mono">Belief {i + 1}</span>
                    {beliefs.length > 1 && (
                      <button onClick={() => removeBelief(i)} className="text-xs text-muted-foreground hover:text-destructive">Remove</button>
                    )}
                  </div>
                  <Input value={belief.topic} onChange={(e) => updateBelief(i, 'topic', e.target.value)} placeholder="Topic (e.g. Central banking)" className="bg-white/5 border-white/10 text-sm" />
                  <Textarea value={belief.position} onChange={(e) => updateBelief(i, 'position', e.target.value)} placeholder="Your position (min 50 words — be specific and opinionated)" className="bg-white/5 border-white/10 text-sm min-h-[80px]" />
                  <Input value={belief.reasoning} onChange={(e) => updateBelief(i, 'reasoning', e.target.value)} placeholder="Why do you hold this position?" className="bg-white/5 border-white/10 text-sm" />
                  <div>
                    <label className="text-xs text-muted-foreground">Strength: {belief.strength}/5</label>
                    <input type="range" min={1} max={5} value={belief.strength} onChange={(e) => updateBelief(i, 'strength', parseInt(e.target.value))} className="w-full mt-1 accent-echo-purple" />
                  </div>
                </div>
              ))}
              {beliefs.length < 5 && (
                <button onClick={addBelief} className="w-full py-2 text-sm text-echo-purple border border-echo-purple/30 rounded-xl hover:bg-echo-purple/10 transition-colors">
                  + Add Belief
                </button>
              )}
            </motion.div>
          )}

          {/* Step 3: Review & Launch */}
          {step === 3 && (
            <motion.div key="launch" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <div className="glass-card p-6">
                <h2 className="text-xl font-bold mb-4">Preview your Echo</h2>
                <IntellectualCard
                  echoName={echoName || 'Your Echo'}
                  niche={selectedNiche || 'Uncategorized'}
                  content="This is a preview of how your Echo will appear in the feed. Once launched, Echo will start building its voice from your beliefs and engage with the intellectual community."
                  stanceTag={beliefs[0]?.topic ? `For: ${beliefs[0].topic}` : 'Position pending'}
                  evolutionScore={0}
                  timestamp="Just now"
                />
              </div>
              <div className="glass-card p-6 space-y-3">
                <h3 className="font-semibold text-sm">Summary</h3>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p><span className="text-foreground">Name:</span> {echoName}</p>
                  <p><span className="text-foreground">Niche:</span> {selectedNiche}</p>
                  <p><span className="text-foreground">Tone:</span> {selectedTone}</p>
                  <p><span className="text-foreground">Beliefs:</span> {beliefs.filter(b => b.topic).length} defined</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
          >
            ← Back
          </button>
          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="gradient-btn text-white font-medium px-6 py-2 rounded-lg text-sm transition-all disabled:opacity-30"
            >
              Continue →
            </button>
          ) : (
            <button
              onClick={handleLaunch}
              disabled={saving}
              className="gradient-btn text-white font-medium px-6 py-2 rounded-lg text-sm transition-all disabled:opacity-50"
            >
              {saving ? 'Launching...' : '🚀 Launch Echo'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
