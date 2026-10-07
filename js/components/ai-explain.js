/* ai-explain.js — AI Explain Differently feature */
const AI_CALL_KEY = 'csp-ai-calls';
const AI_CALL_LIMIT = 20;

/* Calls made today, as { day: 'YYYY-MM-DD', n }. A new day starts the count again. */
function callsToday() {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const saved = JSON.parse(localStorage.getItem(AI_CALL_KEY));
    if (saved && saved.day === today) return { day: today, n: saved.n };
  } catch {}
  return { day: today, n: 0 };
}

const FAILURE = {
  429: 'Too many explanations requested — try again in a few minutes.',
};

export function initAIExplain() {
  document.querySelectorAll('.ai-explain-btn[data-topic]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const calls = callsToday();
      if (calls.n >= AI_CALL_LIMIT) {
        showAIOutput(btn, `You've used today's ${AI_CALL_LIMIT} explanations. The limit resets tomorrow.`, 'error');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Loading…';

      try {
        const res = await fetch('/api/explain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic: btn.dataset.topic })
        });
        if (!res.ok) throw new Error(FAILURE[res.status] || `HTTP ${res.status}`);
        const data = await res.json();
        showAIOutput(btn, data.explanation || 'No explanation generated.', 'success');
        try { localStorage.setItem(AI_CALL_KEY, JSON.stringify({ day: calls.day, n: calls.n + 1 })); } catch {}
      } catch (e) {
        showAIOutput(btn,
          Object.values(FAILURE).includes(e.message) ? e.message : 'Could not load AI explanation. Check your connection and try again.',
          'error');
      } finally {
        btn.disabled = false;
        btn.textContent = '✦ Explain Differently';
      }
    });
  });
}

function showAIOutput(btn, text, type) {
  let out = btn.parentElement.querySelector('.ai-explain-output');
  if (!out) {
    out = document.createElement('div');
    out.className = 'ai-explain-output';
    btn.insertAdjacentElement('afterend', out);
  }
  out.className = `ai-explain-output callout ${type === 'error' ? 'callout-red' : 'callout-purple'}`;
  out.textContent = '';
  const title = document.createElement('div');
  title.className = 'callout-title';
  title.textContent = type === 'error' ? '⚠ Error' : '✦ AI Explanation';
  const body = document.createElement('p');
  body.textContent = text;
  out.appendChild(title);
  out.appendChild(body);
  out.style.display = 'block';
  out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
