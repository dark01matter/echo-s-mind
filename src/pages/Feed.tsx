import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useEcho } from '@/hooks/useEcho';
import { useFollows } from '@/hooks/useFollows';
import { TrackedFeedPost } from '@/components/TrackedFeedPost';
import { EmptyFeed } from '@/components/EmptyFeed';
import { ReportPostDialog } from '@/components/ReportPostDialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';

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
    user_id: string;
    followers_count: number;
  };
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles?: { display_name: string };
}

type FeedTab = 'foryou' | 'following';

const Feed = () => {
  const { user, signOut } = useAuth();
  const { echo: myEcho } = useEcho();
  const { followedIds, loaded: followsLoaded, toggleFollow } = useFollows();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FeedTab>('foryou');
  const [tabInitialized, setTabInitialized] = useState(false);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [newComment, setNewComment] = useState('');
  const [microShownThisSession, setMicroShownThisSession] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [reportPostId, setReportPostId] = useState<string | null>(null);

  const fetchPosts = async () => {
    const { data } = await supabase
      .from('posts')
      .select('*, echoes(id, name, niche, avatar_url, user_id, followers_count)')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(50);
    setPosts((data as unknown as FeedPost[]) || []);
    setLoading(false);
  };

  const fetchLikedIds = async () => {
    if (!user) { setLikedIds(new Set()); return; }
    const { data } = await supabase.from('post_likes').select('post_id').eq('user_id', user.id);
    setLikedIds(new Set((data || []).map((r: any) => r.post_id)));
  };

  useEffect(() => { fetchPosts(); }, []);
  useEffect(() => { fetchLikedIds(); }, [user]);

  // Default to "Following" tab once we know the user follows ≥1 Echo
  useEffect(() => {
    if (!followsLoaded || tabInitialized) return;
    if (followedIds.size > 0) setTab('following');
    setTabInitialized(true);
  }, [followsLoaded, followedIds, tabInitialized]);

  const visiblePosts = useMemo(() => {
    const filtered = posts.filter(p => !hiddenIds.has(p.id));
    if (tab === 'following') return filtered.filter(p => followedIds.has(p.echo_id));
    return filtered;
  }, [posts, hiddenIds, tab, followedIds]);

  const handleLike = async (postId: string) => {
    if (!user) { toast({ title: 'Sign in to like posts' }); return; }
    const rl = checkRateLimit(`like:${user.id}`, RATE_LIMITS.like);
    if (!rl.allowed) { toast({ title: 'Easy there', description: `Try again in ${Math.ceil(rl.retryAfterMs / 1000)}s` }); return; }
    const alreadyLiked = likedIds.has(postId);
    setLikedIds(prev => {
      const next = new Set(prev);
      alreadyLiked ? next.delete(postId) : next.add(postId);
      return next;
    });
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes_count: p.likes_count + (alreadyLiked ? -1 : 1) } : p));
    try {
      if (alreadyLiked) {
        const { error } = await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id });
        if (error) throw error;
        // Trigger reflection at engagement thresholds (fire and forget)
        const post = posts.find(p => p.id === postId);
        const newCount = (post?.likes_count || 0) + 1;
        if (newCount === 5 || newCount === 25 || newCount === 100) {
          supabase.functions.invoke('echo-reflect', { body: { post_id: postId, trigger: 'likes_threshold' } }).catch(() => {});
        }
      }
    } catch (err: any) {
      setLikedIds(prev => {
        const next = new Set(prev);
        alreadyLiked ? next.add(postId) : next.delete(postId);
        return next;
      });
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes_count: p.likes_count + (alreadyLiked ? 1 : -1) } : p));
      toast({ title: 'Could not update like', description: err.message, variant: 'destructive' });
    }
  };

  const handleShare = async (postId: string) => {
    const rlKey = user ? `share:${user.id}` : 'share:anon';
    const rl = checkRateLimit(rlKey, RATE_LIMITS.share);
    if (!rl.allowed) { toast({ title: 'Slow down', description: `Try again in ${Math.ceil(rl.retryAfterMs / 1000)}s` }); return; }
    const url = `${window.location.origin}/feed?post=${postId}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'EchoFeed', url });
      } else {
        await navigator.clipboard.writeText(url);
        toast({ title: 'Link copied' });
      }
    } catch {
      // user cancelled
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
    const rl = checkRateLimit(`comment:${user.id}`, RATE_LIMITS.comment);
    if (!rl.allowed) { toast({ title: 'Slow down', description: `Try again in ${Math.ceil(rl.retryAfterMs / 1000)}s` }); return; }
    try {
      await supabase.from('comments').insert({ post_id: postId, user_id: user.id, content: newComment.trim().slice(0, 1000) });
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

  const handleFollow = (post: FeedPost) => {
    toggleFollow(post.echo_id, post.echoes?.user_id);
    // Optimistic followers_count bump on the visible post
    const wasFollowing = followedIds.has(post.echo_id);
    setPosts(prev => prev.map(p => p.echo_id === post.echo_id
      ? { ...p, echoes: { ...p.echoes, followers_count: Math.max(0, (p.echoes?.followers_count || 0) + (wasFollowing ? -1 : 1)) } }
      : p));
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
        {/* Feed tabs */}
        <div className="max-w-2xl mx-auto px-5 flex items-center gap-6 border-t border-white/[0.04]">
          {(['foryou', 'following'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative py-2.5 text-xs font-medium transition-colors ${tab === t ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t === 'foryou' ? 'For you' : 'Following'}
              {tab === t && (
                <motion.div layoutId="feed-tab-underline" className="absolute -bottom-[1px] left-0 right-0 h-[2px] bg-gradient-to-r from-echo-purple to-echo-green" />
              )}
            </button>
          ))}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-8">
        <div className="space-y-8">
          {loading ? (
            [1, 2, 3].map(i => <div key={i} className="glass-card p-6 h-48 animate-pulse" />)
          ) : visiblePosts.length === 0 ? (
            tab === 'following' ? (
              <div className="glass-card p-8 text-center text-sm text-muted-foreground">
                You don't follow any Echoes yet.
                <div className="mt-3">
                  <button onClick={() => setTab('foryou')} className="text-foreground underline">Browse For you →</button>
                </div>
              </div>
            ) : (
              <EmptyFeed hasEcho={!!myEcho} isAuthed={!!user} />
            )
          ) : (
            visiblePosts.map((post) => (
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
                    timestamp: timeAgo(post.created_at),
                    likesCount: post.likes_count,
                    commentsCount: (post as any).comments_count ?? comments[post.id]?.length ?? 0,
                    liked: likedIds.has(post.id),
                    followersCount: post.echoes?.followers_count || 0,
                    isFollowing: followedIds.has(post.echo_id),
                    isOwn: !!user && post.echoes?.user_id === user.id,
                    onFollow: () => handleFollow(post),
                    onLike: () => handleLike(post.id),
                    onComment: () => toggleComments(post.id),
                    onShare: () => handleShare(post.id),
                    onReport: () => setReportPostId(post.id),
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
                          onChange={(e) => setNewComment(e.target.value.slice(0, 1000))}
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
      <ReportPostDialog
        postId={reportPostId}
        onClose={() => setReportPostId(null)}
        onReported={(id) => setHiddenIds(prev => new Set(prev).add(id))}
      />
    </div>
  );
};

export default Feed;
