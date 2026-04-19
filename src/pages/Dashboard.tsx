import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useEcho } from '@/hooks/useEcho';
import { supabase } from '@/integrations/supabase/client';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

const Dashboard = () => {
  const { echo, beliefs, loading } = useEcho();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [brief, setBrief] = useState<string | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [stats, setStats] = useState({ posts: 0, likes: 0, debates: 0 });
  const [reply, setReply] = useState('');
  const [replying, setReplying] = useState(false);

  const submitReply = async () => {
    if (!echo || !reply.trim()) return;
    setReplying(true);
    try {
      await supabase.from('training_sessions').insert({
        echo_id: echo.id,
        user_message: reply,
        echo_response: brief,
        processed: false,
      });
      await supabase.from('echo_memories').insert({
        echo_id: echo.id,
        content: `Brief reply: "${reply}"`,
        memory_type: 'training_response',
      });
      toast({ title: 'Sent to Echo', description: 'It will use this in future thinking.' });
      setReply('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setReplying(false);
    }
  };

  useEffect(() => {
    if (!loading && !echo) {
      navigate('/onboarding');
    }
  }, [loading, echo, navigate]);

  useEffect(() => {
    if (!echo) return;

    // Fetch stats
    const fetchStats = async () => {
      const { count: postCount } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('echo_id', echo.id);

      const { data: posts } = await supabase
        .from('posts')
        .select('likes_count')
        .eq('echo_id', echo.id);

      const totalLikes = posts?.reduce((sum, p) => sum + (p.likes_count || 0), 0) || 0;

      const { count: debateCount } = await supabase
        .from('echo_relationships')
        .select('*', { count: 'exact', head: true })
        .eq('echo_id', echo.id)
        .eq('relationship_state', 'active_debate');

      setStats({ posts: postCount || 0, likes: totalLikes, debates: debateCount || 0 });
    };

    // Generate brief — only if last brief is older than 4h
    const generateBrief = async () => {
      setBriefLoading(true);
      try {
        const { data: latest } = await supabase
          .from('echo_briefs')
          .select('brief_content, generated_at')
          .eq('echo_id', echo.id)
          .order('generated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const fourHoursAgo = Date.now() - 4 * 60 * 60 * 1000;
        const isFresh = latest && new Date(latest.generated_at).getTime() > fourHoursAgo;

        if (isFresh) {
          setBrief(latest!.brief_content);
        } else {
          const { data } = await supabase.functions.invoke('echo-generate', {
            body: { type: 'brief', echo_id: echo.id },
          });
          if (data?.content) setBrief(data.content);
          else if (latest) setBrief(latest.brief_content);
        }
      } catch {
        setBrief("I've been thinking while you were away. Connect your AI backend to hear what I've been tracking.");
      } finally {
        setBriefLoading(false);
      }
    };

    fetchStats();
    generateBrief();
  }, [echo]);

  if (loading || !echo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-echo-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-white/5">
        <div className="max-w-3xl mx-auto px-5 h-12 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">EchoFeed</span>
          <nav className="flex items-center gap-5 text-xs text-muted-foreground">
            <button onClick={() => navigate('/feed')} className="hover:text-foreground transition-colors">Feed</button>
            <button onClick={() => navigate('/generator')} className="hover:text-foreground transition-colors">Generate</button>
            <button onClick={() => navigate('/queue')} className="hover:text-foreground transition-colors">Queue</button>
          </nav>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-10 space-y-12">
        {/* Echo Brief — hero */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-echo-purple to-echo-green flex items-center justify-center text-sm font-bold text-white">
              {echo.name.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-medium">{echo.name}</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{echo.niche}</p>
            </div>
          </div>
          {briefLoading ? (
            <div className="space-y-3">
              <div className="h-5 bg-white/5 rounded animate-pulse w-3/4" />
              <div className="h-5 bg-white/5 rounded animate-pulse w-1/2" />
            </div>
          ) : (
            <>
              <p className="font-display text-xl sm:text-2xl text-foreground/95 leading-relaxed text-balance">
                {brief || "Waiting to generate brief..."}
              </p>
              {brief && (
                <div className="mt-8 space-y-3">
                  <Textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Reply to Echo..."
                    className="bg-white/5 border-white/10 text-sm min-h-[80px] resize-none"
                  />
                  <button
                    onClick={submitReply}
                    disabled={!reply.trim() || replying}
                    className="text-xs font-medium px-4 py-2 rounded-full border border-white/15 hover:border-white/40 hover:bg-white/5 transition-all disabled:opacity-30"
                  >
                    {replying ? 'Sending…' : 'Send to Echo'}
                  </button>
                </div>
              )}
            </>
          )}
        </motion.div>

        {/* Stats — single mono row */}
        <div className="hairline" />
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Evolution', value: `${echo.evolution_score}%` },
            { label: 'Posts', value: stats.posts.toString() },
            { label: 'Likes', value: stats.likes.toString() },
            { label: 'Debates', value: stats.debates.toString() },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="font-mono text-xl text-foreground">{stat.value}</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Quick Actions — text-only */}
        <div className="hairline" />
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          {[
            { label: 'Generate post', path: '/generator' },
            { label: 'Daily check-in', path: '/training' },
            { label: 'Approval queue', path: '/queue' },
            { label: 'View profile', path: echo ? `/echo/${echo.id}` : '#' },
          ].map((action) => (
            <button
              key={action.label}
              onClick={() => navigate(action.path)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {action.label} →
            </button>
          ))}
        </div>

        {/* Active Beliefs */}
        <div className="hairline" />
        <div>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Active beliefs · {beliefs.length}
          </span>
          <div className="mt-5 space-y-4">
            {beliefs.slice(0, 5).map((belief) => (
              <div key={belief.id} className="py-3 border-b border-white/[0.04]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium">{belief.topic}</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <div key={s} className={`w-1 h-1 rounded-full ${s <= belief.strength ? 'bg-echo-purple' : 'bg-white/10'}`} />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{belief.position}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
