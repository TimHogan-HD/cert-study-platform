/* pbq-terminal.js — simulated device consoles for troubleshooting PBQs.
   A .pbq-term holds one .pbq-term-host per device (data-host, data-os, data-prompt). Each host
   answers the commands in its <template data-cmd="a|b"> children; "*" in a pattern matches one
   argument, echoed into the output as {1}, {2}… IOS hosts accept abbreviated words (sh ip int br),
   as a real switch does. */

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const words = s => s.trim().split(/\s+/).filter(Boolean);

const OS = {
  windows: {
    promptClass: 'tpw',
    wordMatches: (pattern, typed) => pattern === typed,
    clear: ['cls', 'clear'],
    unknown: cmd => `${esc(cmd)} : The term '${esc(cmd)}' is not recognized as a name of a cmdlet, function, script file, or executable program.\nCheck the spelling of the name, or if a path was included, verify that the path is correct and try again.`,
  },
  ios: {
    promptClass: 'tpc',
    wordMatches: (pattern, typed) => pattern.startsWith(typed),
    clear: [],
    unknown: () => "% Invalid input detected at '^' marker.",
  },
};

/* "a|b" lists alternative spellings; " | " with spaces is the IOS output pipe and stays in the command. */
const spellings = cmd => cmd.split(/(?<! )\|(?! )/);

function commandsOf(host) {
  return [...host.querySelectorAll('template[data-cmd]')].map(t => ({
    patterns: spellings(t.dataset.cmd).map(p => words(p.toLowerCase())),
    usage: spellings(t.dataset.cmd)[0].replace(/\*/g, '<target>'),
    html: t.innerHTML.replace(/^\n/, '').replace(/\s+$/, ''),
  }));
}

/* The command whose pattern matches with the most literal words, and its "*" captures. */
function resolve(commands, typed, os) {
  const input = words(typed);
  let best = null;
  for (const cmd of commands) {
    for (const pattern of cmd.patterns) {
      if (pattern.length !== input.length) continue;
      const args = [];
      const ok = pattern.every((w, i) => {
        if (w === '*') { args.push(input[i]); return true; }
        return os.wordMatches(w, input[i].toLowerCase());
      });
      const literal = pattern.length - args.length;
      if (ok && (!best || literal > best.literal)) best = { cmd, args, literal };
    }
  }
  return best;
}

export function initPbqTerminals() {
  document.querySelectorAll('.pbq-term').forEach(term => {
    const hosts = [...term.querySelectorAll('.pbq-term-host')].map(el => ({
      name: el.dataset.host,
      prompt: el.dataset.prompt,
      os: OS[el.dataset.os] || OS.windows,
      commands: commandsOf(el),
      out: null,
    }));
    if (!hosts.length) return;

    const title = term.querySelector('.terminal-title');
    const tabs = document.createElement('div');
    tabs.className = 'pbq-term-tabs';
    tabs.setAttribute('role', 'tablist');
    const line = document.createElement('form');
    line.className = 'pbq-term-line';
    const promptEl = document.createElement('span');
    const input = document.createElement('input');
    Object.assign(input, { type: 'text', autocomplete: 'off', spellcheck: false });
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('aria-label', 'Command');
    line.append(promptEl, input);

    let active = hosts[0];
    const history = [];
    let back = 0;

    hosts.forEach(h => {
      h.out = document.createElement('pre');
      h.out.className = 'terminal-body pbq-term-out';
      h.out.setAttribute('aria-live', 'polite');
      h.out.innerHTML = `<span class="tn">Connected to ${esc(h.name)}. Type help to list the commands this device accepts.</span>\n`;
      h.tab = document.createElement('button');
      h.tab.type = 'button';
      h.tab.className = 'pbq-term-tab';
      h.tab.setAttribute('role', 'tab');
      h.tab.textContent = h.name;
      h.tab.addEventListener('click', () => show(h));
      tabs.append(h.tab);
    });
    term.querySelector('.terminal-bar').after(tabs, ...hosts.map(h => h.out), line);

    function show(h) {
      active = h;
      for (const x of hosts) {
        x.out.hidden = x !== h;
        x.tab.classList.toggle('active', x === h);
        x.tab.setAttribute('aria-selected', String(x === h));
      }
      promptEl.className = h.os.promptClass;
      promptEl.textContent = h.prompt;
      if (title) title.textContent = `${h.name} — console`;
    }

    function run(typed) {
      const h = active;
      const echo = `<span class="${h.os.promptClass}">${esc(h.prompt)}</span> ${esc(typed)}\n`;
      const verb = typed.trim().toLowerCase();
      if (h.os.clear.includes(verb)) { h.out.innerHTML = ''; return; }
      let body;
      if (!verb) body = '';
      else if (verb === 'help' || verb === '?') {
        body = `<span class="tn">Commands available on ${esc(h.name)}:</span>\n${h.commands.map(c => `  ${esc(c.usage)}`).join('\n')}`;
      } else {
        const hit = resolve(h.commands, typed, h.os);
        const first = words(verb)[0];
        const known = h.commands.some(c => c.patterns.some(p => p[0] === first));
        body = hit ? hit.cmd.html.replace(/\{(\d)\}/g, (_, n) => esc(hit.args[n - 1] || ''))
          : known && h.os === OS.windows ? `<span class="tn">That form of ${esc(first)} is not part of this simulation. Type help to list the commands this device accepts.</span>`
          : `<span class="te">${h.os.unknown(words(typed)[0])}</span>`;
      }
      h.out.insertAdjacentHTML('beforeend', echo + (body ? `${body}\n\n` : ''));
      h.out.scrollTop = h.out.scrollHeight;
    }

    line.addEventListener('submit', e => {
      e.preventDefault();
      if (input.value.trim()) history.push(input.value);
      back = 0;
      run(input.value);
      input.value = '';
    });
    input.addEventListener('keydown', e => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      back = Math.max(0, Math.min(history.length, back + (e.key === 'ArrowUp' ? 1 : -1)));
      input.value = back ? history[history.length - back] : '';
    });
    hosts.forEach(h => h.out.addEventListener('click', () => {
      if (!window.getSelection().toString()) input.focus({ preventScroll: true });
    }));

    show(active);
  });
}
