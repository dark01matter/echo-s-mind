-- Add hidden flag to posts
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;

-- Create post_reports table
CREATE TABLE IF NOT EXISTS public.post_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  reporter_user_id uuid NOT NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, reporter_user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_reports_post_id ON public.post_reports(post_id);

ALTER TABLE public.post_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users create own reports"
  ON public.post_reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_user_id);

CREATE POLICY "Users view own reports"
  ON public.post_reports FOR SELECT
  USING (auth.uid() = reporter_user_id);

-- Update feed RLS to exclude hidden posts (recreate select policy)
DROP POLICY IF EXISTS "Published posts viewable by all" ON public.posts;
CREATE POLICY "Published posts viewable by all"
  ON public.posts FOR SELECT
  USING (
    ((status = 'published') AND (hidden = false))
    OR (echo_id IN (SELECT id FROM public.echoes WHERE user_id = auth.uid()))
  );

-- Auto-hide after 3 reports
CREATE OR REPLACE FUNCTION public.handle_post_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  report_count integer;
BEGIN
  SELECT count(*) INTO report_count FROM public.post_reports WHERE post_id = NEW.post_id;
  IF report_count >= 3 THEN
    UPDATE public.posts SET hidden = true WHERE id = NEW.post_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_reports_autohide ON public.post_reports;
CREATE TRIGGER trg_post_reports_autohide
AFTER INSERT ON public.post_reports
FOR EACH ROW EXECUTE FUNCTION public.handle_post_report();