/* ai-explain.js — AI Explain Differently feature */
const AI_CALL_KEY = 'csp-ai-calls';
const AI_CALL_LIMIT = 20;

function initAIExplain() {
  document.querySelectorAll('.ai-explain-btn').forEach(btn => {
    btn.removeEventListener('click', btn._explainFn);
    btn._explainFn = async () => {
      const calls = parseInt(localStorage.getItem(AI_CALL_KEY) || '0', 10);
      if (calls >= AI_CALL_LIMIT) {
        showAIOutput(btn,
          `Session limit reached (${AI_CALL_LIMIT} explanations). Refresh the page to reset.`,
          'error');
        return;
      }
      const topic = btn.dataset.topic ||
        btn.closest('[data-topic]')?.dataset.topic ||
        btn.closest('section')?.querySelector('h2,h3')?.textContent ||
        'this networking concept';

      btn.disabled = true;
      btn.textContent = 'Loading…';

      try {
        const res = await fetch('/api/explain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        showAIOutput(btn, data.explanation || 'No explanation generated.', 'success');
        localStorage.setItem(AI_CALL_KEY, String(calls + 1));
      } catch (e) {
        showAIOutput(btn,
          'Could not load AI explanation. Check your connection and try again.',
          'error');
      } finally {
        btn.disabled = false;
        btn.textContent = '✦ Explain Differently';
      }
    };
    btn.addEventListener('click', btn._explainFn);
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
  out.innerHTML = type === 'error'
    ? `<div class="callout-title">⚠ Error</div><p>${text}</p>`
    : `<div class="callout-title">✦ AI Explanation</div><p>${text}</p>`;
  out.style.display = 'block';
  out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
