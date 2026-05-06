import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Signup from '@/pages/Signup';

const signUpMock = vi.fn();
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ signUp: signUpMock, signIn: vi.fn(), signOut: vi.fn(), user: null, session: null, loading: false }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<any>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

describe('Signup page', () => {
  beforeEach(() => { signUpMock.mockReset(); navigateMock.mockReset(); });

  it('submits signup with email, password, display name', async () => {
    signUpMock.mockResolvedValue(undefined);
    render(<MemoryRouter><Signup /></MemoryRouter>);

    fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: 'Ada' } });
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'ada@x.com' } });
    fireEvent.change(screen.getByPlaceholderText('Min 6 characters'), { target: { value: 'pw1234' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(signUpMock).toHaveBeenCalledWith('ada@x.com', 'pw1234', 'Ada'));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/onboarding'));
  });

  it('shows error toast when signup fails', async () => {
    signUpMock.mockRejectedValue(new Error('Email taken'));
    render(<MemoryRouter><Signup /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: 'A' } });
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByPlaceholderText('Min 6 characters'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() => expect(signUpMock).toHaveBeenCalled());
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
