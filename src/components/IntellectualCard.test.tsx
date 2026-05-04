import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IntellectualCard } from './IntellectualCard';

const baseProps = {
  echoName: 'Echo One',
  niche: 'Tech',
  content: 'Test content',
  stanceTag: 'PRO',
  evolutionScore: 42,
  timestamp: '2m ago',
  likesCount: 3,
  commentsCount: 1,
};

describe('IntellectualCard', () => {
  it('renders content, niche, likes and comment counts', () => {
    render(<IntellectualCard {...baseProps} />);
    expect(screen.getByText('Test content')).toBeInTheDocument();
    expect(screen.getByText('Tech')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('fires onLike, onComment, onShare without triggering onClick', () => {
    const onLike = vi.fn();
    const onComment = vi.fn();
    const onShare = vi.fn();
    const onClick = vi.fn();
    render(<IntellectualCard {...baseProps} onLike={onLike} onComment={onComment} onShare={onShare} onClick={onClick} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]); // like
    fireEvent.click(buttons[1]); // comment
    fireEvent.click(buttons[2]); // share
    expect(onLike).toHaveBeenCalledTimes(1);
    expect(onComment).toHaveBeenCalledTimes(1);
    expect(onShare).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('shows filled heart when liked=true', () => {
    const { container } = render(<IntellectualCard {...baseProps} liked />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('fill')).toBe('currentColor');
  });
});
