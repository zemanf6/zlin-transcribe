import type { Chapter, Speaker, Speech } from '../types/session';
import { formatDurationSecondsLabel } from '../utils/time';

interface ChapterDetailPanelProps {
  chapter: Chapter | null;
  activeSpeechId: string | null;
  speakerMap: Record<string, Speaker>;
  onSeekToSessionTime: (sessionOffsetSeconds: number) => void;
}

function getSpeechDurationLabel(speech: Speech): string | null {
  if (speech.end_offset_seconds == null) {
    return null;
  }

  const seconds = speech.end_offset_seconds - speech.video_offset_seconds;
  if (seconds <= 0) {
    return null;
  }

  return formatDurationSecondsLabel(seconds);
}

export default function ChapterDetailPanel({
  chapter,
  activeSpeechId,
  speakerMap,
  onSeekToSessionTime,
}: ChapterDetailPanelProps) {
  if (!chapter) {
    return (
      <section className="chapter-detail">
        <div className="detail-empty-state">
          Nebyla nalezena žádná kapitola.
        </div>
      </section>
    );
  }

  return (
    <section className="chapter-detail">
      <div className="chapter-detail-header">
        <div className="chapter-detail-heading">
          <p className="chapter-detail-kicker">
            Bod {chapter.number ?? '—'} · {chapter.absolute_start_time}
          </p>
          <h2>{chapter.title}</h2>
          <p className="chapter-detail-subtitle">
            {chapter.speeches.length} vystoupení
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={() => onSeekToSessionTime(chapter.video_offset_seconds)}
        >
          Přejít na začátek bodu
        </button>
      </div>

      <div className="speech-detail-list">
        {chapter.speeches.map((speech) => {
          const speaker = speakerMap[speech.speaker_id];
          const isActive = speech.id === activeSpeechId;
          const durationLabel = getSpeechDurationLabel(speech);

          return (
            <button
              key={speech.id}
              type="button"
              className={[
                'speech-detail-row',
                isActive ? 'speech-detail-row-active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onSeekToSessionTime(speech.video_offset_seconds)}
            >
              <div className="speech-detail-main">
                <div className="speech-detail-line-primary">
                  <span className="speech-detail-name">
                    {speaker?.display_name ?? speaker?.name ?? speech.speaker_name_raw}
                  </span>

                  {speaker?.party ? (
                    <span className="speech-detail-party">{speaker.party}</span>
                  ) : null}
                </div>

                <div className="speech-detail-line-secondary">
                  <span>{speaker?.role ?? 'neuvedeno'}</span>
                  <span>{speech.speech_type}</span>
                  <span>{speech.absolute_start_time}</span>
                  {durationLabel ? <span>{durationLabel}</span> : null}
                </div>
              </div>

              <span className="speech-detail-jump">Přejít</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}