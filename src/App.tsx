import { useEffect, useMemo, useState } from 'react';
import VideoPlayer from './components/VideoPlayer';
import PlayerControls from './components/PlayerControls';
import NowPlayingBar from './components/NowPlayingBar';
import ChapterSidebar from './components/ChapterSidebar';
import ChapterDetailPanel from './components/ChapterDetailPanel';
import ContentViewToggle from './components/ContentViewToggle';
import TranscriptPanel from './components/TranscriptPanel';
import SummaryPanel from './components/SummaryPanel';
import ScrollToTopButton from './components/ScrollToTopButton';
import SessionSwitcher from './components/SessionSwitcher';
import { useSessionIndex } from './hooks/useSessionIndex';
import { useSessionData } from './hooks/useSessionData';
import { useTranscriptData } from './hooks/useTranscriptData';
import { useVideoSync } from './hooks/useVideoSync';
import { useSummaryData } from './hooks/useSummaryData';
import {
  buildSpeakerMap,
  findActiveChapter,
  findActiveSpeech,
  findActiveTranscriptSegment,
  flattenSpeeches,
} from './utils/session';

type ContentView = 'chapters' | 'transcript' | 'summary';

function getInitialSessionId(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('session');
}

function updateSessionUrl(sessionId: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set('session', sessionId);
  window.history.replaceState({}, '', url);
}

export default function App() {
  const {
    data: sessionIndex,
    isLoading: isSessionIndexLoading,
    error: sessionIndexError,
  } = useSessionIndex();

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(() =>
    getInitialSessionId(),
  );

  useEffect(() => {
    if (sessionIndex.length === 0) {
      return;
    }

    const exists = selectedSessionId
      ? sessionIndex.some((session) => session.id === selectedSessionId)
      : false;

    if (!exists) {
      const fallbackSessionId = sessionIndex[0].id;
      setSelectedSessionId(fallbackSessionId);
      updateSessionUrl(fallbackSessionId);
    }
  }, [sessionIndex, selectedSessionId]);

  const selectedSession = useMemo(() => {
    if (!selectedSessionId) {
      return null;
    }

    return sessionIndex.find((session) => session.id === selectedSessionId) ?? null;
  }, [sessionIndex, selectedSessionId]);

  const { data, isLoading, error } = useSessionData(
    selectedSession?.metadata_url ?? null,
  );

  const {
    videoRef,
    currentTime,
    duration,
    isPlaying,
    togglePlay,
    seekTo,
    skipBy,
    handleTimeUpdate,
    handleDurationChange,
    handlePlayingChange,
  } = useVideoSync();

  const {
    data: transcriptData,
    isLoading: isTranscriptLoading,
    error: transcriptError,
  } = useTranscriptData(data?.session.transcript_url ?? null);

  const {
    data: summaryData,
    isLoading: isSummaryLoading,
    error: summaryError,
  } = useSummaryData(data?.session.summary_url ?? null);

  const chapters = data?.chapters ?? [];
  const speakers = data?.speakers ?? [];
  const transcriptSegments = transcriptData?.segments ?? [];

  const speakerMap = useMemo(() => buildSpeakerMap(speakers), [speakers]);

  const videoAnchorOffsetSeconds = data?.session.video_anchor_offset_seconds ?? 0;
  const sessionHasStarted = currentTime >= videoAnchorOffsetSeconds;
  const sessionCurrentTime = sessionHasStarted ? currentTime - videoAnchorOffsetSeconds : -1;

  const allSpeeches = useMemo(() => flattenSpeeches(chapters), [chapters]);

  const activeChapter = useMemo(
    () => findActiveChapter(chapters, sessionCurrentTime),
    [chapters, sessionCurrentTime],
  );

  const activeSpeech = useMemo(
    () => findActiveSpeech(allSpeeches, sessionCurrentTime),
    [allSpeeches, sessionCurrentTime],
  );

  const activeTranscriptSegment = useMemo(
    () => findActiveTranscriptSegment(transcriptSegments, currentTime),
    [transcriptSegments, currentTime],
  );

  const activeSpeaker = activeSpeech ? speakerMap[activeSpeech.speaker_id] ?? null : null;

  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [contentView, setContentView] = useState<ContentView>('chapters');

  useEffect(() => {
    setSelectedChapterId(null);
    seekTo(0);
  }, [data?.session.id]);

  useEffect(() => {
    if (!selectedChapterId && chapters.length > 0) {
      setSelectedChapterId(chapters[0].id);
    }
  }, [chapters, selectedChapterId]);

  const selectedChapter =
    chapters.find((chapter) => chapter.id === selectedChapterId) ?? null;

  const visibleChapter = selectedChapter ?? activeChapter ?? chapters[0] ?? null;

  function handleChangeSession(sessionId: string): void {
    setSelectedSessionId(sessionId);
    updateSessionUrl(sessionId);
    setContentView('chapters');
  }

  function handleSeekFromTranscript(videoSeconds: number): void {
    seekTo(videoSeconds);

    const nextSessionTime = Math.max(0, videoSeconds - videoAnchorOffsetSeconds);
    const nextChapter = findActiveChapter(chapters, nextSessionTime);

    if (nextChapter) {
      setSelectedChapterId(nextChapter.id);
    }
  }

  function handleChangeContentView(nextView: ContentView): void {
    if (nextView === 'chapters' && activeChapter?.id) {
      setSelectedChapterId(activeChapter.id);
    }

    setContentView(nextView);
  }

  function seekToSessionTime(sessionOffsetSeconds: number): void {
    seekTo(sessionOffsetSeconds + videoAnchorOffsetSeconds);
  }

  function handleSelectChapter(chapterId: string): void {
    setSelectedChapterId(chapterId);

    const chapter = chapters.find((item) => item.id === chapterId);
    if (!chapter) {
      return;
    }

    seekToSessionTime(chapter.video_offset_seconds);
  }

  if (isSessionIndexLoading) {
    return <div className="app-status">Načítám seznam zasedání…</div>;
  }

  if (sessionIndexError) {
    return (
      <div className="app-status app-status-error">
        Nepodařilo se načíst seznam zasedání.
      </div>
    );
  }

  if (sessionIndex.length === 0) {
    return (
      <div className="app-status app-status-error">
        Není dostupné žádné zasedání.
      </div>
    );
  }

  if (isLoading) {
    return <div className="app-status">Načítám metadata zasedání…</div>;
  }

  if (error || !data) {
    return (
      <div className="app-status app-status-error">
        Nepodařilo se načíst metadata.
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-top">
          <SessionSwitcher
            sessions={sessionIndex}
            selectedSessionId={selectedSessionId}
            onChange={handleChangeSession}
          />
        </div>

        <p className="eyebrow">{data.session.city}</p>
        <h1>{data.session.title}</h1>
        <p className="header-subtitle">
          {data.session.date} · přehled jednání
        </p>
      </header>

      <main className="dashboard-grid">
        <aside className="media-rail">
          <section className="top-media-card">
            <div className="media-rail-header">
              <h2>Video</h2>
              <p>Pracovní náhled přehrávání</p>
            </div>

            <VideoPlayer
              ref={videoRef}
              sourceUrl={data.session.video_url}
              subtitleUrl={data.session.subtitles_url}
              onTimeUpdate={handleTimeUpdate}
              onDurationChange={handleDurationChange}
              onPlayingChange={handlePlayingChange}
            />
          </section>

          <PlayerControls
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            sessionStartTime={data.session.video_start_time}
            videoAnchorOffsetSeconds={videoAnchorOffsetSeconds}
            onTogglePlay={togglePlay}
            onSeek={seekTo}
            onSkip={skipBy}
            onSeekToSessionStart={() => seekTo(videoAnchorOffsetSeconds)}
          />

          <NowPlayingBar
            hasSessionStarted={sessionHasStarted}
            activeChapter={activeChapter}
            activeSpeech={activeSpeech}
            activeSpeaker={activeSpeaker}
            currentTime={currentTime}
            sessionStartTime={data.session.video_start_time}
            videoAnchorOffsetSeconds={videoAnchorOffsetSeconds}
          />
        </aside>

        <section className="content-column">
          <div className="content-mode-bar">
            <ContentViewToggle
              currentView={contentView}
              onChange={handleChangeContentView}
            />
          </div>

          {contentView === 'chapters' ? (
            <div className="content-grid">
              <ChapterSidebar
                chapters={chapters}
                activeChapterId={activeChapter?.id ?? null}
                selectedChapterId={visibleChapter?.id ?? null}
                onSelectChapter={handleSelectChapter}
              />

              <ChapterDetailPanel
                chapter={visibleChapter}
                activeSpeechId={activeSpeech?.id ?? null}
                speakerMap={speakerMap}
                onSeekToSessionTime={seekToSessionTime}
              />
            </div>
          ) : contentView === 'transcript' ? (
            <TranscriptPanel
              segments={transcriptSegments}
              activeSegmentId={activeTranscriptSegment?.id ?? null}
              isLoading={isTranscriptLoading}
              error={transcriptError}
              chapters={chapters}
              speeches={allSpeeches}
              speakerMap={speakerMap}
              sessionStartTime={data.session.video_start_time}
              sessionTitle={data.session.title}
              sessionDate={data.session.date}
              videoAnchorOffsetSeconds={videoAnchorOffsetSeconds}
              onSeekToVideoTime={handleSeekFromTranscript}
            />
          ) : (
            <SummaryPanel
              data={summaryData}
              isLoading={isSummaryLoading}
              error={summaryError}
              sessionStartTime={data.session.video_start_time}
              videoAnchorOffsetSeconds={videoAnchorOffsetSeconds}
              onSeekToVideoTime={handleSeekFromTranscript}
            />
          )}
        </section>
      </main>

      <ScrollToTopButton />
    </div>
  );
}