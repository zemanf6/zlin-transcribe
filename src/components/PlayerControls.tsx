import { formatDuration, formatSessionClock } from '../utils/time';

interface PlayerControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  sessionStartTime: string;
  videoAnchorOffsetSeconds?: number;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onSkip: (deltaSeconds: number) => void;
  onSeekToSessionStart: () => void;
}

export default function PlayerControls({
  isPlaying,
  currentTime,
  duration,
  sessionStartTime,
  videoAnchorOffsetSeconds = 0,
  onTogglePlay,
  onSeek,
  onSkip,
  onSeekToSessionStart,
}: PlayerControlsProps) {
  const safeDuration = Number.isFinite(duration) ? duration : 0;

  return (
    <section className="controls-card">
      <div className="controls-row">
        <button type="button" className="primary-button" onClick={onTogglePlay}>
          {isPlaying ? 'Pauza' : 'Přehrát'}
        </button>

        <button type="button" className="secondary-button" onClick={onSeekToSessionStart}>
          Na začátek jednání
        </button>

        <button type="button" className="jump-button" onClick={() => onSkip(-15)}>
          -15 s
        </button>

        <button type="button" className="jump-button" onClick={() => onSkip(-5)}>
          -5 s
        </button>

        <button type="button" className="jump-button" onClick={() => onSkip(5)}>
          +5 s
        </button>

        <button type="button" className="jump-button" onClick={() => onSkip(15)}>
          +15 s
        </button>
      </div>

      <div className="timeline-block">
        <input
          className="timeline-range"
          type="range"
          min={0}
          max={safeDuration}
          step={0.1}
          value={Math.min(currentTime, safeDuration)}
          onChange={(event) => onSeek(Number(event.target.value))}
          disabled={safeDuration <= 0}
        />

        <div className="timeline-meta">
          <span>Čas videa: {formatDuration(currentTime)}</span>
          <span>
            Čas jednání:{' '}
            {formatSessionClock(sessionStartTime, currentTime, videoAnchorOffsetSeconds)}
          </span>
          <span>Délka videa: {formatDuration(safeDuration)}</span>
        </div>
      </div>
    </section>
  );
}