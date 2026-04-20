import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Chapter, Speaker, Speech, TranscriptSegment } from '../types/session';
import { findActiveChapter, findActiveSpeech } from '../utils/session';
import { formatDuration, formatSessionClock } from '../utils/time';

interface TranscriptPanelProps {
  segments: TranscriptSegment[];
  activeSegmentId: string | null;
  isLoading: boolean;
  error: Error | null;
  chapters: Chapter[];
  speeches: Speech[];
  speakerMap: Record<string, Speaker>;
  sessionStartTime: string;
  sessionTitle?: string;
  sessionDate?: string;
  videoAnchorOffsetSeconds?: number;
  onSeekToVideoTime: (videoSeconds: number) => void;
}

interface TranscriptEntry {
  segment: TranscriptSegment;
  sessionOffsetSeconds: number;
  speech: Speech | null;
  speaker: Speaker | null;
  chapter: Chapter | null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderHighlightedText(text: string, query: string): ReactNode {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return text;
  }

  const regex = new RegExp(`(${escapeRegExp(trimmedQuery)})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (part.toLowerCase() === trimmedQuery.toLowerCase()) {
      return (
        <mark key={`${part}-${index}`} className="transcript-mark">
          {part}
        </mark>
      );
    }

    return part;
  });
}

function getSegmentReferenceVideoSeconds(segment: TranscriptSegment): number {
  const duration = Math.max(
    0,
    segment.end_video_seconds - segment.start_video_seconds,
  );

  return segment.start_video_seconds + (duration / 2);
}

function sanitizeFileName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function buildTranscriptTxt(
  entries: TranscriptEntry[],
  sessionStartTime: string,
  videoAnchorOffsetSeconds: number,
  sessionTitle?: string,
  sessionDate?: string,
): string {
  const lines: string[] = [];

  if (sessionTitle) {
    lines.push(sessionTitle);
  }

  if (sessionDate) {
    lines.push(sessionDate);
  }

  if (sessionTitle || sessionDate) {
    lines.push('');
  }

  let previousChapterId: string | null = null;
  let previousSpeakerId: string | null = null;

  for (const entry of entries) {
    const { segment, speech, speaker, chapter } = entry;
    const chapterId = chapter?.id ?? null;
    const speakerId = speech?.speaker_id ?? null;

    if (chapterId && chapterId !== previousChapterId) {
      if (lines.length > 0 && lines[lines.length - 1] !== '') {
        lines.push('');
      }

      lines.push(
        `=== Bod ${chapter?.number ?? '—'} · ${chapter?.absolute_start_time ?? ''} ===`.trim(),
      );
      if (chapter?.title) {
        lines.push(chapter.title);
      }
      lines.push('');

      previousChapterId = chapterId;
      previousSpeakerId = null;
    }

    if (speakerId !== previousSpeakerId) {
      const speakerName =
        speaker?.display_name ??
        speaker?.name ??
        speech?.speaker_name_raw ??
        'Neuvedeno';

      const role = speaker?.role ?? 'neuvedeno';
      const sessionClock = formatSessionClock(
        sessionStartTime,
        segment.start_video_seconds,
        videoAnchorOffsetSeconds,
      );

      if (lines.length > 0 && lines[lines.length - 1] !== '') {
        lines.push('');
      }

      lines.push(`[${sessionClock}] ${speakerName} (${role})`);
      previousSpeakerId = speakerId;
    }

    lines.push(segment.text.trim());
  }

  return lines.join('\n').trim();
}

function downloadTextFile(content: string, fileName: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();

  URL.revokeObjectURL(url);
}

export default function TranscriptPanel({
  segments,
  activeSegmentId,
  isLoading,
  error,
  chapters,
  speeches,
  speakerMap,
  sessionStartTime,
  sessionTitle,
  sessionDate,
  videoAnchorOffsetSeconds = 0,
  onSeekToVideoTime,
}: TranscriptPanelProps) {
  const [query, setQuery] = useState('');
  const [selectedSpeakerId, setSelectedSpeakerId] = useState<string>('all');
  const [isAutoFollowEnabled, setIsAutoFollowEnabled] = useState(true);

  const activeRowRef = useRef<HTMLButtonElement | null>(null);

  const entries = useMemo<TranscriptEntry[]>(() => {
    return segments.map((segment) => {
      const referenceVideoSeconds = getSegmentReferenceVideoSeconds(segment);

      const sessionOffsetSeconds = Math.max(
        0,
        referenceVideoSeconds - videoAnchorOffsetSeconds,
      );

      const speech = findActiveSpeech(speeches, sessionOffsetSeconds);
      const speaker = speech ? speakerMap[speech.speaker_id] ?? null : null;
      const chapter = findActiveChapter(chapters, sessionOffsetSeconds);

      return {
        segment,
        sessionOffsetSeconds,
        speech,
        speaker,
        chapter,
      };
    });
  }, [segments, speeches, speakerMap, chapters, videoAnchorOffsetSeconds]);

  const speakerOptions = useMemo(() => {
    const unique = new Map<string, { id: string; label: string }>();

    for (const entry of entries) {
      if (!entry.speech?.speaker_id) {
        continue;
      }

      const speakerId = entry.speech.speaker_id;
      const speaker = entry.speaker ?? speakerMap[speakerId] ?? null;
      const label =
        speaker?.display_name ??
        speaker?.name ??
        entry.speech.speaker_name_raw;

      if (!unique.has(speakerId)) {
        unique.set(speakerId, { id: speakerId, label });
      }
    }

    return Array.from(unique.values()).sort((left, right) =>
      left.label.localeCompare(right.label, 'cs'),
    );
  }, [entries, speakerMap]);

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return entries.filter((entry) => {
      const matchesText =
        !normalizedQuery ||
        entry.segment.text.toLowerCase().includes(normalizedQuery);

      const matchesSpeaker =
        selectedSpeakerId === 'all' ||
        entry.speech?.speaker_id === selectedSpeakerId;

      return matchesText && matchesSpeaker;
    });
  }, [entries, query, selectedSpeakerId]);

  useEffect(() => {
    if (!isAutoFollowEnabled) {
      return;
    }

    const activeNode = activeRowRef.current;
    if (!activeNode) {
      return;
    }

    activeNode.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
  }, [activeSegmentId, isAutoFollowEnabled, filteredEntries]);

  function handleEnableAutoFollow(): void {
    setIsAutoFollowEnabled(true);

    const activeNode = activeRowRef.current;
    if (!activeNode) {
      return;
    }

    activeNode.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
  }

  function handleTranscriptManualNavigation(): void {
    if (isAutoFollowEnabled) {
      setIsAutoFollowEnabled(false);
    }
  }

  function handleDownloadTxt(): void {
    const content = buildTranscriptTxt(
      filteredEntries,
      sessionStartTime,
      videoAnchorOffsetSeconds,
      sessionTitle,
      sessionDate,
    );

    const baseName = sanitizeFileName(
      sessionTitle || `transcript-${sessionDate || 'export'}`,
    );

    downloadTextFile(content, `${baseName || 'transcript'}.txt`);
  }

  if (isLoading) {
    return (
      <section className="transcript-panel">
        <div className="detail-empty-state">Načítám přepis…</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="transcript-panel">
        <div className="detail-empty-state">Nepodařilo se načíst přepis.</div>
      </section>
    );
  }

  if (segments.length === 0) {
    return (
      <section className="transcript-panel">
        <div className="detail-empty-state">Přepis zatím není k dispozici.</div>
      </section>
    );
  }

  return (
    <section className="transcript-panel">
      <div className="transcript-toolbar">
        <div className="transcript-heading">
          <h2>Přepis</h2>
          <p>
            {filteredEntries.length} z {entries.length} segmentů
          </p>
        </div>

        <div className="transcript-filters">
          <select
            className="transcript-speaker-select"
            value={selectedSpeakerId}
            onChange={(event) => setSelectedSpeakerId(event.target.value)}
          >
            <option value="all">Všichni mluvčí</option>
            {speakerOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>

          <input
            type="search"
            className="transcript-search"
            placeholder="Hledat v přepisu…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          <button
            type="button"
            className={[
              'transcript-follow-button',
              isAutoFollowEnabled ? 'transcript-follow-button-active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={handleEnableAutoFollow}
          >
            {isAutoFollowEnabled ? 'Sleduje aktuální' : 'Sledovat aktuální'}
          </button>

          <button
            type="button"
            className="transcript-download-button"
            onClick={handleDownloadTxt}
          >
            Stáhnout TXT
          </button>
        </div>
      </div>

      <div
        className="transcript-list"
        onWheel={handleTranscriptManualNavigation}
        onTouchStart={handleTranscriptManualNavigation}
        onMouseDown={handleTranscriptManualNavigation}
      >
        {filteredEntries.map((entry, index) => {
          const { segment, speech, speaker, chapter } = entry;
          const isActive = segment.id === activeSegmentId;

          const previousEntry = filteredEntries[index - 1] ?? null;
          const showChapterBoundary =
            !previousEntry ||
            previousEntry.chapter?.id !== chapter?.id;

          const previousSpeakerId = previousEntry?.speech?.speaker_id ?? null;
          const currentSpeakerId = speech?.speaker_id ?? null;
          const showSpeakerTakeover =
            Boolean(previousEntry) &&
            Boolean(currentSpeakerId) &&
            previousSpeakerId !== currentSpeakerId;

          return (
            <div key={segment.id} className="transcript-entry-block">
              {showChapterBoundary && chapter ? (
                <div className="transcript-chapter-boundary">
                  <div className="transcript-chapter-kicker">
                    Bod {chapter.number ?? '—'} · {chapter.absolute_start_time}
                  </div>
                  <div className="transcript-chapter-title">{chapter.title}</div>
                </div>
              ) : null}

              {showSpeakerTakeover ? (
                <div className="transcript-speaker-takeover">
                  <span className="transcript-speaker-takeover-label">
                    Slovo přebírá
                  </span>
                  <span className="transcript-speaker-takeover-name">
                    {speaker?.display_name ?? speaker?.name ?? speech?.speaker_name_raw ?? 'Neuvedeno'}
                  </span>
                  {speaker?.role ? (
                    <span className="transcript-speaker-takeover-role">
                      {speaker.role}
                    </span>
                  ) : null}
                </div>
              ) : null}

              <button
                ref={isActive ? activeRowRef : undefined}
                type="button"
                className={[
                  'transcript-row',
                  isActive ? 'transcript-row-active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => {
                  setIsAutoFollowEnabled(true);
                  onSeekToVideoTime(segment.start_video_seconds);
                }}
              >
                <div className="transcript-row-meta">
                  <span className="transcript-row-speaker">
                    {speaker?.display_name ?? speaker?.name ?? speech?.speaker_name_raw ?? 'Neuvedeno'}
                  </span>
                  <span>{speaker?.role ?? 'neuvedeno'}</span>
                  <span>
                    {formatSessionClock(
                      sessionStartTime,
                      segment.start_video_seconds,
                      videoAnchorOffsetSeconds,
                    )}
                  </span>
                  <span>video {formatDuration(segment.start_video_seconds)}</span>
                  {speech?.speech_type ? <span>{speech.speech_type}</span> : null}
                </div>

                <div className="transcript-row-text">
                  {renderHighlightedText(segment.text, query)}
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}