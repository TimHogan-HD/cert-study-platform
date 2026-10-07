/* matching.js — click-to-match games (term -> definition) */

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
