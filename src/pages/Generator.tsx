import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEcho } from '@/hooks/useEcho';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { IntellectualCard } from '@/components/IntellectualCard';
import { useToast } from '@/hooks/use-toast';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const Generator = () => {
  const { user } = useAuth();
  const { echo, beliefs } = useEcho();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [topic, setTopic] = useState('');
  const [angle, setAngle] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [generatedStance, setGeneratedStance] = useState('');
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [randomDelay, setRandomDelay] = useState(false);
  const [beliefsOpen, setBeliefsOpen] = useState(false);

  const handleGenerate = async () => {
    if (!echo) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('echo-generate', {
        body: { type: 'post', echo_id: echo.id, topic, angle },
      });
      if (error) throw error;
      setGeneratedContent(data?.content || 'Failed to generate content.');
      setGeneratedStance(data?.stance_tag || `On: ${topic}`);
    } catch (err: any) {
      toast({ title: 'Generation failed', description: err.message, variant: 'destructive' });
      setGeneratedContent('');
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async (status: 'published' | 'pending') => {
    if (!echo || !generatedContent) return;
    setPublishing(true);
    try {
      await supabase.from('posts').insert({
        echo_id: echo.id,
        content: generatedContent,
        stance_tag: generatedStance,
        topic,
        status,
      });

      // Trigger reflection (fire and forget) — turns this post into durable memory + belief signal
      if (status === 'published') {
        supabase.functions.invoke('echo-reflect', { body: { echo_id: echo.id, trigger: 'new_post' } }).catch(() => {});
      }

      toast({
        title: status === 'published' ? 'Published!' : 'Added to queue',
        description: status === 'published' ? 'Your post is live.' : 'Review it in the approval queue.',
      });
      setGeneratedContent('');
      setTopic('');
      setAngle('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setPublishing(false);
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
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => navigate('/dashboard')} className="text-sm text-muted-foreground hover:text-foreground">← Dashboard</button>
          <span className="font-bold gradient-text">Post Generator</span>
          <div />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-[1fr_400px] gap-6">
          {/* Left: Controls */}
          <div className="space-y-6">
            {/* Belief Context */}
            <Collapsible open={beliefsOpen} onOpenChange={setBeliefsOpen}>
              <CollapsibleTrigger className="w-full glass-card p-4 flex items-center justify-between hover-lift">
                <span className="text-sm font-medium">Echo's Belief Context ({beliefs.length})</span>
                <span className="text-xs text-muted-foreground">{beliefsOpen ? '▲' : '▼'}</span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 space-y-2">
                  {beliefs.map((b) => (
                    <div key={b.id} className="glass-card p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-echo-purple">{b.topic}</span>
                        <span className="text-[10px] text-muted-foreground">Strength: {b.strength}/5</span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{b.position}</p>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Topic */}
            <div className="glass-card p-6 space-y-4">
              <div>
                <label className="text-sm text-muted-foreground">Topic</label>
                <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="What should Echo write about?" className="mt-1 bg-white/5 border-white/10" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Angle / Framing (optional)</label>
                <Input value={angle} onChange={(e) => setAngle(e.target.value)} placeholder="A specific angle or hook..." className="mt-1 bg-white/5 border-white/10" />
              </div>
              <button
                onClick={handleGenerate}
                disabled={!topic.trim() || generating}
                className="w-full gradient-btn text-white font-medium py-2.5 rounded-lg text-sm transition-all disabled:opacity-50"
              >
                {generating ? 'Generating...' : '⚡ Generate Post'}
              </button>
            </div>

            {/* Edit */}
            {generatedContent && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 space-y-4">
                <h3 className="text-sm font-medium">Edit Content</h3>
                <Textarea
                  value={generatedContent}
                  onChange={(e) => setGeneratedContent(e.target.value)}
                  className="bg-white/5 border-white/10 min-h-[120px]"
                />
                <div>
                  <label className="text-sm text-muted-foreground">Stance Tag</label>
                  <Input value={generatedStance} onChange={(e) => setGeneratedStance(e.target.value)} className="mt-1 bg-white/5 border-white/10" />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={randomDelay} onChange={(e) => setRandomDelay(e.target.checked)} className="accent-echo-purple" />
                  <label className="text-xs text-muted-foreground">Random delay (8-40 min) for human feel</label>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => handlePublish('published')}
                    disabled={publishing}
                    className="flex-1 gradient-btn text-white font-medium py-2 rounded-lg text-sm transition-all disabled:opacity-50"
                  >
                    Publish Now
                  </button>
                  <button
                    onClick={() => handlePublish('pending')}
                    disabled={publishing}
                    className="flex-1 glass-card py-2 rounded-lg text-sm font-medium hover-lift"
                  >
                    Save to Queue
                  </button>
                </div>
              </motion.div>
            )}
          </div>

          {/* Right: Preview */}
          <div className="hidden lg:block">
            <div className="sticky top-20">
              <h3 className="text-sm text-muted-foreground mb-3">Preview</h3>
              {generatedContent ? (
                <IntellectualCard
                  echoName={echo.name}
                  niche={echo.niche}
                  content={generatedContent}
                  stanceTag={generatedStance}
                  timestamp="Just now"
                />
              ) : (
                <div className="glass-card p-8 text-center text-muted-foreground text-sm">
                  Generate a post to preview it here
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Generator;
