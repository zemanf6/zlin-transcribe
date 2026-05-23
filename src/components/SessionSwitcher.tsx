import type { SessionIndexItem } from '../types/session';

interface SessionSwitcherProps {
  sessions: SessionIndexItem[];
  selectedSessionId: string | null;
  onChange: (sessionId: string) => void;
}

function formatDateLabel(session: SessionIndexItem): string {
  if (session.label) {
    return session.label;
  }

  const date = new Date(`${session.date}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return session.date;
  }

  return new Intl.DateTimeFormat('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).format(date);
}

export default function SessionSwitcher({
  sessions,
  selectedSessionId,
  onChange,
}: SessionSwitcherProps) {
  if (sessions.length === 0) {
    return null;
  }

  return (
    <div className="session-switcher">
      <label className="session-switcher-label" htmlFor="session-switcher-select">
        Zasedání
      </label>

      <select
        id="session-switcher-select"
        className="session-switcher-select"
        value={selectedSessionId ?? ''}
        onChange={(event) => onChange(event.target.value)}
      >
        {sessions.map((session) => (
          <option key={session.id} value={session.id}>
            {formatDateLabel(session)}
          </option>
        ))}
      </select>
    </div>
  );
}