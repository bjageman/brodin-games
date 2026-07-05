import { useCountdown } from '../../../shared/hooks/useCountdown';
import type { MatchResultPayload } from '../types';
import { cn } from '../../../shared/utils/cn';
import EmailCard from './EmailCard';

interface MatchResultScreenProps {
  result: MatchResultPayload;
}

function VoteBadge({ count, isWinner }: { count: number; isWinner: boolean }) {
  return (
    <span
      className={cn(
        "text-[10px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 rounded",
        isWinner ? "bg-brodin-gold/90 text-gray-900" : "bg-gray-300 text-gray-700"
      )}
    >
      {count} vote{count === 1 ? '' : 's'}
    </span>
  );
}

export default function MatchResultScreen({ result }: MatchResultScreenProps) {
  const { msRemaining } = useCountdown(result.resultsEndTimestamp);
  const secondsLeft = Math.ceil(msRemaining / 1000);
  const { left, right, leftVotes, rightVotes } = result;
  const tied = leftVotes === rightVotes;
  const isLastMatch = result.matchIndex + 1 >= result.totalMatches;

  return (
    <div className="w-full max-w-md md:max-w-3xl mx-auto space-y-4">
      <div className="text-center">
        <h2 className="font-display text-lg font-bold text-brodin-gold uppercase tracking-wide">
          {tied ? "It's a Tie!" : 'And the Winner Is...'}
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          {isLastMatch ? 'Tallying final scores...' : `Next memo in ${secondsLeft}s`}
        </p>
      </div>

      <div className="flex flex-col md:flex-row items-stretch gap-4 md:gap-3">
        <div className="w-full md:flex-1">
          <EmailCard sheet={left} accent={!tied && leftVotes > rightVotes ? 'winner' : 'none'} badge={<VoteBadge count={leftVotes} isWinner={!tied && leftVotes > rightVotes} />} />
        </div>
        <div className="w-full md:flex-1">
          <EmailCard sheet={right} accent={!tied && rightVotes > leftVotes ? 'winner' : 'none'} badge={<VoteBadge count={rightVotes} isWinner={!tied && rightVotes > leftVotes} />} />
        </div>
      </div>
    </div>
  );
}
