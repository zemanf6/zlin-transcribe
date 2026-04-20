export function parseClockToSeconds(clock: string): number {
  const [hours, minutes, seconds] = clock.split(':').map(Number);
  return (hours * 3600) + (minutes * 60) + seconds;
}

export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return '00:00';
  }

  const rounded = Math.floor(totalSeconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;

  if (hours > 0) {
    return [hours, minutes, seconds]
      .map((value) => value.toString().padStart(2, '0'))
      .join(':');
  }

  return [minutes, seconds]
    .map((value) => value.toString().padStart(2, '0'))
    .join(':');
}

export function formatDurationSecondsLabel(totalSeconds: number): string {
  return `délka ${formatDuration(totalSeconds)}`;
}

export function formatSessionClock(
  startClock: string,
  videoSeconds: number,
  anchorOffsetSeconds = 0,
): string {
  const adjustedVideoSeconds = Math.max(0, Math.floor(videoSeconds - anchorOffsetSeconds));
  const sessionSeconds = parseClockToSeconds(startClock) + adjustedVideoSeconds;

  const hours = Math.floor(sessionSeconds / 3600) % 24;
  const minutes = Math.floor((sessionSeconds % 3600) / 60);
  const seconds = sessionSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => value.toString().padStart(2, '0'))
    .join(':');
}