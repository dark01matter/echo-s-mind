import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MicroInteractionStrip } from './MicroInteractionStrip';

describe('MicroInteractionStrip', () => {
  it('renders three response options', () => {
    render(<MicroInteractionStrip onResponse={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText('Agree')).toBeInTheDocument();
    expect(screen.getByText('Disagree')).toBeInTheDocument();
    expect(screen.getByText("It's complicated")).toBeInTheDocument();
  });

  it('calls onResponse with picked value and disables further clicks', () => {
    const onResponse = vi.fn();
    render(<MicroInteractionStrip onResponse={onResponse} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByText('Agree'));
    expect(onResponse).toHaveBeenCalledWith('agree');
    fireEvent.click(screen.getByText('Disagree'));
    // Second click should not register because buttons are disabled after pick
    expect(onResponse).toHaveBeenCalledTimes(1);
  });
});
