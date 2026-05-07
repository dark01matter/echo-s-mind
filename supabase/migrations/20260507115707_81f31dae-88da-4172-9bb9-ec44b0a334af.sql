-- Restrict SELECT on user-linked tables to authenticated users only
DROP POLICY IF EXISTS "Likes viewable by all" ON public.post_likes;
CREATE POLICY "Likes viewable by authenticated"
ON public.post_likes
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Comments viewable by all" ON public.comments;
CREATE POLICY "Comments viewable by authenticated"
ON public.comments
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Echoes viewable by all" ON public.echoes;
CREATE POLICY "Echoes viewable by authenticated"
ON public.echoes
FOR SELECT
TO authenticated
USING (true);

-- Revoke direct EXECUTE on internal trigger functions (they still run as triggers)
REVOKE EXECUTE ON FUNCTION public.handle_post_like() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_comment_count() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_post_report() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;