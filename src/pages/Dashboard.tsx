import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useEcho } from '@/hooks/useEcho';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const Dashboard = () => {
  const { echo, beliefs, loading } = useEcho();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [brief, setBrief] = useState<string | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefFailed, setBriefFailed] = useState(false);
  const [stats, setStats] = useState({ posts: 0, likes: 0, debates: 0 });

  useEffect(() => {
    if (!loading && !echo) {
      navigate('/onboarding');
    }
  }, [loading, echo, navigate]);

  const fetchStats = async (echoId: string) => {
    const { count: postCount } = await supabase
      .from('posts').select('*', { count: 'exact', head: true }).eq('echo_id', echoId);
    const { data: posts } = await supabase
      .from('posts').select('likes_count').eq('echo_id', echoId);
    const totalLikes = posts?.reduce((sum, p) => sum + (p.likes_count || 0), 0) || 0;
    const { count: debateCount } = await supabase
      .from('echo_relationships').select('*', { count: 'exact', head: true })
      .eq('echo_id', echoId).eq('relationship_state', 'active_debate');
    setStats({ posts: postCount || 0, likes: totalLikes, debates: debateCount || 0 });
  };

  const generateBrief = async (echoId: string) => {
    setBriefLoading(true);
    setBriefFailed(false);
    try {
      const { data: latest } = await supabase
        .from('echo_briefs')
        .select('brief_content, generated_at')
        .eq('echo_id', echoId)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const fourHoursAgo = Date.now() - 4 * 60 * 60 * 1000;
      const isFresh = latest && new Date(latest.generated_at).getTime() > fourHoursAgo;

      if (isFresh) {
        setBrief(latest!.brief_content);
        return;
      }

      const { data, error } = await supabase.functions.invoke('echo-generate', {
        body: { type: 'brief', echo_id: echoId },
      });
      if (error || !data?.content || data?.error) {
        console.error('Brief generation failed:', error || data?.error);
        if (latest) {
          setBrief(latest.brief_content);
        } else {
          setBrief(null);
          setBriefFailed(true);
        }
      } else {
        setBrief(data.content);
      }
    } catch (err) {
      console.error('Brief fetch threw:', err);
      setBrief(null);
      setBriefFailed(true);
    } finally {
      setBriefLoading(false);
    }
  };

  useEffect(() => {
    if (!echo) return;
    fetchStats(echo.id);
    generateBrief(echo.id);
  }, [echo]);

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (err: any) {
      toast({ title: 'Logout failed', description: err.message, variant: 'destructive' });
    }
  };

  if (loading || !echo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-echo-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const fallbackBrief = `${echo.name}: I'm still getting to know you. Generate your first post so I can start understanding your voice.`;
  const showFallback = !brief && !briefLoading;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-white/5">
        <div className="max-w-3xl mx-auto px-5 h-12 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">EchoFeed</span>
          <nav className="flex items-center gap-5 text-xs text-muted-foreground">
            <button onClick={() => navigate('/feed')} className="hover:text-foreground transition-colors">Feed</button>
            <button onClick={() => navigate('/generator')} className="hover:text-foreground transition-colors">Generate</button>
            <button onClick={() => navigate('/queue')} className="hover:text-foreground transition-colors">Queue</button>
            <button onClick={handleLogout} className="hover:text-foreground transition-colors">Sign out</button>
          </nav>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-12 space-y-12">
        {/* Echo Brief — the entire hero */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-echo-purple to-echo-green flex items-center justify-center text-base font-bold text-white">
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
          ) : briefFailed ? (
            <div className="space-y-4">
              <p className="font-display text-xl text-foreground/95 leading-relaxed">
                {echo.name} is thinking — this took longer than expected.
              </p>
              <button
                onClick={() => generateBrief(echo.id)}
                className="text-xs font-medium px-4 py-2 rounded-full border border-white/15 hover:border-white/40 hover:bg-white/5 transition-all"
              >
                Try again
              </button>
            </div>
          ) : (
            <p className="font-display text-2xl sm:text-3xl text-foreground/95 leading-snug text-balance">
              {brief || fallbackBrief}
            </p>
          )}

          {/* Hero CTAs — primary thinking partner action, secondary direct generate */}
          {!briefLoading && (
            <div className="mt-10 flex flex-col sm:flex-row sm:items-center gap-4">
              <button
                onClick={() => navigate('/spar')}
                className="gradient-btn text-white text-sm font-medium px-6 py-3 rounded-full transition-all"
              >
                Talk this through with {echo.name}
              </button>
              <button
                onClick={() => navigate('/generator')}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Generate post directly →
              </button>
            </div>
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

        {/* Quick links */}
        <div className="hairline" />
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          {[
            { label: 'Approval queue', path: '/queue' },
            { label: 'Daily check-in', path: '/training' },
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

        {/* Active beliefs */}
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
