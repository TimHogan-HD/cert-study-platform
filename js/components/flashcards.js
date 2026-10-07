/* flashcards.js — flashcard flip, deck navigation, and per-deck position in sessionStorage */

export function initFlashcards(path) {
  /* Individual card flip */
  document.querySelectorAll('.flashcard').forEach(card => {
    card.addEventListener('click', () => card.classList.toggle('flipped'));
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', 'Click to flip card');
  });

  /* Deck navigation */
  document.querySelectorAll('.flashcard-deck').forEach((deck, deckIdx) => {
    const cards = Array.from(deck.querySelectorAll('.flashcard'));
    if (cards.length === 0) return;
    const storageKey = path ? `csp-deck-${path}-${deckIdx}` : null;

    let current = 0;
    if (storageKey) {
      const saved = parseInt(sessionStorage.getItem(storageKey) || '0', 10);
      current = isNaN(saved) ? 0 : Math.min(saved, cards.length - 1);
    }

    const counter = deck.querySelector('.card-counter');
    const progressBar = deck.querySelector('.deck-progress-bar');

    function show(i) {
      cards.forEach((c, idx) => {
        c.style.display = idx === i ? 'block' : 'none';
        c.classList.remove('flipped');
      });
      if (counter) counter.textContent = `${i + 1} / ${cards.length}`;
      if (progressBar) progressBar.style.width = `${((i + 1) / cards.length) * 100}%`;
      if (storageKey) sessionStorage.setItem(storageKey, i);
    }

    /* Per-card keyboard: Space/Enter to flip, ← → to navigate */
    cards.forEach(card => {
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          card.classList.toggle('flipped');
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          current = (current - 1 + cards.length) % cards.length;
          show(current);
          setTimeout(() => cards[current]?.focus(), 10);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          current = (current + 1) % cards.length;
          show(current);
          setTimeout(() => cards[current]?.focus(), 10);
        }
      });
    });

    deck.querySelector('.prev-btn')?.addEventListener('click', () => {
      current = (current - 1 + cards.length) % cards.length;
      show(current);
    });
    deck.querySelector('.next-btn')?.addEventListener('click', () => {
      current = (current + 1) % cards.length;
      show(current);
    });
    deck.querySelector('.shuffle-btn')?.addEventListener('click', () => {
      /* Fisher-Yates shuffle */
      for (let i = cards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cards[i], cards[j]] = [cards[j], cards[i]];
      }
      const parent = cards[0].parentElement;
      cards.forEach(c => parent.appendChild(c));
      current = 0;
      show(0);
    });

    /* Keyboard hint label in the deck-nav bar (desktop only — hidden on mobile via CSS) */
    const deckNav = deck.querySelector('.deck-nav');
    if (deckNav && !deckNav.querySelector('.deck-kbd-hints')) {
      const hints = document.createElement('span');
      hints.className = 'deck-kbd-hints';
      hints.innerHTML = 'Keyboard: <kbd>←</kbd> <kbd>→</kbd> navigate · <kbd>Space</kbd> flip';
      deckNav.appendChild(hints);
    }

    show(current);
  });
}
