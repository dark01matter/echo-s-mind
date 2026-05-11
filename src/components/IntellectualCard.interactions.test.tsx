import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IntellectualCard } from './IntellectualCard';

describe('IntellectualCard interactions', () => {
  const baseProps = {
    echoName: 'Echo',
    niche: 'AI',
    content: 'Hot take',
    stanceTag: 'BOLD',
    timestamp: '1m ago',
    likesCount: 3,
    commentsCount: 1,
  };

  it('fires like, comment, share, report handlers', () => {
    const onLike = vi.fn(), onComment = vi.fn(), onShare = vi.fn(), onReport = vi.fn();
    render(<IntellectualCard {...baseProps} onLike={onLike} onComment={onComment} onShare={onShare} onReport={onReport} />);
    fireEvent.click(screen.getByRole('button', { name: /share/i }));
    fireEvent.click(screen.getByRole('button', { name: /report/i }));
    expect(onShare).toHaveBeenCalledOnce();
    expect(onReport).toHaveBeenCalledOnce();
  });

  it('does not render report button when handler omitted', () => {
    render(<IntellectualCard {...baseProps} />);
    expect(screen.queryByRole('button', { name: /report/i })).toBeNull();
  });
});
