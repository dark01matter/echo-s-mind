import { describe, it, expect } from 'vitest';
import { nextLikedSet, nextLikesCount } from './likeLogic';

describe('likeLogic', () => {
  it('toggles a post id into the set', () => {
    const set = new Set<string>();
    const next = nextLikedSet(set, 'p1');
    expect(next.has('p1')).toBe(true);
  });

  it('toggles a post id out of the set', () => {
    const next = nextLikedSet(new Set(['p1']), 'p1');
    expect(next.has('p1')).toBe(false);
  });

  it('does not mutate the original set', () => {
    const set = new Set(['p1']);
    nextLikedSet(set, 'p2');
    expect(set.size).toBe(1);
  });

  it('increments count when not previously liked', () => {
    expect(nextLikesCount(5, false)).toBe(6);
  });

  it('decrements count when previously liked', () => {
    expect(nextLikesCount(5, true)).toBe(4);
  });

  it('never goes below zero', () => {
    expect(nextLikesCount(0, true)).toBe(0);
  });
});
