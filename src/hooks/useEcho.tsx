import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

export interface Echo {
  id: string;
  user_id: string;
  name: string;
  niche: string;
  backstory: string;
  tone: string;
  avatar_url: string | null;
  followers_count?: number;
  reflection_count?: number;
  created_at: string;
}

export interface EchoBelief {
  id: string;
  echo_id: string;
  topic: string;
  position: string;
  reasoning: string;
  strength: number;
  is_active: boolean;
}

export function useEcho() {
  const { user } = useAuth();
  const [echo, setEcho] = useState<Echo | null>(null);
  const [beliefs, setBeliefs] = useState<EchoBelief[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setEcho(null);
      setBeliefs([]);
      setLoading(false);
      return;
    }

    const fetchEcho = async () => {
      const { data } = await supabase
        .from('echoes')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setEcho(data);
        const { data: beliefsData } = await supabase
          .from('echo_beliefs')
          .select('*')
          .eq('echo_id', data.id)
          .eq('is_active', true);
        setBeliefs(beliefsData || []);
      }
      setLoading(false);
    };

    fetchEcho();
  }, [user]);

  return { echo, beliefs, loading, setEcho, setBeliefs };
}
