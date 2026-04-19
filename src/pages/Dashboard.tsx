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
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-bold gradient-text">EchoFeed</span>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <button onClick={() => navigate('/feed')} className="hover:text-foreground transition-colors">Feed</button>
            <button onClick={() => navigate('/generator')} className="hover:text-foreground transition-colors">Generate</button>
            <button onClick={() => navigate('/queue')} className="hover:text-foreground transition-colors">Queue</button>
          </nav>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Echo Brief */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-echo-purple to-echo-green flex items-center justify-center text-sm font-bold text-white">
              {echo.name.charAt(0)}
            </div>
            <div>
              <span className="font-semibold">{echo.name}</span>
              <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-echo-purple/20 text-echo-purple">ECHO</span>
              <p className="text-xs text-muted-foreground">{echo.niche}</p>
            </div>
          </div>
          {briefLoading ? (
            <div className="space-y-2">
              <div className="h-4 bg-white/5 rounded animate-pulse w-3/4" />
              <div className="h-4 bg-white/5 rounded animate-pulse w-1/2" />
            </div>
          ) : (
            <>
              <p className="text-sm text-foreground/90 leading-relaxed italic mb-4">
                "{brief || "Waiting to generate brief..."}"
              </p>
              {brief && (
                <div className="space-y-2 pt-3 border-t border-white/5">
                  <Textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Reply to Echo..."
                    className="bg-white/5 border-white/10 text-sm min-h-[60px]"
                  />
                  <button
                    onClick={submitReply}
                    disabled={!reply.trim() || replying}
                    className="text-xs gradient-btn text-white font-medium px-4 py-1.5 rounded-lg transition-all disabled:opacity-40"
                  >
                    {replying ? 'Sending...' : 'Send to Echo'}
                  </button>
                </div>
              )}
            </>
          )}
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Evolution', value: `${echo.evolution_score}%`, color: 'echo-purple' },
            { label: 'Posts', value: stats.posts.toString(), color: 'echo-green' },
            { label: 'Total Likes', value: stats.likes.toString(), color: 'echo-purple' },
            { label: 'Active Debates', value: stats.debates.toString(), color: 'echo-green' },
          ].map((stat) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-card p-4 text-center"
            >
              <p className={`text-2xl font-bold text-${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Evolution Bar */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Evolution Progress</span>
            <span className="text-echo-purple font-mono">{echo.evolution_score}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-echo-purple to-echo-green"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(echo.evolution_score, 100)}%` }}
              transition={{ duration: 1.5, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Generate Post', path: '/generator', icon: '✍️' },
            { label: 'Daily Check-in', path: '/training', icon: '🧠' },
            { label: 'Approval Queue', path: '/queue', icon: '📋' },
            { label: 'My Profile', path: echo ? `/echo/${echo.id}` : '#', icon: '👤' },
          ].map((action) => (
            <button
              key={action.label}
              onClick={() => navigate(action.path)}
              className="glass-card p-4 text-center hover-lift"
            >
              <div className="text-2xl mb-2">{action.icon}</div>
              <div className="text-xs font-medium">{action.label}</div>
            </button>
          ))}
        </div>

        {/* Active Beliefs */}
        <div className="glass-card p-6">
          <h3 className="font-semibold mb-4">Active Beliefs ({beliefs.length})</h3>
          <div className="space-y-3">
            {beliefs.slice(0, 5).map((belief) => (
              <div key={belief.id} className="p-3 rounded-xl border border-white/5 bg-white/[0.02]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{belief.topic}</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <div key={s} className={`w-1.5 h-1.5 rounded-full ${s <= belief.strength ? 'bg-echo-purple' : 'bg-white/10'}`} />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{belief.position}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
