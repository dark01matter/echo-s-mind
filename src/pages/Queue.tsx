import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useEcho } from '@/hooks/useEcho';
import { supabase } from '@/lib/supabase';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface QueueItem {
  id: string;
  content: string;
  stance_tag: string;
  topic: string;
  status: string;
  created_at: string;
}

const Queue = () => {
  const { echo } = useEcho();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const fetchQueue = async () => {
    if (!echo) return;
    const { data } = await supabase
      .from('posts')
      .select('*')
      .eq('echo_id', echo.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchQueue();
  }, [echo]);

  const handleAction = async (id: string, action: 'published' | 'rejected') => {
    try {
      await supabase.from('posts').update({ status: action }).eq('id', id);
      toast({ title: action === 'published' ? 'Published!' : 'Rejected', description: action === 'published' ? 'Post is now live.' : 'Post has been removed.' });
      fetchQueue();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleSaveEdit = async (id: string) => {
    try {
      await supabase.from('posts').update({ content: editContent }).eq('id', id);
      setEditingId(null);
      toast({ title: 'Updated' });
      fetchQueue();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  if (!echo) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-2 border-echo-purple border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => navigate('/dashboard')} className="text-sm text-muted-foreground hover:text-foreground">← Dashboard</button>
          <span className="font-bold gradient-text">Approval Queue</span>
          <div />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <div key={i} className="glass-card p-6 h-32 animate-pulse" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <p className="text-muted-foreground">No items pending approval</p>
            <button onClick={() => navigate('/generator')} className="mt-4 gradient-btn text-white text-sm font-medium px-6 py-2 rounded-lg transition-all">
              Generate a Post
            </button>
          </div>
        ) : (
          items.map((item) => (
            <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-echo-purple/10 text-echo-purple border border-echo-purple/20">
                  {item.stance_tag}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(item.created_at).toLocaleDateString()}
                </span>
              </div>

              {editingId === item.id ? (
                <div className="space-y-2">
                  <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="bg-white/5 border-white/10 text-sm" />
                  <div className="flex gap-2">
                    <button onClick={() => handleSaveEdit(item.id)} className="text-xs text-echo-green hover:underline">Save</button>
                    <button onClick={() => setEditingId(null)} className="text-xs text-muted-foreground hover:underline">Cancel</button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-foreground/90 leading-relaxed">{item.content}</p>
              )}

              <div className="flex gap-2 pt-2 border-t border-white/5">
                <button onClick={() => handleAction(item.id, 'published')} className="flex-1 gradient-btn text-white text-xs font-medium py-2 rounded-lg transition-all">
                  Approve
                </button>
                <button onClick={() => { setEditingId(item.id); setEditContent(item.content); }} className="flex-1 glass-card text-xs font-medium py-2 rounded-lg hover-lift text-center">
                  Edit
                </button>
                <button onClick={() => handleAction(item.id, 'rejected')} className="flex-1 text-xs font-medium py-2 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors">
                  Reject
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export default Queue;
