import type { SessionSummary } from '../types/session';
import { parseClockToSeconds } from '../utils/time';

interface SummaryPanelProps {
  data: SessionSummary | null;
  isLoading: boolean;
  error: Error | null;
  sessionStartTime: string;
  videoAnchorOffsetSeconds?: number;
  onSeekToVideoTime: (videoSeconds: number) => void;
}

function getHighlightVideoSeconds(
  sessionClock: string,
  sessionStartTime: string,
  videoAnchorOffsetSeconds: number,
): number {
  const sessionOffsetSeconds =
    parseClockToSeconds(sessionClock) - parseClockToSeconds(sessionStartTime);

  return Math.max(0, sessionOffsetSeconds + videoAnchorOffsetSeconds);
}

function getToneLabel(tone: 'controversial' | 'dramatic' | 'interesting'): string {
  switch (tone) {
    case 'controversial':
      return 'Sporné';
    case 'dramatic':
      return 'Vyhrocené';
    case 'interesting':
      return 'Zajímavé';
    default:
      return 'Moment';
  }
}

export default function SummaryPanel({
  data,
  isLoading,
  error,
  sessionStartTime,
  videoAnchorOffsetSeconds = 0,
  onSeekToVideoTime,
}: SummaryPanelProps) {
  if (isLoading) {
    return (
      <section className="summary-panel">
        <div className="detail-empty-state">Načítám souhrn…</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="summary-panel">
        <div className="detail-empty-state">Nepodařilo se načíst souhrn.</div>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="summary-panel">
        <div className="detail-empty-state">Souhrn zatím není k dispozici.</div>
      </section>
    );
  }

  return (
    <section className="summary-panel">
      <div className="summary-header">
        <h2>{data.title}</h2>
        <p className="summary-lead">{data.short_summary}</p>
      </div>

      <div className="summary-section-list">
        {data.sections.map((section) => (
          <article key={section.id} className="summary-section-card">
            <h3>{section.title}</h3>
            <p>{section.content}</p>
          </article>
        ))}
      </div>

      {data.highlights && data.highlights.length > 0 ? (
        <div className="summary-highlights">
          <div className="summary-highlights-header">
            <h3>Výrazné momenty</h3>
            <p>Výběr sporných, vyhrocených nebo neobvyklých pasáží z jednání.</p>
          </div>

          <div className="summary-highlight-list">
            {data.highlights.map((highlight) => {
              const videoSeconds = getHighlightVideoSeconds(
                highlight.session_clock,
                sessionStartTime,
                videoAnchorOffsetSeconds,
              );

              return (
                <button
                  key={highlight.id}
                  type="button"
                  className="summary-highlight-card"
                  onClick={() => onSeekToVideoTime(videoSeconds)}
                >
                  <div className="summary-highlight-top">
                    <span
                      className={[
                        'summary-highlight-badge',
                        `summary-highlight-badge-${highlight.tone}`,
                      ].join(' ')}
                    >
                      {getToneLabel(highlight.tone)}
                    </span>

                    <span className="summary-highlight-time">
                      {highlight.chapter_label} · {highlight.session_clock}
                    </span>
                  </div>

                  <div className="summary-highlight-title">{highlight.title}</div>
                  <div className="summary-highlight-description">
                    {highlight.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {data.footer_note ? (
        <div className="summary-footer-note">
          {data.footer_note}
        </div>
      ) : null}
    </section>
  );
}