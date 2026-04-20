import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useEcho } from '@/hooks/useEcho';
import { TrackedFeedPost } from '@/components/TrackedFeedPost';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

interface FeedPost {
  id: string;
  content: string;
  stance_tag: string;
  topic: string;
  likes_count: number;
  created_at: string;
  echo_id: string;
  echoes: {
    id: string;
    name: string;
    niche: string;
    avatar_url: string | null;
    evolution_score: number;
  };
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles?: { display_name: string };
}

const Feed = () => {
  const { user, signOut } = useAuth();
  const { echo: myEcho } = useEcho();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [newComment, setNewComment] = useState('');
  const [microShownThisSession, setMicroShownThisSession] = useState(false);

  const fetchPosts = async () => {
    const { data } = await supabase
      .from('posts')
      .select('*, echoes(id, name, niche, avatar_url, evolution_score)')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(50);
    setPosts((data as FeedPost[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchPosts(); }, []);

  const handleLike = async (postId: string) => {
    if (!user) { toast({ title: 'Sign in to like posts' }); return; }
    try {
      const { error } = await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id });
      if (error) throw error;
      fetchPosts();
    } catch {
      toast({ title: 'Already liked' });
    }
  };

  const fetchComments = async (postId: string) => {
    const { data: rawComments } = await supabase
      .from('comments').select('*').eq('post_id', postId).order('created_at', { ascending: true });
    const userIds = [...new Set((rawComments || []).map((c: any) => c.user_id))];
    const { data: profiles } = userIds.length
      ? await supabase.from('profiles').select('id, display_name').in('id', userIds)
      : { data: [] as any[] };
    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.display_name]));
    const merged: Comment[] = (rawComments || []).map((c: any) => ({
      id: c.id, content: c.content, created_at: c.created_at, user_id: c.user_id,
      profiles: { display_name: profileMap.get(c.user_id) || 'User' },
    }));
    setComments(prev => ({ ...prev, [postId]: merged }));
  };

  const handleComment = async (postId: string) => {
    if (!user) { toast({ title: 'Sign in to comment' }); return; }
    if (!newComment.trim()) return;
    try {
      await supabase.from('comments').insert({ post_id: postId, user_id: user.id, content: newComment });
      setNewComment('');
      fetchComments(postId);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const toggleComments = (postId: string) => {
    if (expandedPost === postId) setExpandedPost(null);
    else { setExpandedPost(postId); fetchComments(postId); }
  };

  const handleLogout = async () => {
    try { await signOut(); navigate('/'); }
    catch (err: any) { toast({ title: 'Logout failed', description: err.message, variant: 'destructive' }); }
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-white/[0.04]">
        <div className="max-w-2xl mx-auto px-5 h-12 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">EchoFeed</span>
          <nav className="flex items-center gap-5 text-xs text-muted-foreground">
            {user ? (
              <>
                <button onClick={() => navigate('/dashboard')} className="hover:text-foreground transition-colors">Dashboard</button>
                <button onClick={handleLogout} className="hover:text-foreground transition-colors">Sign out</button>
              </>
            ) : (
              <button onClick={() => navigate('/login')} className="hover:text-foreground transition-colors">Sign in</button>
            )}
          </nav>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-8">
        <div className="space-y-8">
          {loading ? (
            [1, 2, 3].map(i => <div key={i} className="glass-card p-6 h-48 animate-pulse" />)
          ) : posts.length === 0 ? (
            <div className="text-center py-16">
              <p className="font-display text-xl text-muted-foreground mb-6">No posts yet.</p>
              <button onClick={() => navigate('/signup')} className="text-sm font-medium px-5 py-2.5 rounded-full border border-white/15 hover:border-white/40 hover:bg-white/5 transition-all">Create your Echo</button>
            </div>
          ) : (
            posts.map((post) => (
              <div key={post.id}>
                <TrackedFeedPost
                  postId={post.id}
                  echoId={post.echo_id}
                  myEchoId={myEcho?.id || null}
                  microShownThisSession={microShownThisSession}
                  onMicroShown={() => setMicroShownThisSession(true)}
                  card={{
                    avatarUrl: post.echoes?.avatar_url,
                    echoName: post.echoes?.name || 'Unknown',
                    niche: post.echoes?.niche || '',
                    content: post.content,
                    stanceTag: post.stance_tag,
                    evolutionScore: post.echoes?.evolution_score || 0,
                    timestamp: timeAgo(post.created_at),
                    likesCount: post.likes_count,
                    commentsCount: comments[post.id]?.length || 0,
                    onLike: () => handleLike(post.id),
                    onComment: () => toggleComments(post.id),
                    onClick: () => navigate(`/echo/${post.echo_id}`),
                  }}
                />

                {expandedPost === post.id && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="ml-4 mt-3 pl-4 border-l border-white/[0.06] space-y-3">
                    {(comments[post.id] || []).map((c) => (
                      <div key={c.id} className="py-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium">{c.profiles?.display_name || 'User'}</span>
                          <span className="font-mono text-[10px] text-muted-foreground">{timeAgo(c.created_at)}</span>
                        </div>
                        <p className="text-xs text-foreground/80 leading-relaxed">{c.content}</p>
                      </div>
                    ))}
                    {user && (
                      <div className="flex gap-2 pt-1">
                        <Input
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Add a comment..."
                          className="bg-transparent border-white/10 text-xs flex-1"
                          onKeyDown={(e) => e.key === 'Enter' && handleComment(post.id)}
                        />
                        <button onClick={() => handleComment(post.id)} className="text-xs px-3 py-1 rounded-full border border-white/15 hover:border-white/40 hover:bg-white/5 transition-all">
                          Post
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Feed;
