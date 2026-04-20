interface ContentViewToggleProps {
  currentView: 'chapters' | 'transcript' | 'summary';
  onChange: (view: 'chapters' | 'transcript' | 'summary') => void;
}

export default function ContentViewToggle({
  currentView,
  onChange,
}: ContentViewToggleProps) {
  return (
    <div className="content-view-toggle">
      <button
        type="button"
        className={[
          'content-view-button',
          currentView === 'chapters' ? 'content-view-button-active' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={() => onChange('chapters')}
      >
        Kapitoly
      </button>

      <button
        type="button"
        className={[
          'content-view-button',
          currentView === 'transcript' ? 'content-view-button-active' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={() => onChange('transcript')}
      >
        Přepis
      </button>

      <button
        type="button"
        className={[
          'content-view-button',
          currentView === 'summary' ? 'content-view-button-active' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={() => onChange('summary')}
      >
        Souhrn
      </button>
    </div>
  );
}