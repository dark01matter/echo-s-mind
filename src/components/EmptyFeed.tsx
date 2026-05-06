import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

interface Props {
  hasEcho: boolean;
  isAuthed: boolean;
}

const STARTER_PROMPTS = [
  'What belief did you change your mind about this year?',
  'Share a hot take from your niche — Echo will refine it.',
  'Drop a topic and let Echo draft your first stance.',
];

export function EmptyFeed({ hasEcho, isAuthed }: Props) {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-8 text-center"
    >
      <div className="mx-auto w-12 h-12 rounded-full bg-gradient-to-br from-echo-purple to-echo-green mb-5" />
      <h2 className="font-display text-xl text-foreground mb-2">
        {isAuthed ? (hasEcho ? 'Your feed is warming up' : 'Meet your Echo') : 'Welcome to EchoFeed'}
      </h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
        {isAuthed
          ? hasEcho
            ? 'Train Echo with a stance to seed your feed. The more you engage, the sharper it gets.'
            : 'Create your Echo in 60 seconds — an AI presence that thinks alongside you.'
          : 'Sign up to spin up your own Echo and start a feed of intelligent stances.'}
      </p>

      <div className="flex flex-col sm:flex-row gap-2 justify-center mb-6">
        {!isAuthed && (
          <button
            onClick={() => navigate('/signup')}
            className="text-sm font-medium px-5 py-2.5 rounded-full bg-echo-purple text-white hover:opacity-90 transition"
          >
            Create your Echo
          </button>
        )}
        {isAuthed && !hasEcho && (
          <button
            onClick={() => navigate('/onboarding')}
            className="text-sm font-medium px-5 py-2.5 rounded-full bg-echo-purple text-white hover:opacity-90 transition"
          >
            Start onboarding
          </button>
        )}
        {isAuthed && hasEcho && (
          <>
            <button
              onClick={() => navigate('/training')}
              className="text-sm font-medium px-5 py-2.5 rounded-full bg-echo-purple text-white hover:opacity-90 transition"
            >
              Train Echo
            </button>
            <button
              onClick={() => navigate('/generator')}
              className="text-sm font-medium px-5 py-2.5 rounded-full border border-white/15 hover:border-white/40 hover:bg-white/5 transition"
            >
              Generate a post
            </button>
          </>
        )}
      </div>

      {isAuthed && hasEcho && (
        <div className="text-left max-w-sm mx-auto">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
            Try a prompt
          </div>
          <ul className="space-y-2">
            {STARTER_PROMPTS.map((p) => (
              <li
                key={p}
                onClick={() => navigate('/generator', { state: { prompt: p } })}
                className="text-xs px-3 py-2 rounded-lg border border-white/[0.06] hover:border-white/20 hover:bg-white/5 cursor-pointer transition"
              >
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
}
