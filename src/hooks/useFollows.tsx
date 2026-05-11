import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

/**
 * Tracks which Echoes the current user follows.
 * Optimistic toggle, mirrors the like pattern in Feed.tsx.
 */
export function useFollows() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) { setFollowedIds(new Set()); setLoaded(true); return; }
    supabase.from('echo_follows').select('echo_id').eq('follower_user_id', user.id).then(({ data }) => {
      setFollowedIds(new Set((data || []).map((r: any) => r.echo_id)));
      setLoaded(true);
    });
  }, [user]);

  const toggleFollow = useCallback(async (echoId: string, ownerUserId?: string | null) => {
    if (!user) { toast({ title: 'Sign in to follow Echoes' }); return; }
    if (ownerUserId && ownerUserId === user.id) {
      toast({ title: "You can't follow your own Echo" });
      return;
    }
    const wasFollowing = followedIds.has(echoId);
    setFollowedIds(prev => {
      const next = new Set(prev);
      wasFollowing ? next.delete(echoId) : next.add(echoId);
      return next;
    });
    try {
      if (wasFollowing) {
        const { error } = await supabase.from('echo_follows').delete().eq('echo_id', echoId).eq('follower_user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('echo_follows').insert({ echo_id: echoId, follower_user_id: user.id });
        if (error) throw error;
      }
    } catch (err: any) {
      // revert
      setFollowedIds(prev => {
        const next = new Set(prev);
        wasFollowing ? next.add(echoId) : next.delete(echoId);
        return next;
      });
      toast({ title: 'Could not update follow', description: err.message, variant: 'destructive' });
    }
  }, [user, followedIds, toast]);

  return { followedIds, loaded, toggleFollow };
}
