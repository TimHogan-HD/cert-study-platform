/* flashcards.js — Flashcard flip + deck navigation + matching game */

export function initFlashcards(path) {
  /* Individual card flip */
  document.querySelectorAll('.flashcard').forEach(card => {
    card.removeEventListener('click', card._flipFn);
    card._flipFn = () => card.classList.toggle('flipped');
    card.addEventListener('click', card._flipFn);
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
      card.removeEventListener('keydown', card._deckKeyFn);
      card._deckKeyFn = e => {
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
      };
      card.addEventListener('keydown', card._deckKeyFn);
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

export function initMatching() {
  document.querySelectorAll('.matching-game').forEach(game => {
    const items = Array.from(game.querySelectorAll('.match-item'));
    const targets = Array.from(game.querySelectorAll('.match-target'));
    let selected = null;
    const scoreEl = game.querySelector('.match-score');

    function updateScore() {
      const matched = items.filter(i => i.classList.contains('matched')).length;
      if (scoreEl) scoreEl.textContent = `${matched} / ${items.length} matched`;
    }

    function getOrCreateResults() {
      let results = game.querySelector('.match-results');
      if (!results) {
        results = document.createElement('div');
        results.className = 'match-results';
        const heading = document.createElement('div');
        heading.className = 'match-results-heading';
        heading.textContent = 'Matched ✓';
        results.appendChild(heading);
        game.appendChild(results);
      }
      return results;
    }

    items.forEach(item => {
      item.addEventListener('click', () => {
        if (item.classList.contains('matched')) return;
        if (selected) selected.classList.remove('selected');
        selected = item;
        item.classList.add('selected');
      });
    });

    targets.forEach(target => {
      target.addEventListener('click', () => {
        if (!selected) return;
        if (target.classList.contains('correct')) return;
        const correct = selected.dataset.match === target.dataset.id;
        if (correct) {
          /* Animate matched pair into results section */
          const results = getOrCreateResults();
          const row = document.createElement('div');
          row.className = 'match-result-row match-result-entering';
          const term = document.createElement('span');
          term.className = 'match-result-term';
          term.textContent = selected.textContent.trim();
          const arrowSpan = document.createElement('span');
          arrowSpan.className = 'match-result-arrow';
          arrowSpan.textContent = '→';
          const def = document.createElement('span');
          def.className = 'match-result-def';
          def.textContent = target.textContent.trim();
          row.appendChild(term);
          row.appendChild(arrowSpan);
          row.appendChild(def);
          results.appendChild(row);
          /* Trigger CSS transition on next frame */
          requestAnimationFrame(() => row.classList.remove('match-result-entering'));

          target.classList.add('correct');
          selected.classList.add('matched');
          selected.classList.remove('selected');
          selected = null;
          updateScore();
        } else {
          target.classList.add('incorrect');
          selected.classList.add('wrong');
          setTimeout(() => {
            target.classList.remove('incorrect');
            selected && selected.classList.remove('wrong');
          }, 700);
        }
      });
    });

    game.querySelector('.reset-btn')?.addEventListener('click', () => {
      items.forEach(i => i.classList.remove('selected', 'matched', 'wrong'));
      targets.forEach(t => t.classList.remove('correct', 'incorrect'));
      game.querySelector('.match-results')?.remove();
      selected = null;
      updateScore();
    });

    updateScore();
  });
}

