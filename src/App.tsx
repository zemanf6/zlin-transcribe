import { useEffect, useMemo, useState } from 'react';
import VideoPlayer from './components/VideoPlayer';
import PlayerControls from './components/PlayerControls';
import NowPlayingBar from './components/NowPlayingBar';
import ChapterSidebar from './components/ChapterSidebar';
import ChapterDetailPanel from './components/ChapterDetailPanel';
import ContentViewToggle from './components/ContentViewToggle';
import TranscriptPanel from './components/TranscriptPanel';
import { useSessionData } from './hooks/useSessionData';
import { useTranscriptData } from './hooks/useTranscriptData';
import { useVideoSync } from './hooks/useVideoSync';
import SummaryPanel from './components/SummaryPanel';
import { useSummaryData } from './hooks/useSummaryData';
import {
  buildSpeakerMap,
  findActiveChapter,
  findActiveSpeech,
  findActiveTranscriptSegment,
  flattenSpeeches,
} from './utils/session';
import ScrollToTopButton from './components/ScrollToTopButton';

export default function App() {
  const { data, isLoading, error } = useSessionData();
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
  const [contentView, setContentView] = useState<'chapters' | 'transcript' | 'summary'>('chapters');

  function handleSeekFromTranscript(videoSeconds: number): void {
  seekTo(videoSeconds);

  const nextSessionTime = Math.max(0, videoSeconds - videoAnchorOffsetSeconds);
  const nextChapter = findActiveChapter(chapters, nextSessionTime);

  if (nextChapter) {
    setSelectedChapterId(nextChapter.id);
  }
 }

function handleChangeContentView(nextView: 'chapters' | 'transcript' | 'summary'): void {
  if (nextView === 'chapters' && activeChapter?.id) {
    setSelectedChapterId(activeChapter.id);
  }

  setContentView(nextView);
 }

  useEffect(() => {
    if (!selectedChapterId && chapters.length > 0) {
      setSelectedChapterId(chapters[0].id);
    }
  }, [chapters, selectedChapterId]);

  const selectedChapter =
    chapters.find((chapter) => chapter.id === selectedChapterId) ?? null;

  const visibleChapter = selectedChapter ?? activeChapter ?? chapters[0] ?? null;

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