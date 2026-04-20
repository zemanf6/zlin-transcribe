import { forwardRef, useState } from 'react';

interface VideoPlayerProps {
  sourceUrl: string;
  subtitleUrl?: string | null;
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
  onPlayingChange: (isPlaying: boolean) => void;
}

const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(function VideoPlayer(
  { sourceUrl, subtitleUrl, onTimeUpdate, onDurationChange, onPlayingChange },
  ref,
) {
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);

  function togglePlayPause(video: HTMLVideoElement): void {
    if (video.paused) {
      void video.play();
      return;
    }

    video.pause();
  }

  return (
    <div className="video-wrapper">
      <video
        ref={ref}
        className="video-element"
        preload="auto"
        src={sourceUrl}
        onClick={(event) => togglePlayPause(event.currentTarget)}
        onTimeUpdate={(event) => onTimeUpdate(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => onDurationChange(event.currentTarget.duration)}
        onDurationChange={(event) => onDurationChange(event.currentTarget.duration)}
        onPlay={() => {
          onPlayingChange(true);
          setIsBuffering(false);
        }}
        onPause={() => onPlayingChange(false)}
        onLoadStart={() => {
          setIsLoading(true);
          setIsBuffering(true);
        }}
        onLoadedData={() => {
          setIsLoading(false);
          setIsBuffering(false);
        }}
        onCanPlay={() => {
          setIsLoading(false);
          setIsBuffering(false);
        }}
        onCanPlayThrough={() => {
          setIsLoading(false);
          setIsBuffering(false);
        }}
        onWaiting={() => {
          setIsLoading(false);
          setIsBuffering(true);
        }}
        onStalled={() => {
          setIsLoading(false);
          setIsBuffering(true);
        }}
        controls={false}
      >
        {subtitleUrl ? (
          <track
            kind="subtitles"
            src={subtitleUrl}
            srcLang="cs"
            label="Čeština"
            default
          />
        ) : null}
      </video>

      {(isLoading || isBuffering) && (
        <div className="video-overlay">
          <div className="video-overlay-badge">
            {isLoading ? 'Načítám video…' : 'Načítám další část videa…'}
          </div>
        </div>
      )}
    </div>
  );
});

export default VideoPlayer;