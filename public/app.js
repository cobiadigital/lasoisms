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
    about: document.getElementById('about'),
    aboutSheet: document.getElementById('about-sheet'),
    aboutBackdrop: document.getElementById('about-backdrop'),
    aboutClose: document.getElementById('about-close'),
    toast: document.getElementById('toast')
  };

  let quotes = [];
  let characters = [];
  let counts = {};
  let selected = new Set();
  let deck = [];
  let current = null;
  let busy = false;
  let sharing = false;

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

  const CARD = { size: 1080, name: 'lassoisms-quote.png' };

  /**
   * Draw the quote as a square card: the same blue ground, gold tag and serif
   * setting as the page, so a shared image reads as this app. Original layout,
   * text only, no marks from the show.
   */
  function drawCard(q) {
    const S = CARD.size;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = S;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const sky = ctx.createLinearGradient(0, 0, S * 0.35, S);
    sky.addColorStop(0, '#0a2c5e');
    sky.addColorStop(1, '#061c3d');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, S, S);

    // The same diagonal kit stripes the page uses, drawn as rotated bands.
    ctx.save();
    ctx.translate(S / 2, S / 2);
    ctx.rotate(-25 * Math.PI / 180);
    ctx.fillStyle = 'rgba(255,255,255,.035)';
    for (let x = -S; x < S; x += 96) ctx.fillRect(x, -S, 48, S * 2);
    ctx.restore();

    // Gold tag, tilted like the one on the page.
    ctx.save();
    ctx.translate(S / 2, S * 0.135);
    ctx.rotate(-1.2 * Math.PI / 180);
    ctx.font = '700 30px Georgia, "Times New Roman", serif';
    const label = 'B E L I E V E';
    const tagW = ctx.measureText(label).width + 64;
    ctx.fillStyle = '#f4d35e';
    ctx.fillRect(-tagW / 2, -30, tagW, 60);
    ctx.fillStyle = '#0a2c5e';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 2);
    ctx.restore();

    // Quote, shrunk until it fits the middle band.
    const maxW = S * 0.8;
    const maxH = S * 0.46;
    const text = '\u201C' + q.quote + '\u201D';
    let size = 74;
    let lines = [];
    for (; size >= 30; size -= 2) {
      ctx.font = size + 'px Georgia, "Times New Roman", serif';
      lines = wrap(ctx, text, maxW);
      if (lines.length * size * 1.3 <= maxH) break;
    }
    ctx.fillStyle = '#f7f4ec';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lead = size * 1.3;
    const top = S / 2 - ((lines.length - 1) * lead) / 2;
    lines.forEach((line, i) => ctx.fillText(line, S / 2, top + i * lead));

    ctx.font = '700 26px Helvetica, Arial, sans-serif';
    ctx.fillStyle = '#f4d35e';
    ctx.fillText(spaced('\u2014 ' + q.character.toUpperCase()), S / 2, S * 0.78);

    ctx.font = '20px Helvetica, Arial, sans-serif';
    ctx.fillStyle = 'rgba(247,244,236,.45)';
    ctx.fillText(location.host || 'lassoisms', S / 2, S * 0.93);

    return canvas;
  }

  function spaced(s) { return s.split('').join('\u2009'); }

  function wrap(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const next = line ? line + ' ' + word : word;
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function cardFile(q) {
    return new Promise((resolve) => {
      let canvas;
      try {
        canvas = drawCard(q);
      } catch (_) {
        resolve(null);
        return;
      }
      if (!canvas || !canvas.toBlob) { resolve(null); return; }
      canvas.toBlob((blob) => {
        resolve(blob ? new File([blob], CARD.name, { type: 'image/png' }) : null);
      }, 'image/png');
    });
  }

  function download(file) {
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /**
   * Hand the quote over as a picture and a link: the system share sheet on a
   * phone, the clipboard and a saved PNG elsewhere.
   *
   * The link rides in `text` rather than `url`, because iOS treats a share
   * with `url` set as a link share and silently drops the attachment.
   */
  async function shareCurrent() {
    if (!current || sharing) return;
    sharing = true;
    el.share.disabled = true;
    const link = location.origin + location.pathname;
    const text = '\u201C' + current.quote + '\u201D \u2014 ' + current.character + '\n' + link;
    try {
      toast('Drawing the card\u2026');
      const file = await cardFile(current);
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Lassoisms', text });
        toast('Shared');
        return;
      }
      await navigator.clipboard.writeText(text);
      if (file) {
        download(file);
        toast('Copied, and the card saved');
      } else {
        toast('Copied');
      }
    } catch (err) {
      if (err && err.name === 'AbortError') { toast('Share cancelled'); return; }
      toast('Could not share');
    } finally {
      sharing = false;
      el.share.disabled = false;
    }
  }

  function openAbout() {
    el.aboutSheet.hidden = false;
    el.aboutBackdrop.hidden = false;
    // Let the hidden attribute clear before the transform animates in.
    requestAnimationFrame(() => {
      el.aboutSheet.classList.add('open');
      el.aboutBackdrop.classList.add('open');
    });
    el.about.setAttribute('aria-expanded', 'true');
    el.aboutClose.focus({ preventScroll: true });
  }

  function closeAbout() {
    el.aboutSheet.classList.remove('open');
    el.aboutBackdrop.classList.remove('open');
    el.about.setAttribute('aria-expanded', 'false');
    setTimeout(() => {
      el.aboutSheet.hidden = true;
      el.aboutBackdrop.hidden = true;
    }, reduceMotion ? 0 : 260);
  }

  function wireEvents() {
    el.stage.addEventListener('click', () => {
      if (!el.aboutSheet.hidden) { closeAbout(); return; }
      advance();
    });

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

    el.about.addEventListener('click', (e) => {
      e.stopPropagation();
      if (el.aboutSheet.hidden) openAbout(); else closeAbout();
    });
    el.aboutClose.addEventListener('click', (e) => { e.stopPropagation(); closeAbout(); });
    el.aboutBackdrop.addEventListener('click', (e) => { e.stopPropagation(); closeAbout(); });
    el.aboutSheet.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !el.aboutSheet.hidden) closeAbout();
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
