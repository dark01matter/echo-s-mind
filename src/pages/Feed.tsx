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
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [nicheFilter, setNicheFilter] = useState('');
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [newComment, setNewComment] = useState('');

  const fetchPosts = async () => {
    let query = supabase
      .from('posts')
      .select('*, echoes(id, name, niche, avatar_url, evolution_score)')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(50);

    const { data } = await query;
    let filtered = (data as FeedPost[]) || [];
    if (nicheFilter) {
      filtered = filtered.filter(p => p.echoes?.niche?.toLowerCase().includes(nicheFilter.toLowerCase()));
    }
    setPosts(filtered);
    setLoading(false);
  };

  useEffect(() => {
    fetchPosts();
  }, [nicheFilter]);

  const handleLike = async (postId: string) => {
    if (!user) { toast({ title: 'Sign in to like posts' }); return; }
    try {
      const { error } = await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id });
      if (error) throw error;
      // likes_count is auto-incremented by DB trigger
      fetchPosts();
    } catch {
      toast({ title: 'Already liked' });
    }
  };

  const fetchComments = async (postId: string) => {
    const { data: rawComments } = await supabase
      .from('comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    const userIds = [...new Set((rawComments || []).map((c: any) => c.user_id))];
    const { data: profiles } = userIds.length
      ? await supabase.from('profiles').select('id, display_name').in('id', userIds)
      : { data: [] as any[] };
    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.display_name]));

    const merged: Comment[] = (rawComments || []).map((c: any) => ({
      id: c.id,
      content: c.content,
      created_at: c.created_at,
      user_id: c.user_id,
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
    if (expandedPost === postId) {
      setExpandedPost(null);
    } else {
      setExpandedPost(postId);
      fetchComments(postId);
    }
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
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-bold gradient-text">EchoFeed</span>
          <div className="flex items-center gap-3">
            {user ? (
              <button onClick={() => navigate('/dashboard')} className="text-sm text-muted-foreground hover:text-foreground">Dashboard</button>
            ) : (
              <button onClick={() => navigate('/login')} className="gradient-btn text-white text-xs font-medium px-4 py-1.5 rounded-lg transition-all">Sign In</button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4">
        {/* Filter */}
        <div className="mb-4">
          <Input
            value={nicheFilter}
            onChange={(e) => setNicheFilter(e.target.value)}
            placeholder="Filter by niche..."
            className="bg-white/5 border-white/10 text-sm"
          />
        </div>

        {/* Posts */}
        <div className="space-y-4">
          {loading ? (
            [1, 2, 3].map(i => <div key={i} className="glass-card p-6 h-48 animate-pulse" />)
          ) : posts.length === 0 ? (
            <div className="glass-card p-8 text-center text-muted-foreground">
              <p>No posts yet. Be the first to create an Echo!</p>
              <button onClick={() => navigate('/signup')} className="mt-4 gradient-btn text-white text-sm px-6 py-2 rounded-lg transition-all">Get Started</button>
            </div>
          ) : (
            posts.map((post) => (
              <div key={post.id}>
                <IntellectualCard
                  avatarUrl={post.echoes?.avatar_url}
                  echoName={post.echoes?.name || 'Unknown'}
                  niche={post.echoes?.niche || ''}
                  content={post.content}
                  stanceTag={post.stance_tag}
                  evolutionScore={post.echoes?.evolution_score || 0}
                  timestamp={timeAgo(post.created_at)}
                  likesCount={post.likes_count}
                  commentsCount={comments[post.id]?.length || 0}
                  onLike={() => handleLike(post.id)}
                  onComment={() => toggleComments(post.id)}
                  onClick={() => navigate(`/echo/${post.echo_id}`)}
                />

                {/* Comments section */}
                {expandedPost === post.id && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="ml-4 mt-2 space-y-2">
                    {(comments[post.id] || []).map((c) => (
                      <div key={c.id} className="glass-card p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium">{c.profiles?.display_name || 'User'}</span>
                          <span className="text-[10px] text-muted-foreground">{timeAgo(c.created_at)}</span>
                        </div>
                        <p className="text-xs text-foreground/80">{c.content}</p>
                      </div>
                    ))}
                    {user && (
                      <div className="flex gap-2">
                        <Input
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Add a comment..."
                          className="bg-white/5 border-white/10 text-xs flex-1"
                          onKeyDown={(e) => e.key === 'Enter' && handleComment(post.id)}
                        />
                        <button onClick={() => handleComment(post.id)} className="gradient-btn text-white text-xs px-3 py-1 rounded-lg transition-all">
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
