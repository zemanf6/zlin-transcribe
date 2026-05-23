import { spawnSync } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const DEFAULT_CITY = 'Zlín';
const DEFAULT_TITLE = 'Zasedání Zastupitelstva města Zlín';
const DEFAULT_TIMEZONE = 'Europe/Prague';

function printUsageAndExit() {
  console.error(`
Použití:
  npm run generate:session -- zlin-zm-2026-05-14 --video-url "https://example.com/video.mp4"

Volitelné:
  --offset 470
  --title "Zasedání Zastupitelstva města Zlín"
  --city "Zlín"
  --timezone "Europe/Prague"

Příklad:
  npm run generate:session -- zlin-zm-2026-05-14 --video-url "https://bitest.videostream.sk/zlin/archiv/20260514/video/Fin%C3%A1ln%C3%AD%2014.5.2026.mp4"
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

  return {
    sessionId,
    options,
  };
}

function getOption(options, key) {
  const value = options.get(key);

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function inferDateFromSessionId(sessionId) {
  const match = sessionId.match(/(\d{4}-\d{2}-\d{2})$/);

  if (!match) {
    throw new Error(
      `Ze session id "${sessionId}" se nepodařilo odvodit datum. Očekávám tvar např. zlin-zm-2026-05-14.`,
    );
  }

  return match[1];
}

function formatCzechDateLabel(dateValue) {
  const date = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return new Intl.DateTimeFormat('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).format(date);
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonIfExists(filePath) {
  if (!(await exists(filePath))) {
    return null;
  }

  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function findFirstExistingPath(paths, errorMessage) {
  for (const item of paths) {
    if (await exists(item)) {
      return item;
    }
  }

  throw new Error(errorMessage);
}

async function resolvePythonParserPath() {
  const candidates = [
    path.join(projectRoot, 'scripts', 'generate-session-metadata.py'),
    path.join(projectRoot, 'scripts', 'parse_council_transcript.py'),
  ];

  return findFirstExistingPath(
    candidates,
    [
      'Nenalezen Python parser.',
      'Očekávám jeden z těchto souborů:',
      ...candidates.map((candidate) => `- ${candidate}`),
    ].join('\n'),
  );
}

function runPythonScript(scriptPath, args) {
  const candidates = process.platform === 'win32'
    ? [
        { command: 'py', argsPrefix: ['-3'] },
        { command: 'python', argsPrefix: [] },
        { command: 'python3', argsPrefix: [] },
      ]
    : [
        { command: 'python3', argsPrefix: [] },
        { command: 'python', argsPrefix: [] },
      ];

  for (const candidate of candidates) {
    const result = spawnSync(
      candidate.command,
      [...candidate.argsPrefix, scriptPath, ...args],
      {
        cwd: projectRoot,
        stdio: 'inherit',
        shell: false,
      },
    );

    if (result.error?.code === 'ENOENT') {
      continue;
    }

    if (result.status === 0) {
      return;
    }

    process.exit(result.status ?? 1);
  }

  throw new Error('Nepodařilo se spustit Python. Zkontroluj instalaci Pythonu.');
}

async function updateMetadataPublicUrls({
  metadataPath,
  sessionId,
  sessionConfig,
}) {
  const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
  const publicSessionPath = `data/sessions/${sessionId}`;
  const publicSessionDir = path.join(projectRoot, 'public', 'data', 'sessions', sessionId);

  const transcriptPath = path.join(publicSessionDir, 'transcript.json');
  const subtitlesPath = path.join(publicSessionDir, 'subtitles-video.vtt');
  const summaryPath = path.join(publicSessionDir, 'summary.json');

  metadata.session.video_url = sessionConfig.video_url;
  metadata.session.video_anchor_offset_seconds = sessionConfig.video_anchor_offset_seconds;

  metadata.session.transcript_url = await exists(transcriptPath)
    ? `${publicSessionPath}/transcript.json`
    : null;

  metadata.session.subtitles_url = await exists(subtitlesPath)
    ? `${publicSessionPath}/subtitles-video.vtt`
    : null;

  metadata.session.summary_url = await exists(summaryPath)
    ? `${publicSessionPath}/summary.json`
    : null;

  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
}

async function updateSessionsIndex({
  sessionId,
  sessionConfig,
}) {
  const indexPath = path.join(projectRoot, 'public', 'data', 'sessions.json');
  const existing = await readJsonIfExists(indexPath);
  const sessions = Array.isArray(existing) ? existing : [];

  const publicSessionPath = `data/sessions/${sessionId}`;

  const nextItem = {
    id: sessionId,
    city: sessionConfig.city,
    title: sessionConfig.title,
    date: sessionConfig.date,
    label: sessionConfig.label ?? formatCzechDateLabel(sessionConfig.date),
    metadata_url: `${publicSessionPath}/session-metadata.json`,
  };

  const nextSessions = [
    ...sessions.filter((session) => session.id !== sessionId),
    nextItem,
  ].sort((left, right) => right.date.localeCompare(left.date));

  await mkdir(path.dirname(indexPath), { recursive: true });
  await writeFile(indexPath, `${JSON.stringify(nextSessions, null, 2)}\n`, 'utf8');
}

async function main() {
  const { sessionId, options } = parseCliArgs(process.argv.slice(2));

  const sessionRoot = path.join(projectRoot, 'data', 'sessions', sessionId);
  const sourceDir = path.join(sessionRoot, 'source');
  const publicSessionDir = path.join(projectRoot, 'public', 'data', 'sessions', sessionId);

  const configPath = path.join(sourceDir, 'session.json');
  const optionalConfig = await readJsonIfExists(configPath);

  const inferredDate = inferDateFromSessionId(sessionId);

  const videoUrl = getOption(options, 'video-url') ?? optionalConfig?.video_url;

  if (!videoUrl) {
    throw new Error(
      'Chybí --video-url. Metadata pro stránku potřebují veřejnou URL videa.',
    );
  }

  const offsetValue =
    getOption(options, 'offset') ??
    getOption(options, 'video-anchor-offset-seconds') ??
    optionalConfig?.video_anchor_offset_seconds ??
    0;

  const videoAnchorOffsetSeconds = Number(offsetValue);

  if (!Number.isFinite(videoAnchorOffsetSeconds) || videoAnchorOffsetSeconds < 0) {
    throw new Error(`Neplatný offset: ${offsetValue}`);
  }

  const sessionConfig = {
    id: sessionId,
    city: getOption(options, 'city') ?? optionalConfig?.city ?? DEFAULT_CITY,
    title: getOption(options, 'title') ?? optionalConfig?.title ?? DEFAULT_TITLE,
    date: getOption(options, 'date') ?? optionalConfig?.date ?? inferredDate,
    timezone: getOption(options, 'timezone') ?? optionalConfig?.timezone ?? DEFAULT_TIMEZONE,
    label: getOption(options, 'label') ?? optionalConfig?.label ?? null,
    video_url: videoUrl,
    video_anchor_offset_seconds: videoAnchorOffsetSeconds,
  };

  const agendaTranscriptPath = await findFirstExistingPath(
    [
      path.join(sourceDir, 'agenda-transcript.txt'),
      path.join(sourceDir, 'agenta-transcript.txt'),
    ],
    `Nenalezen agenda transcript. Očekávám ${path.join(sourceDir, 'agenda-transcript.txt')}`,
  );

  const boardMembersPath = await findFirstExistingPath(
    [path.join(sourceDir, 'board-members.txt')],
    `Nenalezen soubor ${path.join(sourceDir, 'board-members.txt')}`,
  );

  const councilMembersPath = await findFirstExistingPath(
    [path.join(sourceDir, 'council-members.txt')],
    `Nenalezen soubor ${path.join(sourceDir, 'council-members.txt')}`,
  );

  const parserPath = await resolvePythonParserPath();
  const metadataOutputPath = path.join(publicSessionDir, 'session-metadata.json');

  await mkdir(publicSessionDir, { recursive: true });

  runPythonScript(parserPath, [
    '--transcript',
    agendaTranscriptPath,
    '--council-members',
    councilMembersPath,
    '--board-members',
    boardMembersPath,
    '--output',
    metadataOutputPath,
    '--session-id',
    sessionConfig.id,
    '--city',
    sessionConfig.city,
    '--title',
    sessionConfig.title,
    '--date',
    sessionConfig.date,
    '--video-url',
    sessionConfig.video_url,
    '--video-anchor-offset-seconds',
    String(sessionConfig.video_anchor_offset_seconds),
    '--timezone',
    sessionConfig.timezone,
  ]);

  await updateMetadataPublicUrls({
    metadataPath: metadataOutputPath,
    sessionId,
    sessionConfig,
  });

  await updateSessionsIndex({
    sessionId,
    sessionConfig,
  });

  console.log('');
  console.log(`Hotovo: ${path.relative(projectRoot, metadataOutputPath)}`);
  console.log(
    `Aktualizováno: ${path.relative(projectRoot, path.join(projectRoot, 'public', 'data', 'sessions.json'))}`,
  );
  console.log(`Video URL: ${sessionConfig.video_url}`);
  console.log(`Offset: ${sessionConfig.video_anchor_offset_seconds}s`);
}

main().catch((error) => {
  console.error('');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});