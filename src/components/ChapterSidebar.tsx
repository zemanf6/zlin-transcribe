import type { Chapter } from '../types/session';

interface ChapterSidebarProps {
  chapters: Chapter[];
  activeChapterId: string | null;
  selectedChapterId: string | null;
  onSelectChapter: (chapterId: string) => void;
}

export default function ChapterSidebar({
  chapters,
  activeChapterId,
  selectedChapterId,
  onSelectChapter,
}: ChapterSidebarProps) {
  return (
    <aside className="chapter-sidebar">
      <div className="sidebar-header">
        <h2>Kapitoly</h2>
        <p>Navigace po bodech jednání</p>
      </div>

      <div className="chapter-nav-list">
        {chapters.map((chapter) => {
          const isActive = chapter.id === activeChapterId;
          const isSelected = chapter.id === selectedChapterId;

          return (
            <button
              key={chapter.id}
              type="button"
              className={[
                'chapter-nav-item',
                isActive ? 'chapter-nav-item-active' : '',
                isSelected ? 'chapter-nav-item-selected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onSelectChapter(chapter.id)}
              title={chapter.title}
            >
              <div className="chapter-nav-top">
                <span className="chapter-nav-number">{chapter.number ?? '—'}</span>
                <span className="chapter-nav-time">{chapter.absolute_start_time}</span>
              </div>

              <div className="chapter-nav-title">{chapter.title}</div>

              <div className="chapter-nav-meta">
                {chapter.speeches.length} vystoupení
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}