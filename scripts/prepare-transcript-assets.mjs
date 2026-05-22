import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const metadataPath = path.join(projectRoot, 'public', 'data', 'session-metadata.json');
const rawJsonPath = path.join(projectRoot, 'tools', 'raw', 'whisper-session.json');
const rawVttPath = path.join(projectRoot, 'tools', 'raw', 'whisper-session.vtt');

const outputDir = path.join(projectRoot, 'public', 'data');
const transcriptOutputPath = path.join(outputDir, 'transcript.json');
const subtitlesOutputPath = path.join(outputDir, 'subtitles-video.vtt');

function parseVttTimestamp(value) {
  const match = value.match(/(?:(\d{2}):)?(\d{2}):(\d{2})\.(\d{3})/);

  if (!match) {
    throw new Error(`Invalid VTT timestamp: ${value}`);
  }

  const [, hh = '00', mm, ss, ms] = match;

  return (
    Number(hh) * 3600 +
    Number(mm) * 60 +
    Number(ss) +
    Number(ms) / 1000
  );
}

function formatVttTimestamp(totalSeconds) {
  const safe = Math.max(0, totalSeconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = Math.floor(safe % 60);
  const milliseconds = Math.round((safe - Math.floor(safe)) * 1000);

  return (
    [
      String(hours).padStart(2, '0'),
      String(minutes).padStart(2, '0'),
      String(seconds).padStart(2, '0'),
    ].join(':') + '.' + String(milliseconds).padStart(3, '0')
  );
}

function shiftWebVtt(vtt, offsetSeconds) {
  return vtt.replace(
    /((?:\d{2}:)?\d{2}:\d{2}\.\d{3}) --> ((?:\d{2}:)?\d{2}:\d{2}\.\d{3})/g,
    (_, start, end) => {
      const shiftedStart = formatVttTimestamp(parseVttTimestamp(start) + offsetSeconds);
      const shiftedEnd = formatVttTimestamp(parseVttTimestamp(end) + offsetSeconds);

      return `${shiftedStart} --> ${shiftedEnd}`;
    },
  );
}

function normalizeTranscriptSegments(whisperPayload, offsetSeconds) {
  const rawSegments = Array.isArray(whisperPayload.segments) ? whisperPayload.segments : [];

  return rawSegments.map((segment, index) => ({
    id: `segment-${segment.id ?? index}`,
    start_video_seconds: Number(segment.start ?? 0) + offsetSeconds,
    end_video_seconds: Number(segment.end ?? 0) + offsetSeconds,
    text: String(segment.text ?? '').trim(),
  }));
}

async function main() {
  const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
  const whisperJson = JSON.parse(await readFile(rawJsonPath, 'utf8'));
  const whisperVtt = await readFile(rawVttPath, 'utf8');

  const offsetSeconds = Number(metadata?.session?.video_anchor_offset_seconds ?? 0);

  const transcriptPayload = {
    schema_version: '1.0',
    source: 'whisper',
    offset_seconds_applied: offsetSeconds,
    segments: normalizeTranscriptSegments(whisperJson, offsetSeconds),
  };

  const shiftedVtt = shiftWebVtt(whisperVtt, offsetSeconds);

  await mkdir(outputDir, { recursive: true });
  await writeFile(transcriptOutputPath, JSON.stringify(transcriptPayload, null, 2), 'utf8');
  await writeFile(subtitlesOutputPath, shiftedVtt, 'utf8');

  console.log(`Transcript written to ${transcriptOutputPath}`);
  console.log(`Shifted subtitles written to ${subtitlesOutputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});