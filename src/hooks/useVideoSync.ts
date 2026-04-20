import { useRef, useState } from 'react';

interface UseVideoSyncResult {
  videoRef: React.RefObject<HTMLVideoElement>;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  togglePlay: () => void;
  seekTo: (seconds: number) => void;
  skipBy: (deltaSeconds: number) => void;
  handleTimeUpdate: (time: number) => void;
  handleDurationChange: (duration: number) => void;
  handlePlayingChange: (isPlaying: boolean) => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function useVideoSync(): UseVideoSyncResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  function togglePlay(): void {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    if (video.paused) {
      void video.play();
      return;
    }

    video.pause();
  }

  function seekTo(seconds: number): void {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const safeDuration = Number.isFinite(video.duration) ? video.duration : Number.MAX_SAFE_INTEGER;
    const nextTime = clamp(seconds, 0, safeDuration);

    video.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  function skipBy(deltaSeconds: number): void {
    seekTo(currentTime + deltaSeconds);
  }

  return {
    videoRef,
    currentTime,
    duration,
    isPlaying,
    togglePlay,
    seekTo,
    skipBy,
    handleTimeUpdate: setCurrentTime,
    handleDurationChange: setDuration,
    handlePlayingChange: setIsPlaying,
  };
}