/* flashcards.js — Flashcard flip + deck navigation + matching game */

export function initFlashcards() {
  /* Individual card flip */
  document.querySelectorAll('.flashcard').forEach(card => {
    card.removeEventListener('click', card._flipFn);
    card._flipFn = () => card.classList.toggle('flipped');
    card.addEventListener('click', card._flipFn);
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', 'Click to flip card');
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.classList.toggle('flipped');
      }
    });
  });

  /* Deck navigation */
  document.querySelectorAll('.flashcard-deck').forEach(deck => {
    const cards = Array.from(deck.querySelectorAll('.flashcard'));
    if (cards.length === 0) return;
    let current = 0;
    const counter = deck.querySelector('.card-counter');
    const progressBar = deck.querySelector('.deck-progress-bar');

    function show(i) {
      cards.forEach((c, idx) => {
        c.style.display = idx === i ? 'block' : 'none';
        c.classList.remove('flipped');
      });
      if (counter) counter.textContent = `${i + 1} / ${cards.length}`;
      if (progressBar) {
        progressBar.style.width = `${((i + 1) / cards.length) * 100}%`;
      }
    }

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

    show(0);
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
      selected = null;
      updateScore();
    });

    updateScore();
  });
}
