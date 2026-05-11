-- Follow system
CREATE TABLE public.echo_follows (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_user_id uuid NOT NULL,
  echo_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_user_id, echo_id)
);

CREATE INDEX idx_echo_follows_user ON public.echo_follows(follower_user_id);
CREATE INDEX idx_echo_follows_echo ON public.echo_follows(echo_id);

ALTER TABLE public.echo_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Follows viewable by authenticated"
  ON public.echo_follows FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users create own follows"
  ON public.echo_follows FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = follower_user_id
    AND echo_id NOT IN (SELECT id FROM public.echoes WHERE user_id = auth.uid())
  );

CREATE POLICY "Users delete own follows"
  ON public.echo_follows FOR DELETE TO authenticated
  USING (auth.uid() = follower_user_id);

-- Denormalized counters
ALTER TABLE public.echoes ADD COLUMN IF NOT EXISTS followers_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.echoes ADD COLUMN IF NOT EXISTS reflection_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.handle_echo_follow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.echoes SET followers_count = followers_count + 1 WHERE id = NEW.echo_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.echoes SET followers_count = GREATEST(followers_count - 1, 0) WHERE id = OLD.echo_id;
    RETURN OLD;
  END IF;
END;
$$;

CREATE TRIGGER echo_follows_count
  AFTER INSERT OR DELETE ON public.echo_follows
  FOR EACH ROW EXECUTE FUNCTION public.handle_echo_follow();

-- Memory upgrades
ALTER TABLE public.echo_memories ADD COLUMN IF NOT EXISTS importance integer NOT NULL DEFAULT 2;
ALTER TABLE public.echo_memories ADD COLUMN IF NOT EXISTS summary_of uuid[] DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_echo_memories_importance ON public.echo_memories(echo_id, importance DESC, created_at DESC);