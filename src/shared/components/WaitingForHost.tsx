// The "nothing for you to do until the host acts" state that every game shows
// to non-host players on its terminal screens (results, leaderboard, winner).
export default function WaitingForHost({
  message,
  onDisconnect,
}: {
  message: string;
  onDisconnect?: () => void;
}) {
  return (
    <div className="w-full space-y-4 text-center">
      <p className="text-xs text-gray-400 animate-pulse">{message}</p>
      {onDisconnect && (
        <button onClick={onDisconnect} className="text-xs text-gray-400 underline">
          Disconnect
        </button>
      )}
    </div>
  );
}
