import type { Chapter, Speaker, Speech, TranscriptSegment } from '../types/session';

export function buildSpeakerMap(speakers: Speaker[]): Record<string, Speaker> {
  return Object.fromEntries(speakers.map((speaker) => [speaker.id, speaker]));
}

export function flattenSpeeches(chapters: Chapter[]): Speech[] {
  return chapters
    .flatMap((chapter) => chapter.speeches)
    .sort((left, right) => left.video_offset_seconds - right.video_offset_seconds);
}

function resolveEndOffset(
  explicitEnd: number | null,
  nextStart: number | null,
): number {
  if (explicitEnd != null && explicitEnd > 0) {
    return explicitEnd;
  }

  if (nextStart != null && nextStart > 0) {
    return nextStart;
  }

  return Number.POSITIVE_INFINITY;
}

export function findActiveChapter(
  chapters: Chapter[],
  sessionCurrentTime: number,
): Chapter | null {
  if (sessionCurrentTime < 0 || chapters.length === 0) {
    return null;
  }

  const sorted = [...chapters].sort(
    (left, right) => left.video_offset_seconds - right.video_offset_seconds,
  );

  for (let index = 0; index < sorted.length; index += 1) {
    const chapter = sorted[index];
    const nextChapter = sorted[index + 1] ?? null;
    const start = chapter.video_offset_seconds;
    const end = resolveEndOffset(chapter.end_offset_seconds, nextChapter?.video_offset_seconds ?? null);

    if (sessionCurrentTime >= start && sessionCurrentTime < end) {
      return chapter;
    }
  }

  return sorted.length > 0 ? sorted[sorted.length - 1] : null;
}

export function findActiveSpeech(
  speeches: Speech[],
  sessionCurrentTime: number,
): Speech | null {
  if (sessionCurrentTime < 0 || speeches.length === 0) {
    return null;
  }

  const sorted = [...speeches].sort(
    (left, right) => left.video_offset_seconds - right.video_offset_seconds,
  );

  for (let index = 0; index < sorted.length; index += 1) {
    const speech = sorted[index];
    const nextSpeech = sorted[index + 1] ?? null;
    const start = speech.video_offset_seconds;
    const end = resolveEndOffset(speech.end_offset_seconds, nextSpeech?.video_offset_seconds ?? null);

    if (sessionCurrentTime >= start && sessionCurrentTime < end) {
      return speech;
    }
  }

  return sorted.length > 0 ? sorted[sorted.length - 1] : null;
}

export function findActiveTranscriptSegment(
  segments: TranscriptSegment[],
  currentVideoTime: number,
): TranscriptSegment | null {
  if (currentVideoTime < 0 || segments.length === 0) {
    return null;
  }

  const sorted = [...segments].sort(
    (left, right) => left.start_video_seconds - right.start_video_seconds,
  );

  for (let index = 0; index < sorted.length; index += 1) {
    const segment = sorted[index];
    const nextSegment = sorted[index + 1] ?? null;
    const start = segment.start_video_seconds;
    const end = segment.end_video_seconds > start
      ? segment.end_video_seconds
      : (nextSegment?.start_video_seconds ?? Number.POSITIVE_INFINITY);

    if (currentVideoTime >= start && currentVideoTime < end) {
      return segment;
    }
  }

  return null;
}