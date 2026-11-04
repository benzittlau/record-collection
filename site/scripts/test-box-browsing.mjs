import assert from 'node:assert/strict';
import test from 'node:test';
import {createBoxBrowsing} from '../src/box-browsing.js';

// A local DOM stand-in supplies only browser operations. Selection, timers,
// history, focus policy, and event handling all run in the production module.
function fixture() {
  let document;
  class Element {
    constructor(id = '', classes = '') {
      this.id = id; this.tagName = 'BUTTON'; this.dataset = {}; this.style = {};
      this.children = []; this.attributes = {}; this.listeners = {}; this.scrollLeft = 0; this.clientWidth = 100;
      this.classes = new Set(classes.split(' ').filter(Boolean));
      this.classList = {
        contains: name => this.classes.has(name),
        add: name => this.classes.add(name), remove: name => this.classes.delete(name),
        toggle: (name, force) => { const set = force ?? !this.classes.has(name); if (set) this.classes.add(name); else this.classes.delete(name); }
      };
    }
    setAttribute(name, value) { this.attributes[name] = String(value); if (name === 'class') this.classes = new Set(value.split(' ')); }
    getAttribute(name) { return this.attributes[name]; }
    append(child) { this.children.push(child); }
    set innerHTML(value) { this.children = value.includes('<text') ? [new Element('text')] : []; }
    matches(selector) {
      if (selector === 'text') return this.id === 'text';
      return selector.startsWith('.') && this.classList.contains(selector.slice(1));
    }
    querySelectorAll(selector) { return this.children.filter(child => child.matches(selector)); }
    querySelector(selector) {
      const index = selector.match(/^\.spine-hit\[data-index="(\d+)"\]$/)?.[1];
      return index === undefined ? this.querySelectorAll(selector)[0] ?? null : this.children.find(c => c.classList.contains('spine-hit') && c.dataset.index === index) ?? null;
    }
    closest(selectors) { return selectors.split(',').some(selector => this.matches(selector)) ? this : null; }
    getBoundingClientRect() { return {left: this.left ?? 0, width: 100}; }
    scrollTo(options) { this.lastScroll = options; }
    focus() { document.activeElement = this; }
    addEventListener(name, listener) { (this.listeners[name] ??= []).push(listener); }
    emit(name, data = {}) {
      const event = {target: this, preventDefault() { this.defaultPrevented = true; }, ...data};
      for (const listener of this.listeners[name] ?? []) listener(event);
      return event;
    }
    showModal() { this.open = true; }
    close() { this.open = false; this.emit('close'); }
  }
  const ids = ['box-dialog', 'record-strip', 'spine-layer', 'box-invitation', 'record-preview', 'jacket',
    'prev-record', 'next-record', 'carousel-title', 'carousel-artist', 'position-label', 'album-prev', 'album-next',
    'previous-sleeve', 'next-sleeve', 'close-box', 'put-back', 'carousel-selected'];
  const elements = Object.fromEntries(ids.map(id => [id, new Element(id)]));
  const roomButton = new Element('room-button'), listeners = {}, timers = new Map(), frames = [];
  let nextTimer = 0;
  document = {
    activeElement: roomButton,
    getElementById: id => elements[id],
    createElementNS: () => new Element(),
    querySelectorAll: () => [elements['box-dialog'], ...(document.extraDialogs ?? [])].filter(d => d.open),
    addEventListener(name, fn) { listeners[name] = fn; }
  };
  const location = {pathname: '/room', search: '?keep=1'};
  const window = {
    location, history: {replaceState: (_, __, url) => { location.url = url; }},
    matchMedia: () => ({matches: false}),
    setTimeout: fn => { timers.set(++nextTimer, fn); return nextTimer; }, clearTimeout: id => timers.delete(id),
    requestAnimationFrame: fn => frames.push(fn)
  };
  const rows = Array.from({length: 4}, (_, i) => ({id: `sleeve-${i}`, title: `Album ${i}`, artist: `Artist ${i}`, position: i + 1}));
  let rendered, previewed, closes = 0;
  const previewPositions = [];
  const browsing = createBoxBrowsing({document, window,
    renderRecord: () => { rendered = browsing.records[browsing.index].id; },
    renderPreview: record => { previewed = record.id; },
    positionPreview: () => { previewPositions.push(elements['spine-layer'].querySelector('.spine-slot-marker')?.getAttribute('transform')); },
    onOpen: (_, records) => {
      elements['record-strip'].children = records.map((_, i) => {
        const button = new Element('', 'strip-record'); button.dataset.index = String(i); button.left = i * 100; return button;
      });
      elements['spine-layer'].children = records.map((_, i) => {
        const spine = new Element('', 'spine-hit'); spine.dataset.index = String(i); spine.dataset.slotAnchor = `${i * 10},20`; return spine;
      });
    }, onClose: () => { closes++; }
  });
  return {browsing, rows, elements, document, roomButton, Element, timers, previewPositions,
    get rendered() { return rendered; }, get previewed() { return previewed; }, get closes() { return closes; },
    get url() { return location.url; },
    key(key, target = document.activeElement) { return listeners.keydown({key, target, preventDefault() { this.defaultPrevented = true; }}); },
    frames() { while (frames.length) frames.shift()(); },
    settle() { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); },
    scrollTo(index) {
      elements['record-strip'].emit('pointerdown');
      elements['record-strip'].children.forEach((child, i) => { child.left = (i - index) * 100; });
      elements['record-strip'].emit('scroll');
    }
  };
}

function assertSelection(f, index, pulled) {
  assert.equal(f.rendered, f.rows[index].id);
  assert.equal(f.elements['box-dialog'].classList.contains('album-open'), pulled);
  assert.equal(f.elements['spine-layer'].getAttribute('aria-hidden'), String(pulled));
  const strip = f.elements['record-strip'];
  assert.deepEqual(strip.children.map(b => b.getAttribute('aria-pressed')), f.rows.map((_, i) => String(i === index)));
  assert.deepEqual(strip.children.map(b => b.tabIndex), f.rows.map((_, i) => i === index ? 0 : -1));
  const spines = f.elements['spine-layer'].querySelectorAll('.spine-hit');
  assert.deepEqual(spines.map(p => p.getAttribute('tabindex')), f.rows.map((_, i) => i === index && !pulled ? '0' : '-1'));
  assert.equal(f.url, `/room?keep=1#${pulled ? `record=sleeve-${index}` : 'box=left'}`);
}

test('scroll, pull, arrow navigation, Escape and close keep focus and history together', () => {
  const f = fixture(); f.browsing.open('left', f.rows);
  assertSelection(f, 0, false);
  f.scrollTo(2);
  assert.equal(f.previewed, 'sleeve-2');
  assert.equal(f.elements['carousel-title'].textContent, 'Album 2');
  f.settle(); assertSelection(f, 2, false);
  f.elements['carousel-selected'].onclick(); assertSelection(f, 2, true);
  assert.equal(f.document.activeElement, f.elements.jacket);
  f.key('ArrowRight'); assertSelection(f, 3, true);
  assert.equal(f.elements['box-dialog'].emit('cancel').defaultPrevented, true);
  f.frames(); assertSelection(f, 3, false);
  assert.equal(f.document.activeElement, f.elements['record-strip'].children[3]);
  f.elements['close-box'].onclick();
  assert.equal(f.url, '/room?keep=1');
  assert.equal(f.document.activeElement, f.roomButton);
  assert.equal(f.closes, 1);
});

test('authoritative navigation cancels pending carousel selection, including at the end', () => {
  const f = fixture(); f.browsing.open('left', f.rows);
  f.scrollTo(3);
  const staleSettle = [...f.timers.values()][0];
  f.key('ArrowRight'); f.settle(); staleSettle();
  assertSelection(f, 1, false);
  f.browsing.pull(3); f.scrollTo(0); f.key('ArrowRight'); f.settle();
  assertSelection(f, 3, true);
});

test('carousel arrows advance from the centered sleeve before the settle timer fires', () => {
  const f = fixture(); f.browsing.open('left', f.rows);
  f.scrollTo(2); f.elements['next-record'].onclick(); f.settle();
  assertSelection(f, 3, false);
  assert.equal(f.elements['next-record'].disabled, true);
});

test('close and switching boxes invalidate stale scroll and deferred focus', () => {
  const f = fixture(); f.browsing.open('left', f.rows, 'sleeve-1');
  f.elements['put-back'].onclick(); f.scrollTo(3);
  const stale = [...f.timers.values()][0];
  f.elements['close-box'].onclick(); f.settle(); stale(); f.frames();
  assert.equal(f.document.activeElement, f.roomButton);
  assert.equal(f.url, '/room?keep=1');
  f.browsing.open('left', f.rows);
  f.scrollTo(3); const oldBoxSettle = [...f.timers.values()][0];
  f.browsing.open('right', [f.rows[0]], 'sleeve-0'); oldBoxSettle(); f.settle();
  assert.equal(f.rendered, 'sleeve-0'); assert.equal(f.document.activeElement, f.elements.jacket);
  assert.equal(f.elements['record-strip'].children.length, 1);
});

test('spine and strip keyboard focus follows selection; hovering leaves selection intact', () => {
  const f = fixture(); f.browsing.open('left', f.rows);
  f.elements['spine-layer'].children[0].focus(); f.key('ArrowRight');
  assertSelection(f, 1, false);
  assert.equal(f.document.activeElement, f.elements['spine-layer'].children[1]);
  f.browsing.preview(3); assert.equal(f.rendered, 'sleeve-1');
  f.browsing.hidePreview();
  assert.equal(f.elements['record-preview'].classList.contains('visible'), false);
  f.elements['record-strip'].children[1].focus(); f.key('ArrowRight');
  assert.equal(f.document.activeElement, f.elements['record-strip'].children[2]);
});

test('other dialogs, form fields and turntable controls retain their keyboard input', () => {
  const f = fixture(); f.browsing.open('left', f.rows);
  const input = new f.Element(); input.tagName = 'INPUT'; f.key('ArrowRight', input);
  f.key('ArrowRight', new f.Element('', 'turntable-widget'));
  f.document.extraDialogs = [{open: true}]; f.key('ArrowRight');
  assertSelection(f, 0, false);
});

test('background clicks put back before closing; content clicks preserve the sleeve', () => {
  const f = fixture(); f.browsing.open('left', f.rows, 'sleeve-2');
  f.elements['box-dialog'].emit('click', {target: new f.Element('', 'record-info')});
  assertSelection(f, 2, true);
  f.elements['box-dialog'].emit('click'); f.frames(); assertSelection(f, 2, false);
  f.elements['box-dialog'].emit('click'); assert.equal(f.url, '/room?keep=1');
});

test('direct links select the requested sleeve, and rebuilding spines preserves accessibility', () => {
  const f = fixture(); f.browsing.open('left', f.rows, 'sleeve-2');
  f.browsing.preview(0); assertSelection(f, 2, true);
  f.elements['spine-layer'].children = f.elements['spine-layer'].children.filter(p => p.classList.contains('spine-hit'));
  f.browsing.refresh(); assertSelection(f, 2, true);
  assert.equal(f.elements['spine-layer'].querySelector('.spine-slot-marker').querySelector('text').textContent, 3);
});

test('a queued native close event does not undo a reopened box', () => {
  const f = fixture(); f.browsing.open('left', f.rows);
  // HTMLDialogElement queues close delivery, allowing open() before it fires.
  f.elements['box-dialog'].open = false;
  f.browsing.open('left', f.rows, 'sleeve-2');
  f.elements['box-dialog'].emit('close');
  assertSelection(f, 2, true);
  assert.equal(f.document.activeElement, f.elements.jacket);
  assert.equal(f.closes, 0);
});

test('geometry refresh repositions a visible preview after updating its marker', () => {
  const f = fixture(); f.browsing.open('left', f.rows);
  f.browsing.move(1);
  const before = f.previewPositions.length;
  f.elements['spine-layer'].children[1].dataset.slotAnchor = '130,70';
  f.browsing.refresh();
  assert.equal(f.previewPositions.length, before + 1);
  assert.equal(f.previewPositions.at(-1), 'translate(130 75)');
  assertSelection(f, 1, false);

  f.browsing.hidePreview();
  const hidden = f.previewPositions.length;
  f.browsing.refresh();
  assert.equal(f.previewPositions.length, hidden, 'hidden previews stay hidden');
  f.browsing.pull(1);
  f.browsing.refresh();
  assert.equal(f.previewPositions.length, hidden, 'pulled sleeves have no preview');
});
