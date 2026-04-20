import { useEffect, useState } from 'react';

export default function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    function handleScroll(): void {
      setIsVisible(window.scrollY > 1);
    }

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  function handleScrollToTop(): void {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  if (!isVisible) {
    return null;
  }

  return (
    <button
      type="button"
      className="scroll-top-button"
      onClick={handleScrollToTop}
      aria-label="Přejít nahoru"
      title="Nahoru"
    >
      ↑
    </button>
  );
}