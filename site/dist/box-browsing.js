// Owns the browsing transitions shared by spines, the carousel and the sleeve.
// Rendering callbacks draw content; they never have to coordinate selection,
// accessibility, focus, history or delayed carousel work.
export function createBoxBrowsing({document, window, renderRecord, renderPreview, positionPreview, onOpen, onClose}) {
  const $ = id => document.getElementById(id);
  const dialog = $('box-dialog'), strip = $('record-strip'), spines = $('spine-layer');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let box = null, records = [], index = 0, previewIndex = null, pulled = false;
  let carouselIndex = 0, manualScroll = false, settleTimer, revision = 0, returnFocus = null;

  function cancelScroll() {
    window.clearTimeout(settleTimer);
    manualScroll = false;
    revision++;
  }

  function writeLocation() {
    const hash = !dialog.open ? '' : pulled ? `#record=${encodeURIComponent(records[index].id)}` : `#box=${box}`;
    window.history.replaceState(null, '', window.location.pathname + window.location.search + hash);
  }

  function caption() {
    const record = records[carouselIndex];
    if (!record) return;
    $('prev-record').disabled = carouselIndex === 0;
    $('next-record').disabled = carouselIndex === records.length - 1;
    $('carousel-title').textContent = record.title;
    $('carousel-artist').textContent = record.artist;
    $('position-label').textContent = `${carouselIndex + 1} / ${records.length} · ${pulled ? 'Browse this box' : 'Pull out a sleeve'}`;
  }

  function styleCarousel() {
    const bounds = strip.getBoundingClientRect(), center = bounds.left + bounds.width / 2;
    for (const button of strip.children) {
      const rect = button.getBoundingClientRect(), distance = (rect.left + rect.width / 2 - center) / 90;
      const amount = Math.min(Math.abs(distance), 3);
      button.style.opacity = String(1 - amount * .17);
      button.style.transform = `perspective(600px) rotateY(${Math.sign(distance) * Math.min(amount * 18, 38)}deg) scale(${1.08 - amount * .11})`;
    }
  }

  function marker() {
    const highlighted = pulled ? index : previewIndex;
    const poly = highlighted === null ? null : spines.querySelector(`.spine-hit[data-index="${highlighted}"]`);
    spines.classList.toggle('has-highlight', !!poly);
    spines.querySelectorAll('.spine-hit').forEach(p => p.classList.toggle('is-highlighted', p === poly));
    if (!poly) return;
    let slot = spines.querySelector('.spine-slot-marker');
    if (!slot) {
      slot = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      slot.setAttribute('class', 'spine-slot-marker');
      slot.setAttribute('aria-hidden', 'true');
      slot.innerHTML = '<path d="M-3 0 L0 -5 L3 0"/><rect x="-10" y="1" width="20" height="13" rx="2"/><text x="0" y="10"></text>';
      spines.append(slot);
    }
    const [x, y] = poly.dataset.slotAnchor.split(',').map(Number);
    slot.setAttribute('transform', `translate(${x} ${y + 5})`);
    const record = records[highlighted];
    slot.querySelector('text').textContent = record.positionLabel ?? record.position;
  }

  function refresh() {
    dialog.classList.toggle('album-open', pulled);
    $('box-invitation').setAttribute('aria-hidden', String(pulled));
    spines.setAttribute('aria-hidden', String(pulled));
    spines.querySelectorAll('.spine-hit').forEach((p, i) => {
      p.setAttribute('tabindex', i === index && !pulled ? '0' : '-1');
      p.classList.toggle('selected-spine', i === index);
    });
    [...strip.children].forEach((button, i) => {
      button.classList.toggle('selected', i === index);
      button.setAttribute('aria-pressed', String(i === index));
      button.tabIndex = i === index ? 0 : -1;
    });
    caption();
    marker();
    styleCarousel();
    // Resize and asynchronous projection rebuilds can move the slot without
    // a transitionend event. Position the visible card against the new marker.
    if (previewIndex !== null && $('record-preview').classList.contains('visible')) positionPreview();
  }

  function center(instant = false) {
    const selected = strip.children[index];
    if (!selected) return;
    const target = selected.getBoundingClientRect().left - strip.getBoundingClientRect().left + strip.scrollLeft - (strip.clientWidth - selected.clientWidth) / 2;
    strip.scrollTo({left: Math.max(0, target), behavior: instant || reducedMotion ? 'instant' : 'smooth'});
  }

  function hidePreview() {
    previewIndex = null;
    $('record-preview').classList.remove('visible');
    dialog.classList.remove('has-preview');
    marker();
  }

  function preview(next, anchor = {}) {
    if (!dialog.open || pulled || !records[next]) return;
    previewIndex = next;
    marker();
    renderPreview(records[next], anchor);
    $('record-preview').classList.add('visible');
    dialog.classList.add('has-preview');
  }

  function select(next, {open = pulled, focus = null, showPreview = false} = {}) {
    if (!dialog.open || !records[next]) return;
    cancelScroll();
    index = carouselIndex = next;
    pulled = open;
    hidePreview();
    renderRecord();
    refresh();
    center();
    writeLocation();
    if (showPreview && !pulled) preview(index);
    if (focus === 'jacket') $('jacket').focus({preventScroll: true});
    if (focus === 'strip') strip.children[index]?.focus({preventScroll: true});
    if (focus === 'spine') spines.querySelector(`.spine-hit[data-index="${index}"]`)?.focus({preventScroll: true});
  }

  function open(nextBox, nextRecords, recordId) {
    if (!nextRecords.length) return;
    cancelScroll();
    if (!dialog.open) returnFocus = document.activeElement;
    box = nextBox;
    records = nextRecords;
    index = carouselIndex = recordId ? Math.max(0, records.findIndex(r => r.id === recordId)) : 0;
    pulled = !!recordId;
    hidePreview();
    if (!dialog.open) dialog.showModal();
    onOpen(box, records);
    select(index, {focus: pulled ? 'jacket' : null});
  }

  function move(step, {carousel = false} = {}) {
    const base = carousel ? carouselIndex : index;
    const next = Math.max(0, Math.min(records.length - 1, base + step));
    const active = document.activeElement;
    const focus = active?.classList.contains('spine-hit') ? 'spine' : active?.classList.contains('strip-record') ? 'strip' : null;
    // An authoritative input also cancels a pending settle at either end.
    if (next === index) { cancelScroll(); carouselIndex = index; caption(); return; }
    select(next, {focus, showPreview: true});
  }

  function putBack() {
    if (!dialog.open) return;
    cancelScroll();
    carouselIndex = index;
    pulled = false;
    hidePreview();
    refresh();
    writeLocation();
    const ticket = revision;
    window.requestAnimationFrame(() => {
      if (ticket !== revision || !dialog.open || pulled) return;
      center(true);
      styleCarousel();
      strip.children[index]?.focus({preventScroll: true});
    });
  }

  function finishClose() {
    // Native close events are queued; reopening before delivery wins.
    if (dialog.open) return;
    cancelScroll();
    pulled = false;
    hidePreview();
    refresh();
    writeLocation();
    onClose();
    returnFocus?.focus();
  }
  const close = () => { if (dialog.open) dialog.close(); };
  dialog.addEventListener('close', finishClose);
  dialog.addEventListener('cancel', event => {
    if (pulled) { event.preventDefault(); putBack(); }
  });
  dialog.addEventListener('click', event => {
    if (event.target.closest('.sleeve-object,.view-controls,.album-navigation,.album-nav,.record-info,.crate-browser,.box-header,.put-back,.turntable-widget')) return;
    if (pulled) putBack(); else close();
  });
  document.addEventListener('keydown', event => {
    const top = [...document.querySelectorAll('dialog[open]')].at(-1);
    if (top !== dialog || event.target.closest('.turntable-widget') || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      move(event.key === 'ArrowLeft' ? -1 : 1);
    }
  });
  for (const [id, step] of [['album-prev', -1], ['album-next', 1], ['previous-sleeve', -1], ['next-sleeve', 1]]) $(id).onclick = () => move(step);
  for (const [id, step] of [['prev-record', -1], ['next-record', 1]]) $(id).onclick = () => move(step, {carousel: true});
  $('close-box').onclick = close;
  $('put-back').onclick = () => putBack();
  $('carousel-selected').onclick = () => select(carouselIndex, {open: true, focus: 'jacket'});
  strip.addEventListener('wheel', event => {
    manualScroll = true;
    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) { event.preventDefault(); strip.scrollLeft += event.deltaY; }
  }, {passive: false});
  strip.addEventListener('pointerdown', () => { manualScroll = true; });
  strip.addEventListener('scroll', () => {
    styleCarousel();
    if (!manualScroll || !dialog.open) return;
    const bounds = strip.getBoundingClientRect(), centerX = bounds.left + bounds.width / 2;
    const nearest = [...strip.children].reduce((best, button) => {
      const rect = button.getBoundingClientRect(), distance = Math.abs(rect.left + rect.width / 2 - centerX);
      return !best || distance < best.distance ? {button, distance} : best;
    }, null)?.button;
    if (!nearest) return;
    carouselIndex = Number(nearest.dataset.index);
    caption();
    if (!pulled) preview(carouselIndex);
    window.clearTimeout(settleTimer);
    const ticket = revision;
    settleTimer = window.setTimeout(() => {
      if (ticket !== revision || !manualScroll || !dialog.open) return;
      if (index !== carouselIndex) select(carouselIndex, {showPreview: true});
    }, 180);
  });

  return {
    open, move, preview, hidePreview, refresh,
    pull: next => select(next, {open: true, focus: 'jacket'}),
    get box() { return box; }, get records() { return records; },
    get index() { return index; }
  };
}
