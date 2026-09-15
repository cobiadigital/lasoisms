(() => {
  'use strict';

  const STORAGE_KEY = 'lassoisms.characters.v1';
  const DEFAULT_CHARACTER = 'Ted Lasso';
  const el = {
    stage: document.getElementById('stage'),
    wrap: document.querySelector('.quote-wrap'),
    quote: document.getElementById('quote'),
    attrib: document.getElementById('attrib'),
    hint: document.getElementById('hint'),
    dock: document.getElementById('dock'),
    chips: document.getElementById('chips'),
    toggle: document.getElementById('toggleFilters'),
    toggleLabel: document.getElementById('toggleLabel'),
    share: document.getElementById('share'),
    flag: document.getElementById('flag'),
    toast: document.getElementById('toast')
  };

  let quotes = [];
  let characters = [];
  let counts = {};
  let selected = new Set();
  let deck = [];
  let current = null;
  let busy = false;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // First visit opens on Ted alone; everyone else is opt-in from the dock.
  function defaultSelection(all) {
    return new Set(all.includes(DEFAULT_CHARACTER) ? [DEFAULT_CHARACTER] : all);
  }

  function loadSelection(all) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultSelection(all);
      const saved = JSON.parse(raw).filter((c) => all.includes(c));
      return saved.length ? new Set(saved) : defaultSelection(all);
    } catch (_) {
      return defaultSelection(all);
    }
  }

  function saveSelection() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...selected]));
    } catch (_) { /* private mode, ignore */ }
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Shuffle-bag: every quote in the pool shows once before any repeats.
  function refillDeck() {
    const pool = quotes.filter((q) => selected.has(q.character));
    deck = shuffle(pool.slice());
    if (deck.length > 1 && current && deck[deck.length - 1] === current) {
      [deck[0], deck[deck.length - 1]] = [deck[deck.length - 1], deck[0]];
    }
  }

  function nextQuote() {
    if (!deck.length) refillDeck();
    return deck.pop() || null;
  }

  function sizeClass(text) {
    if (text.length > 220) return 'quote xlong';
    if (text.length > 110) return 'quote long';
    return 'quote';
  }

  function paint(q) {
    if (!q) {
      el.quote.textContent = 'Pick at least one character.';
      el.quote.className = 'quote';
      el.attrib.textContent = '';
      el.attrib.hidden = true;
      el.flag.className = 'flag';
      el.flag.hidden = true;
      return;
    }
    current = q;
    el.quote.textContent = '“' + q.quote + '”';
    el.quote.className = sizeClass(q.quote);
    el.attrib.hidden = false;
    el.attrib.textContent = q.character;
    el.flag.hidden = false;
    el.flag.className = 'flag ' + (q.verified ? 'verified' : 'unverified');
    el.flag.setAttribute('aria-label', q.verified
      ? 'Confirmed against a source'
      : 'Not confirmed against a source');
  }

  function advance() {
    if (busy) return;
    const q = nextQuote();
    if (!q) { paint(null); return; }
    if (reduceMotion) { paint(q); return; }
    busy = true;
    el.wrap.classList.add('swap');
    setTimeout(() => {
      paint(q);
      el.wrap.classList.remove('swap');
      busy = false;
    }, 190);
  }

  function updateToggleLabel() {
    const n = selected.size;
    if (n === characters.length) el.toggleLabel.textContent = 'All characters';
    else if (n === 1) el.toggleLabel.textContent = [...selected][0];
    else el.toggleLabel.textContent = n + ' characters';
  }

  function syncChips() {
    el.chips.querySelectorAll('.chip[data-name]').forEach((chip) => {
      chip.setAttribute('aria-pressed', String(selected.has(chip.dataset.name)));
    });
    const all = el.chips.querySelector('.chip.all');
    if (all) all.setAttribute('aria-pressed', String(selected.size === characters.length));
    updateToggleLabel();
  }

  function buildChips() {
    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'chip all';
    allBtn.textContent = 'Everyone';
    allBtn.setAttribute('aria-pressed', 'true');
    allBtn.addEventListener('click', () => {
      selected = selected.size === characters.length ? new Set() : new Set(characters);
      afterFilterChange();
    });
    el.chips.appendChild(allBtn);

    characters.forEach((name) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.dataset.name = name;
      chip.setAttribute('aria-pressed', String(selected.has(name)));
      chip.innerHTML = '';
      chip.append(name);
      const count = document.createElement('span');
      count.className = 'count';
      count.textContent = counts[name];
      chip.appendChild(count);
      chip.addEventListener('click', () => {
        if (selected.has(name)) selected.delete(name); else selected.add(name);
        afterFilterChange();
      });
      el.chips.appendChild(chip);
    });
  }

  function afterFilterChange() {
    saveSelection();
    syncChips();
    deck = [];
    current = null;
    advance();
  }

  function toast(message) {
    el.toast.textContent = message;
    el.toast.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.toast.classList.remove('show'), 1600);
  }

  async function shareCurrent() {
    if (!current) return;
    const text = '“' + current.quote + '” — ' + current.character;
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      toast('Copied');
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      toast('Could not share');
    }
  }

  function wireEvents() {
    el.stage.addEventListener('click', advance);

    el.stage.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        advance();
      }
    });

    let startX = 0, startY = 0;
    el.stage.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });
    el.stage.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) advance();
    }, { passive: true });

    // The dock and share button must never fall through to "next quote".
    el.dock.addEventListener('click', (e) => e.stopPropagation());
    el.share.addEventListener('click', (e) => {
      e.stopPropagation();
      shareCurrent();
    });

    el.flag.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!current) return;
      toast(current.verified ? 'Confirmed against a source' : 'Not confirmed against a source');
    });

    el.toggle.addEventListener('click', () => {
      const open = el.chips.hidden;
      el.chips.hidden = !open;
      el.toggle.setAttribute('aria-expanded', String(open));
      el.dock.classList.toggle('open', open);
      el.hint.hidden = open;
    });

    // The dock's height changes with the character count and when the panel opens,
    // so the stage reserves exactly as much room as the dock actually occupies.
    const trackDock = () => {
      const h = Math.ceil(el.dock.getBoundingClientRect().height);
      document.documentElement.style.setProperty('--dock-h', h + 'px');
    };
    if (window.ResizeObserver) new ResizeObserver(trackDock).observe(el.dock);
    window.addEventListener('resize', trackDock);
    trackDock();
  }

  async function init() {
    let data;
    try {
      const res = await fetch('quotes.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      data = await res.json();
    } catch (err) {
      el.quote.textContent = 'Could not load the quotes. Try a refresh.';
      el.attrib.hidden = true;
      return;
    }

    quotes = data.quotes || [];
    counts = quotes.reduce((acc, q) => {
      acc[q.character] = (acc[q.character] || 0) + 1;
      return acc;
    }, {});
    const present = Object.keys(counts);
    const ordered = (data.order || []).filter((name) => present.includes(name));
    characters = ordered.concat(present.filter((name) => !ordered.includes(name)));

    selected = loadSelection(characters);
    buildChips();
    syncChips();
    wireEvents();
    advance();
    el.stage.focus({ preventScroll: true });
    setTimeout(() => el.hint.classList.add('faded'), 4000);
  }

  init();
})();
