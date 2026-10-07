/* pbq-exam.js — timed exam of random PBQs drawn from the lab pages.
   .pbq-exam[data-pages] lists the lab pages to draw from. Start fetches them, picks one PBQ
   from each of N random pages (generating fresh numbers where a generator exists), and shows
   them one at a time under a single countdown. Nothing is graded until Submit or time-out. */
import { setupPbq } from './pbq.js';
import { setupTerminal } from './pbq-terminal.js';
import { GENERATORS } from './pbq-generators.js';

const shuffle = arr => arr.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v);
const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

async function drawPbqs(pages, count) {
  const chosen = shuffle(pages).slice(0, count);
  const docs = await Promise.all(chosen.map(async page => {
    const res = await fetch(`./content/netplus/pbq/${page}.html`);
    if (!res.ok) throw new Error(`could not load ${page}`);
    return new DOMParser().parseFromString(await res.text(), 'text/html');
  }));
  return docs.map(doc => {
    const all = [...doc.querySelectorAll('.pbq')];
    return document.adoptNode(all[Math.floor(Math.random() * all.length)]);
  });
}

function initExam(root) {
  const setup = root.querySelector('.exam-setup');
  const bar = root.querySelector('.exam-bar');
  const clock = root.querySelector('.exam-clock');
  const nav = root.querySelector('.exam-nav');
  const stage = root.querySelector('.exam-stage');
  const results = root.querySelector('.exam-results');
  const flagBtn = root.querySelector('.exam-flag');
  let questions = [], current = 0, deadline = 0, tick = null, began = 0;

  function show(i) {
    current = i;
    questions.forEach((q, k) => { q.el.hidden = k !== i; });
    [...nav.children].forEach((b, k) => b.classList.toggle('current', k === i));
    flagBtn.textContent = questions[i].el.dataset.flagged ? 'Unflag' : 'Flag for review';
    stage.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  function paintClock() {
    const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
    clock.textContent = `${fmt(left)} left`;
    clock.classList.toggle('low', left < 120);
    if (!root.isConnected) clearInterval(tick);
    else if (left === 0) submit(true);
  }

  async function start() {
    const count = Number(root.querySelector('.exam-count').value);
    setup.querySelector('.exam-begin').disabled = true;
    try {
      const pbqs = await drawPbqs(root.dataset.pages.split(' '), count);
      stage.replaceChildren();
      results.hidden = true;
      questions = pbqs.map((el, i) => {
        GENERATORS[el.dataset.generator]?.(el);
        el.querySelector('.pbq-kicker').textContent = `Question ${i + 1} of ${pbqs.length}`;
        stage.append(el);
        el.querySelectorAll('.pbq-term').forEach(setupTerminal);
        return { el, api: setupPbq(el), minutes: Number(el.dataset.minutes) || 5 };
      });
      nav.replaceChildren(...questions.map((q, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = String(i + 1);
        b.addEventListener('click', () => show(i));
        return b;
      }));
      began = Date.now();
      deadline = began + questions.reduce((t, q) => t + q.minutes, 0) * 60000;
      root.dataset.state = 'running';
      setup.hidden = true;
      bar.hidden = false;
      tick = setInterval(paintClock, 1000);
      paintClock();
      show(0);
    } catch (e) {
      setup.querySelector('.exam-error').textContent = `The exam could not start: ${e.message}.`;
    } finally {
      setup.querySelector('.exam-begin').disabled = false;
    }
  }

  function submit(timedOut = false) {
    if (root.dataset.state !== 'running') return;
    clearInterval(tick);
    root.dataset.state = 'review';
    const scores = questions.map(q => ({ title: q.el.querySelector('h2').textContent, ...q.api.grade() }));
    const right = scores.reduce((n, s) => n + s.right, 0), total = scores.reduce((n, s) => n + s.total, 0);
    const pct = Math.round((right / total) * 100);
    questions.forEach(q => { q.el.hidden = false; });
    bar.hidden = true;
    results.hidden = false;
    results.innerHTML = `<div class="exam-score" data-pass="${pct >= 80}">${pct}%</div>
      <p>${timedOut ? 'Time ran out. ' : ''}${right} of ${total} fields correct across ${scores.length} PBQs, in ${fmt(Math.round((Date.now() - began) / 1000))}. CompTIA does not publish how PBQs are weighted, so treat 80% here as the line to beat.</p>
      <div class="table-wrap"><table><thead><tr><th>#</th><th>PBQ</th><th>Score</th></tr></thead><tbody>
      ${scores.map((s, i) => `<tr><td>${i + 1}</td><td>${s.title}</td><td>${s.right} / ${s.total}</td></tr>`).join('')}
      </tbody></table></div>
      <p>Each PBQ below now shows which fields were wrong, with its explanation.</p>
      <button type="button" class="exam-begin exam-retake">Take another exam</button>`;
    results.querySelector('.exam-retake').addEventListener('click', () => { setup.hidden = false; results.hidden = true; stage.replaceChildren(); root.dataset.state = ''; });
    results.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  setup.querySelector('.exam-begin').addEventListener('click', start);
  root.querySelector('.exam-prev').addEventListener('click', () => show(Math.max(0, current - 1)));
  root.querySelector('.exam-next').addEventListener('click', () => show(Math.min(questions.length - 1, current + 1)));
  flagBtn.addEventListener('click', () => {
    const q = questions[current].el;
    if (q.dataset.flagged) delete q.dataset.flagged; else q.dataset.flagged = 'true';
    nav.children[current].classList.toggle('flagged', !!q.dataset.flagged);
    flagBtn.textContent = q.dataset.flagged ? 'Unflag' : 'Flag for review';
  });
  root.querySelector('.exam-submit').addEventListener('click', () => {
    const flagged = questions.filter(q => q.el.dataset.flagged).length;
    if (!flagged || confirm(`${flagged} PBQ${flagged > 1 ? 's are' : ' is'} still flagged. Submit anyway?`)) submit();
  });
}

export function initPbqExam() {
  document.querySelectorAll('.pbq-exam').forEach(initExam);
}
