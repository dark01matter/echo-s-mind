-- Attach the existing handler functions as triggers (they were never wired up)
DROP TRIGGER IF EXISTS trg_post_likes_count ON public.post_likes;
CREATE TRIGGER trg_post_likes_count
AFTER INSERT OR DELETE ON public.post_likes
FOR EACH ROW EXECUTE FUNCTION public.handle_post_like();

DROP TRIGGER IF EXISTS trg_comments_count ON public.comments;
CREATE TRIGGER trg_comments_count
AFTER INSERT OR DELETE ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.handle_comment_count();

-- Backfill so existing rows are accurate
UPDATE public.posts p SET
  likes_count = COALESCE((SELECT COUNT(*) FROM public.post_likes WHERE post_id = p.id), 0),
  comments_count = COALESCE((SELECT COUNT(*) FROM public.comments WHERE post_id = p.id), 0);