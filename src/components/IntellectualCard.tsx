import { motion } from 'framer-motion';

interface IntellectualCardProps {
  avatarUrl?: string | null;
  echoName: string;
  niche: string;
  content: string;
  stanceTag: string;
  /** @deprecated kept for backward compat — no longer rendered */
  evolutionScore?: number;
  timestamp: string;
  likesCount?: number;
  commentsCount?: number;
  liked?: boolean;
  followersCount?: number;
  isFollowing?: boolean;
  isOwn?: boolean;
  onFollow?: () => void;
  onLike?: () => void;
  onComment?: () => void;
  onShare?: () => void;
  onReport?: () => void;
  onClick?: () => void;
}

const formatCount = (n: number) => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
};

export function IntellectualCard({
  avatarUrl,
  echoName,
  niche,
  content,
  stanceTag,
  timestamp,
  likesCount = 0,
  commentsCount = 0,
  liked = false,
  followersCount = 0,
  isFollowing = false,
  isOwn = false,
  onFollow,
  onLike,
  onComment,
  onShare,
  onReport,
  onClick,
}: IntellectualCardProps) {
  const initial = echoName.charAt(0).toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-5 hover-lift cursor-pointer"
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-echo-purple to-echo-green flex items-center justify-center text-sm font-bold text-white shrink-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt={echoName} className="w-full h-full rounded-full object-cover" />
          ) : (
            initial
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground truncate">{echoName}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-echo-purple/20 text-echo-purple border border-echo-purple/30 shrink-0">
              ECHO
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{niche}</span>
            <span>·</span>
            <span>{timestamp}</span>
            {followersCount > 0 && (
              <>
                <span>·</span>
                <span>{formatCount(followersCount)} {followersCount === 1 ? 'follower' : 'followers'}</span>
              </>
            )}
          </div>
        </div>
        {!isOwn && onFollow && (
          <button
            onClick={(e) => { e.stopPropagation(); onFollow(); }}
            className={`shrink-0 text-xs font-medium px-3.5 py-1.5 rounded-full transition-all border ${
              isFollowing
                ? 'border-white/15 text-foreground/80 hover:border-destructive/40 hover:text-destructive hover:bg-destructive/5'
                : 'border-transparent bg-foreground text-background hover:bg-foreground/90'
            }`}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </button>
        )}
      </div>

      {/* Content */}
      <p className="text-foreground/90 text-sm leading-relaxed mb-4">{content}</p>

      {/* Stance Tag */}
      <div className="mb-4">
        <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-echo-purple/10 text-echo-purple border border-echo-purple/20">
          {stanceTag}
        </span>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-6 text-muted-foreground">
        <button onClick={(e) => { e.stopPropagation(); onLike?.(); }} className={`flex items-center gap-1.5 text-xs transition-colors ${liked ? 'text-echo-purple' : 'hover:text-echo-purple'}`}>
          <HeartIcon filled={liked} />
          <span>{likesCount}</span>
        </button>
        <button onClick={(e) => { e.stopPropagation(); onComment?.(); }} className="flex items-center gap-1.5 text-xs hover:text-echo-purple transition-colors">
          <CommentIcon />
          <span>{commentsCount}</span>
        </button>
        <button onClick={(e) => { e.stopPropagation(); onShare?.(); }} className="flex items-center gap-1.5 text-xs hover:text-echo-purple transition-colors" aria-label="Share">
          <ShareIcon />
        </button>
        {onReport && (
          <button
            onClick={(e) => { e.stopPropagation(); onReport(); }}
            className="ml-auto flex items-center gap-1.5 text-xs hover:text-destructive transition-colors"
            aria-label="Report"
            title="Report"
          >
            <FlagIcon />
          </button>
        )}
      </div>
    </motion.div>
  );
}

function HeartIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}
