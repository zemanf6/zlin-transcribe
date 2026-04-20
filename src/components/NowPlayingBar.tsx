import type { Chapter, Speaker, Speech } from '../types/session';
import { formatSessionClock } from '../utils/time';

interface NowPlayingBarProps {
  hasSessionStarted: boolean;
  activeChapter: Chapter | null;
  activeSpeech: Speech | null;
  activeSpeaker: Speaker | null;
  currentTime: number;
  sessionStartTime: string;
  videoAnchorOffsetSeconds?: number;
}

export default function NowPlayingBar({
  hasSessionStarted,
  activeChapter,
  activeSpeech,
  activeSpeaker,
  currentTime,
  sessionStartTime,
  videoAnchorOffsetSeconds = 0,
}: NowPlayingBarProps) {
  const sessionClock = formatSessionClock(
    sessionStartTime,
    currentTime,
    videoAnchorOffsetSeconds,
  );

  if (!hasSessionStarted) {
    return (
      <section className="now-playing-bar">
        <div className="now-playing-topline">
          <span className="now-playing-status now-playing-status-muted">
            Čeká se na začátek jednání
          </span>
          <span className="now-playing-clock">{sessionClock}</span>
        </div>

        <div className="now-playing-primary">
          <span className="now-playing-primary-label">Začátek jednání</span>
          <strong>{sessionStartTime}</strong>
        </div>

        <div className="now-playing-meta">
          <span>Aktuální čas videa ještě spadá před kotvu</span>
        </div>
      </section>
    );
  }

  return (
    <section className="now-playing-bar">
      <div className="now-playing-topline">
        <span className="now-playing-status">Aktuálně</span>
        <span className="now-playing-clock">{sessionClock}</span>
      </div>

      <div className="now-playing-primary">
        {activeChapter ? (
          <>
            <span className="now-playing-pill">
              {activeChapter.number ?? '—'}
            </span>
            <div className="now-playing-primary-content">
              <span className="now-playing-primary-label">Bod jednání</span>
              <strong>{activeChapter.title}</strong>
            </div>
          </>
        ) : (
          <div className="now-playing-primary-content">
            <span className="now-playing-primary-label">Bod jednání</span>
            <strong>Aktuální bod se nepodařilo určit</strong>
          </div>
        )}
      </div>

      <div className="now-playing-speaker-card">
        <span className="now-playing-primary-label">Mluvčí</span>
        <div className="now-playing-speaker-name">
          {activeSpeaker?.display_name ?? activeSpeaker?.name ?? activeSpeech?.speaker_name_raw ?? 'Neuvedeno'}
        </div>

        <div className="now-playing-meta">
          <span>{activeSpeaker?.party ?? 'bez klubu / neuvedeno'}</span>
          <span>{activeSpeaker?.role ?? 'role neuvedena'}</span>
          <span>{activeSpeech?.speech_type ?? 'typ neuveden'}</span>
        </div>
      </div>
    </section>
  );
}