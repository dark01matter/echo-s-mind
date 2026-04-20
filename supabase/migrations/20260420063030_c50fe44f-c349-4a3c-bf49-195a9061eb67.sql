-- Add unique constraint to prevent duplicate likes
ALTER TABLE public.post_likes ADD CONSTRAINT post_likes_unique UNIQUE (post_id, user_id);