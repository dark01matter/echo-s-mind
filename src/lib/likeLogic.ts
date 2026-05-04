/**
 * Pure helpers for like-toggle math. Extracted so they can be unit-tested
 * without mocking Supabase.
 */
export function nextLikedSet(current: Set<string>, postId: string): Set<string> {
  const next = new Set(current);
  if (next.has(postId)) next.delete(postId);
  else next.add(postId);
  return next;
}

export function nextLikesCount(current: number, wasLiked: boolean): number {
  return Math.max(0, current + (wasLiked ? -1 : 1));
}
