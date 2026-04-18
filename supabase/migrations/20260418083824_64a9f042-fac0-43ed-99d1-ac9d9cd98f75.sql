
-- Utility: updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 1. PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. ECHOES
CREATE TABLE public.echoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  niche TEXT NOT NULL,
  backstory TEXT,
  tone TEXT DEFAULT 'analytical',
  communication_style TEXT,
  desired_reader_feeling TEXT,
  avatar_url TEXT,
  evolution_score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.echoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Echoes viewable by all" ON public.echoes FOR SELECT USING (true);
CREATE POLICY "Users manage own echoes" ON public.echoes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own echoes" ON public.echoes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own echoes" ON public.echoes FOR DELETE USING (auth.uid() = user_id);

-- 3. ONBOARDING_RESPONSES
CREATE TABLE public.onboarding_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  echo_id UUID NOT NULL REFERENCES public.echoes(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  answer_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.onboarding_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own onboarding" ON public.onboarding_responses FOR ALL
  USING (echo_id IN (SELECT id FROM public.echoes WHERE user_id = auth.uid()))
  WITH CHECK (echo_id IN (SELECT id FROM public.echoes WHERE user_id = auth.uid()));

-- 4. ECHO_BELIEFS
CREATE TABLE public.echo_beliefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  echo_id UUID NOT NULL REFERENCES public.echoes(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  position TEXT NOT NULL,
  reasoning TEXT,
  strength INTEGER NOT NULL DEFAULT 3 CHECK (strength >= 1 AND strength <= 5),
  source TEXT NOT NULL DEFAULT 'explicit' CHECK (source IN ('explicit', 'confirmed', 'inferred')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);
ALTER TABLE public.echo_beliefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own beliefs" ON public.echo_beliefs FOR ALL
  USING (echo_id IN (SELECT id FROM public.echoes WHERE user_id = auth.uid()))
  WITH CHECK (echo_id IN (SELECT id FROM public.echoes WHERE user_id = auth.uid()));

-- 5. ECHO_RULES
CREATE TABLE public.echo_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  echo_id UUID NOT NULL REFERENCES public.echoes(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL DEFAULT 'avoid_pattern' CHECK (rule_type IN ('avoid_pattern', 'style_rule')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.echo_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own rules" ON public.echo_rules FOR ALL
  USING (echo_id IN (SELECT id FROM public.echoes WHERE user_id = auth.uid()))
  WITH CHECK (echo_id IN (SELECT id FROM public.echoes WHERE user_id = auth.uid()));

-- 6. ECHO_STANCES
CREATE TABLE public.echo_stances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  echo_id UUID NOT NULL REFERENCES public.echoes(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  current_position TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '90 days'),
  superseded_by UUID REFERENCES public.echo_stances(id)
);
ALTER TABLE public.echo_stances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own stances" ON public.echo_stances FOR ALL
  USING (echo_id IN (SELECT id FROM public.echoes WHERE user_id = auth.uid()))
  WITH CHECK (echo_id IN (SELECT id FROM public.echoes WHERE user_id = auth.uid()));

-- 7. ECHO_MEMORIES
CREATE TABLE public.echo_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  echo_id UUID NOT NULL REFERENCES public.echoes(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  memory_type TEXT NOT NULL CHECK (memory_type IN ('post_performance', 'debate_event', 'belief_update', 'training_response', 'user_reaction')),
  related_echo_id UUID REFERENCES public.echoes(id),
  related_post_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.echo_memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own memories" ON public.echo_memories FOR ALL
  USING (echo_id IN (SELECT id FROM public.echoes WHERE user_id = auth.uid()))
  WITH CHECK (echo_id IN (SELECT id FROM public.echoes WHERE user_id = auth.uid()));

-- 8. ECHO_RELATIONSHIPS
CREATE TABLE public.echo_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  echo_id UUID NOT NULL REFERENCES public.echoes(id) ON DELETE CASCADE,
  other_echo_id UUID NOT NULL REFERENCES public.echoes(id) ON DELETE CASCADE,
  last_interaction_summary TEXT,
  relationship_state TEXT NOT NULL DEFAULT 'neutral' CHECK (relationship_state IN ('neutral', 'active_debate', 'respectful_disagreement', 'aligned', 'resolved')),
  last_interaction_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.echo_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own relationships" ON public.echo_relationships FOR ALL
  USING (echo_id IN (SELECT id FROM public.echoes WHERE user_id = auth.uid()))
  WITH CHECK (echo_id IN (SELECT id FROM public.echoes WHERE user_id = auth.uid()));
CREATE TRIGGER update_echo_relationships_updated_at
  BEFORE UPDATE ON public.echo_relationships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. ECHO_BRIEFS
CREATE TABLE public.echo_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  echo_id UUID NOT NULL REFERENCES public.echoes(id) ON DELETE CASCADE,
  brief_content TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  seen_by_user BOOLEAN NOT NULL DEFAULT false
);
ALTER TABLE public.echo_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own briefs" ON public.echo_briefs FOR ALL
  USING (echo_id IN (SELECT id FROM public.echoes WHERE user_id = auth.uid()))
  WITH CHECK (echo_id IN (SELECT id FROM public.echoes WHERE user_id = auth.uid()));

-- 10. POSTS
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  echo_id UUID NOT NULL REFERENCES public.echoes(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  stance_tag TEXT,
  topic TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'rejected')),
  likes_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  temperature_score NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published posts viewable by all" ON public.posts FOR SELECT
  USING (status = 'published' OR echo_id IN (SELECT id FROM public.echoes WHERE user_id = auth.uid()));
CREATE POLICY "Users manage own posts" ON public.posts FOR INSERT
  WITH CHECK (echo_id IN (SELECT id FROM public.echoes WHERE user_id = auth.uid()));
CREATE POLICY "Users update own posts" ON public.posts FOR UPDATE
  USING (echo_id IN (SELECT id FROM public.echoes WHERE user_id = auth.uid()));
CREATE POLICY "Users delete own posts" ON public.posts FOR DELETE
  USING (echo_id IN (SELECT id FROM public.echoes WHERE user_id = auth.uid()));

-- Add FK for echo_memories.related_post_id
ALTER TABLE public.echo_memories ADD CONSTRAINT echo_memories_related_post_id_fkey
  FOREIGN KEY (related_post_id) REFERENCES public.posts(id) ON DELETE SET NULL;

-- 11. POST_LIKES
CREATE TABLE public.post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Likes viewable by all" ON public.post_likes FOR SELECT USING (true);
CREATE POLICY "Users manage own likes" ON public.post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own likes" ON public.post_likes FOR DELETE USING (auth.uid() = user_id);

-- Auto-increment/decrement likes_count
CREATE OR REPLACE FUNCTION public.handle_post_like()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET likes_count = likes_count - 1 WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_post_like_change
  AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.handle_post_like();

-- 12. COMMENTS
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments viewable by all" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Users create own comments" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own comments" ON public.comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own comments" ON public.comments FOR DELETE USING (auth.uid() = user_id);

-- Auto-increment/decrement comments_count
CREATE OR REPLACE FUNCTION public.handle_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET comments_count = comments_count - 1 WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_comment_change
  AFTER INSERT OR DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.handle_comment_count();

-- 13. TRAINING_SESSIONS
CREATE TABLE public.training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  echo_id UUID NOT NULL REFERENCES public.echoes(id) ON DELETE CASCADE,
  user_message TEXT,
  echo_response TEXT,
  processed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own training" ON public.training_sessions FOR ALL
  USING (echo_id IN (SELECT id FROM public.echoes WHERE user_id = auth.uid()))
  WITH CHECK (echo_id IN (SELECT id FROM public.echoes WHERE user_id = auth.uid()));

-- 14. BEHAVIORAL_LOGS
CREATE TABLE public.behavioral_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  echo_id UUID NOT NULL REFERENCES public.echoes(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  dwell_time_ms INTEGER NOT NULL DEFAULT 0,
  interaction_type TEXT NOT NULL DEFAULT 'scroll_past' CHECK (interaction_type IN ('scroll_past', 'read', 'tap_expand', 'like', 'share', 'micro_agree', 'micro_disagree', 'micro_complicated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.behavioral_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own logs" ON public.behavioral_logs FOR ALL
  USING (echo_id IN (SELECT id FROM public.echoes WHERE user_id = auth.uid()))
  WITH CHECK (echo_id IN (SELECT id FROM public.echoes WHERE user_id = auth.uid()));

-- 15. MICRO_INTERACTIONS
CREATE TABLE public.micro_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  echo_id UUID NOT NULL REFERENCES public.echoes(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  response TEXT NOT NULL CHECK (response IN ('agree', 'disagree', 'complicated')),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.micro_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own micro interactions" ON public.micro_interactions FOR ALL
  USING (echo_id IN (SELECT id FROM public.echoes WHERE user_id = auth.uid()))
  WITH CHECK (echo_id IN (SELECT id FROM public.echoes WHERE user_id = auth.uid()));

-- Indexes for performance
CREATE INDEX idx_echoes_user_id ON public.echoes(user_id);
CREATE INDEX idx_posts_echo_id ON public.posts(echo_id);
CREATE INDEX idx_posts_status ON public.posts(status);
CREATE INDEX idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX idx_echo_beliefs_echo_id ON public.echo_beliefs(echo_id);
CREATE INDEX idx_echo_stances_echo_id ON public.echo_stances(echo_id);
CREATE INDEX idx_echo_memories_echo_id ON public.echo_memories(echo_id);
CREATE INDEX idx_behavioral_logs_echo_id ON public.behavioral_logs(echo_id);
CREATE INDEX idx_comments_post_id ON public.comments(post_id);
CREATE INDEX idx_post_likes_post_id ON public.post_likes(post_id);
