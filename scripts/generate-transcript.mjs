import { spawn } from 'node:child_process';
import { access, mkdir, readFile, readdir, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const DEFAULT_MODEL = 'turbo';
const DEFAULT_LANGUAGE = 'Czech';
const DEFAULT_AUDIO_FILTER = 'pan=mono|c0=c0';

function printUsageAndExit() {
  console.error(`
Použití:
  npm run generate:transcript -- zlin-zm-2026-05-14

Volitelné:
  --video "data/sessions/zlin-zm-2026-05-14/video/input.mp4"
  --video-url "https://example.com/video.mp4"
  --model turbo
  --language Czech
  --audio-filter "pan=mono|c0=c0"
  --keep-audio

Výchozí chování:
  - hledá lokální video v data/sessions/<sessionId>/video/input.mp4
  - používá Whisper model turbo
  - bere levý audio kanál: pan=mono|c0=c0
  - nepřičítá žádný časový offset
`);
  process.exit(1);
}

function parseCliArgs(argv) {
  const [sessionId, ...rest] = argv;

  if (!sessionId || sessionId.startsWith('--')) {
    printUsageAndExit();
  }

  const options = new Map();

  for (let index = 0; index < rest.length; index += 1) {
    const current = rest[index];

    if (!current.startsWith('--')) {
      continue;
    }

    const [rawKey, inlineValue] = current.split('=', 2);
    const key = rawKey.slice(2);

    if (inlineValue != null) {
      options.set(key, inlineValue);
      continue;
    }

    const next = rest[index + 1];

    if (!next || next.startsWith('--')) {
      options.set(key, 'true');
      continue;
    }

    options.set(key, next);
    index += 1;
  }

  return { sessionId, options };
}

function getOption(options, key) {
  const value = options.get(key);

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isUrl(value) {
  return /^https?:\/\//i.test(value);
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findFirstExistingFile(paths) {
  for (const candidate of paths) {
    if (await exists(candidate)) {
      return candidate;
    }
  }

  return null;
}

async function findFirstMp4InDirectory(directoryPath) {
  if (!(await exists(directoryPath))) {
    return null;
  }

  const entries = await readdir(directoryPath, { withFileTypes: true });

  const mp4File = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .find((name) => name.toLowerCase().endsWith('.mp4'));

  return mp4File ? path.join(directoryPath, mp4File) : null;
}

async function resolveInputVideo(sessionRoot, options) {
  const videoFromUrl = getOption(options, 'video-url');

  if (videoFromUrl) {
    return videoFromUrl;
  }

  const videoFromCli = getOption(options, 'video');

  if (videoFromCli) {
    return path.isAbsolute(videoFromCli)
      ? videoFromCli
      : path.join(projectRoot, videoFromCli);
  }

  const videoDir = path.join(sessionRoot, 'video');

  const candidates = [
    path.join(videoDir, 'input.mp4'),
    path.join(sessionRoot, 'input.mp4'),
    path.join(sessionRoot, 'raw', 'input.mp4'),
  ];

  const existingCandidate = await findFirstExistingFile(candidates);

  if (existingCandidate) {
    return existingCandidate;
  }

  const firstMp4 = await findFirstMp4InDirectory(videoDir);

  if (firstMp4) {
    return firstMp4;
  }

  throw new Error(
    [
      'Nenalezeno vstupní video.',
      'Očekávám například:',
      `- ${path.relative(projectRoot, path.join(videoDir, 'input.mp4'))}`,
      '',
      'Nebo zadej cestu ručně:',
      'npm run generate:transcript -- zlin-zm-2026-05-14 --video "data/sessions/zlin-zm-2026-05-14/video/moje-video.mp4"',
      '',
      'Případně veřejnou URL:',
      'npm run generate:transcript -- zlin-zm-2026-05-14 --video-url "https://example.com/video.mp4"',
    ].join('\n'),
  );
}

function quoteForLog(value) {
  if (/^[a-zA-Z0-9_./:=|%-]+$/.test(value)) {
    return value;
  }

  return `"${value}"`;
}

function logCommand(command, args) {
  console.log('');
  console.log('Spouštím příkaz:');
  console.log([command, ...args].map(quoteForLog).join(' '));
  console.log('');
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    logCommand(command, args);

    const child = spawn(command, args, {
      cwd: options.cwd ?? projectRoot,
      stdio: 'inherit',
      shell: false,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
      },
    });

    child.on('error', (error) => {
      reject(
        new Error(
          `Nepodařilo se spustit příkaz "${command}". Detail: ${error.message}`,
        ),
      );
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Příkaz "${command}" skončil s kódem ${code}.`));
    });
  });
}

async function runWhisper(args) {
  const candidates = process.platform === 'win32'
    ? [
        { command: 'whisper', argsPrefix: [] },
        { command: 'py', argsPrefix: ['-3', '-m', 'whisper'] },
        { command: 'python', argsPrefix: ['-m', 'whisper'] },
      ]
    : [
        { command: 'whisper', argsPrefix: [] },
        { command: 'python3', argsPrefix: ['-m', 'whisper'] },
        { command: 'python', argsPrefix: ['-m', 'whisper'] },
      ];

  let lastError = null;

  for (const candidate of candidates) {
    try {
      await runCommand(candidate.command, [...candidate.argsPrefix, ...args]);
      return;
    } catch (error) {
      lastError = error;

      const message = error instanceof Error ? error.message : String(error);

      if (
        message.includes('ENOENT') ||
        message.includes('Nepodařilo se spustit')
      ) {
        continue;
      }

      throw error;
    }
  }

  throw lastError ?? new Error('Nepodařilo se spustit Whisper.');
}

function getFileStem(filePath) {
  return path.basename(filePath, path.extname(filePath));
}

async function findRequiredWhisperOutput(rawDir, audioPath, extension) {
  const audioStem = getFileStem(audioPath);

  const candidates = [
    path.join(rawDir, `${audioStem}.${extension}`),
    path.join(rawDir, `whisper.${extension}`),
  ];

  const existing = await findFirstExistingFile(candidates);

  if (existing) {
    return existing;
  }

  const entries = await readdir(rawDir, { withFileTypes: true });
  const match = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .find((name) => name.toLowerCase().endsWith(`.${extension}`));

  if (match) {
    return path.join(rawDir, match);
  }

  throw new Error(
    `Whisper nevygeneroval soubor .${extension} v ${path.relative(projectRoot, rawDir)}.`,
  );
}

function normalizeTranscriptSegments(whisperPayload) {
  const rawSegments = Array.isArray(whisperPayload.segments)
    ? whisperPayload.segments
    : [];

  return rawSegments.map((segment, index) => ({
    id: `segment-${segment.id ?? index}`,
    start_video_seconds: Number(segment.start ?? 0),
    end_video_seconds: Number(segment.end ?? 0),
    text: String(segment.text ?? '').trim(),
  }));
}

async function writePublicTranscriptJson({
  whisperJsonPath,
  publicTranscriptPath,
}) {
  const whisperPayload = JSON.parse(await readFile(whisperJsonPath, 'utf8'));
  const segments = normalizeTranscriptSegments(whisperPayload);

  const transcriptPayload = {
    schema_version: '1.0',
    source: 'whisper',
    offset_seconds_applied: 0,
    segments,
  };

  await writeFile(
    publicTranscriptPath,
    `${JSON.stringify(transcriptPayload, null, 2)}\n`,
    'utf8',
  );

  return segments.length;
}

async function updateSessionMetadata({
  metadataPath,
  sessionId,
}) {
  if (!(await exists(metadataPath))) {
    console.warn('');
    console.warn(
      `Varování: ${path.relative(projectRoot, metadataPath)} neexistuje, metadata tedy nebyla aktualizována.`,
    );
    return false;
  }

  const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
  const publicSessionPath = `data/sessions/${sessionId}`;

  metadata.session.transcript_url = `${publicSessionPath}/transcript.json`;
  metadata.session.subtitles_url = `${publicSessionPath}/subtitles-video.vtt`;

  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
  return true;
}

async function main() {
  const { sessionId, options } = parseCliArgs(process.argv.slice(2));

  const sessionRoot = path.join(projectRoot, 'data', 'sessions', sessionId);
  const rawDir = path.join(sessionRoot, 'raw');
  const publicSessionDir = path.join(projectRoot, 'public', 'data', 'sessions', sessionId);
  const metadataPath = path.join(publicSessionDir, 'session-metadata.json');

  const model = getOption(options, 'model') ?? DEFAULT_MODEL;
  const language = getOption(options, 'language') ?? DEFAULT_LANGUAGE;
  const audioFilter = getOption(options, 'audio-filter') ?? DEFAULT_AUDIO_FILTER;

  const inputVideo = await resolveInputVideo(sessionRoot, options);

  const audioOutputPath = path.join(rawDir, 'audio-left-mono.flac');
  const publicTranscriptPath = path.join(publicSessionDir, 'transcript.json');
  const publicSubtitlesPath = path.join(publicSessionDir, 'subtitles-video.vtt');

  await mkdir(rawDir, { recursive: true });
  await mkdir(publicSessionDir, { recursive: true });

  console.log('');
  console.log('======================================');
  console.log('Generování přepisu zasedání');
  console.log('======================================');
  console.log(`Session: ${sessionId}`);
  console.log(`Video: ${inputVideo}`);
  console.log(`Model: ${model}`);
  console.log(`Jazyk: ${language}`);
  console.log(`Audio filtr: ${audioFilter}`);
  console.log(`Raw výstupy: ${path.relative(projectRoot, rawDir)}`);
  console.log(`Public výstupy: ${path.relative(projectRoot, publicSessionDir)}`);
  console.log('Časový posun transcriptu: 0 s');
  console.log('Poznámka: video_anchor_offset_seconds se ladí až v session-metadata.json.');
  console.log('======================================');

  await runCommand('ffmpeg', [
    '-y',
    '-loglevel',
    'info',
    '-i',
    inputVideo,
    '-vn',
    '-map',
    '0:a:0',
    '-af',
    audioFilter,
    '-ar',
    '16000',
    '-c:a',
    'flac',
    audioOutputPath,
  ]);

  await runWhisper([
    audioOutputPath,
    '--model',
    model,
    '--language',
    language,
    '--task',
    'transcribe',
    '--output_format',
    'all',
    '--output_dir',
    rawDir,
    '--verbose',
    'True',
  ]);

  const whisperJsonPath = await findRequiredWhisperOutput(rawDir, audioOutputPath, 'json');
  const whisperVttPath = await findRequiredWhisperOutput(rawDir, audioOutputPath, 'vtt');

  const segmentCount = await writePublicTranscriptJson({
    whisperJsonPath,
    publicTranscriptPath,
  });

  await copyFile(whisperVttPath, publicSubtitlesPath);

  const metadataUpdated = await updateSessionMetadata({
    metadataPath,
    sessionId,
  });

  console.log('');
  console.log('======================================');
  console.log('Hotovo');
  console.log('======================================');
  console.log(`Whisper JSON: ${path.relative(projectRoot, whisperJsonPath)}`);
  console.log(`Whisper VTT: ${path.relative(projectRoot, whisperVttPath)}`);
  console.log(`Public transcript: ${path.relative(projectRoot, publicTranscriptPath)}`);
  console.log(`Public titulky: ${path.relative(projectRoot, publicSubtitlesPath)}`);
  console.log(`Počet segmentů: ${segmentCount}`);
  console.log(
    metadataUpdated
      ? `Metadata aktualizována: ${path.relative(projectRoot, metadataPath)}`
      : 'Metadata nebyla aktualizována.',
  );
  console.log('======================================');
}

main().catch((error) => {
  console.error('');
  console.error('======================================');
  console.error('Chyba při generování transcriptu');
  console.error('======================================');
  console.error(error instanceof Error ? error.message : error);
  console.error('======================================');
  process.exit(1);
});