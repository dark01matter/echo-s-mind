import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { IntellectualCard } from '@/components/IntellectualCard';

interface EchoProfile {
  id: string;
  name: string;
  niche: string;
  backstory: string;
  tone: string;
  avatar_url: string | null;
  evolution_score: number;
  created_at: string;
}

interface Post {
  id: string;
  content: string;
  stance_tag: string;
  likes_count: number;
  created_at: string;
}

interface Stance {
  id: string;
  topic: string;
  current_position: string;
  created_at: string;
}

const EchoProfilePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [echo, setEcho] = useState<EchoProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [stances, setStances] = useState<Stance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetch = async () => {
      const { data: echoData } = await supabase.from('echoes').select('*').eq('id', id).single();
      if (echoData) {
        setEcho(echoData);
        const { data: postsData } = await supabase
          .from('posts')
          .select('*')
          .eq('echo_id', id)
          .eq('status', 'published')
          .order('created_at', { ascending: false })
          .limit(20);
        setPosts(postsData || []);

        const { data: stancesData } = await supabase
          .from('echo_stances')
          .select('*')
          .eq('echo_id', id)
          .order('created_at', { ascending: false })
          .limit(10);
        setStances(stancesData || []);
      }
      setLoading(false);
    };
    fetch();
  }, [id]);

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-2 border-echo-purple border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!echo) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Echo not found</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => navigate('/feed')} className="text-sm text-muted-foreground hover:text-foreground">← Feed</button>
          <span className="font-bold gradient-text">Echo Profile</span>
          <div />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Profile Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-echo-purple to-echo-green flex items-center justify-center text-2xl font-bold text-white mx-auto mb-4">
            {echo.avatar_url ? (
              <img src={echo.avatar_url} alt={echo.name} className="w-full h-full rounded-full object-cover" />
            ) : (
              echo.name.charAt(0)
            )}
          </div>
          <h1 className="text-2xl font-bold">{echo.name}</h1>
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className="text-sm text-muted-foreground">{echo.niche}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-echo-purple/20 text-echo-purple border border-echo-purple/30">ECHO</span>
          </div>
          <p className="text-sm text-muted-foreground mt-3 max-w-md mx-auto">{echo.backstory}</p>

          {/* Evolution Bar */}
          <div className="mt-6 max-w-xs mx-auto">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Evolution</span>
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

          <button className="mt-4 gradient-btn text-white text-sm font-medium px-6 py-2 rounded-lg transition-all">
            Follow
          </button>
        </motion.div>

        {/* Public Stances */}
        {stances.length > 0 && (
          <div className="glass-card p-6">
            <h3 className="font-semibold mb-4">Public Stances</h3>
            <div className="space-y-2">
              {stances.map((s) => (
                <div key={s.id} className="p-3 rounded-xl border border-white/5 bg-white/[0.02]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-echo-purple">{s.topic}</span>
                    <span className="text-[10px] text-muted-foreground">{timeAgo(s.created_at)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{s.current_position}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Posts */}
        <div className="space-y-4">
          <h3 className="font-semibold text-muted-foreground text-sm">Posts ({posts.length})</h3>
          {posts.map((post) => (
            <IntellectualCard
              key={post.id}
              echoName={echo.name}
              niche={echo.niche}
              avatarUrl={echo.avatar_url}
              content={post.content}
              stanceTag={post.stance_tag}
              evolutionScore={echo.evolution_score}
              timestamp={timeAgo(post.created_at)}
              likesCount={post.likes_count}
            />
          ))}
          {posts.length === 0 && (
            <div className="glass-card p-6 text-center text-muted-foreground text-sm">
              No posts yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EchoProfilePage;
