import { findSelection, generateWordSearch } from './word-search.js';
import { visibleElapsedMs } from './core.js';
import { completionPanel, createSession, element, formatElapsed, renderReplacementKept, sharedShell } from './controller-common.js';

const same = (left, right) => left?.row === right?.row && left?.column === right?.column;
const keyFor = ({ row, column }) => `${row}:${column}`;
const straight = (start, end) => {
  const row = end.row - start.row, column = end.column - start.column;
  return row === 0 || column === 0 || Math.abs(row) === Math.abs(column);
};
const allowedLine = (definition, start, end) => {
  if (!straight(start, end)) return false;
  return definition.difficulty !== 'easy' || start.row === end.row || start.column === end.column;
};

export function createWordSearchState(definition) {
  return { definition, focus: { row: 0, column: 0 }, start: null, preview: null, found: [], assisted: false, completed: false };
}

const validCoordinate = (coordinate, size) => coordinate === null || (
  Number.isInteger(coordinate?.row) && Number.isInteger(coordinate?.column)
  && coordinate.row >= 0 && coordinate.column >= 0 && coordinate.row < size && coordinate.column < size
);
export function validateWordSearchRun(payload, difficulty) {
  const definition = payload?.definition;
  if (!definition || definition.difficulty !== difficulty || !Number.isInteger(definition.seed)
      || definition.seed < 0 || !Number.isInteger(definition.size) || definition.size < 1
      || typeof definition.theme !== 'string' || !definition.theme
      || !Array.isArray(definition.grid) || definition.grid.length !== definition.size
      || definition.grid.some((row) => !Array.isArray(row) || row.length !== definition.size
        || row.some((letter) => !/^[A-Z]$/.test(letter)))
      || !Array.isArray(definition.placements) || definition.placements.length < 1) return false;
  const words = new Set();
  for (const placement of definition.placements) {
    if (!placement || !/^[A-Z]{2,}$/.test(placement.word ?? '') || words.has(placement.word)
        || !validCoordinate(placement.start, definition.size) || !validCoordinate(placement.end, definition.size)) return false;
    const rowDelta = placement.end.row - placement.start.row;
    const columnDelta = placement.end.column - placement.start.column;
    const length = Math.max(Math.abs(rowDelta), Math.abs(columnDelta)) + 1;
    if (!straight(placement.start, placement.end) || length !== placement.word.length) return false;
    const dr = Math.sign(rowDelta), dc = Math.sign(columnDelta);
    const rendered = Array.from({ length }, (_, index) => (
      definition.grid[placement.start.row + dr * index]?.[placement.start.column + dc * index]
    )).join('');
    if (rendered !== placement.word) return false;
    words.add(placement.word);
  }
  const play = payload.play;
  if (play == null) return true;
  return Array.isArray(play.found) && play.found.every((word) => words.has(word))
    && new Set(play.found).size === play.found.length
    && validCoordinate(play.focus, definition.size) && play.focus !== null
    && validCoordinate(play.start ?? null, definition.size)
    && validCoordinate(play.preview ?? null, definition.size)
    && typeof play.completed === 'boolean' && typeof play.assisted === 'boolean';
}

export function reduceWordSearch(state, action) {
  if (action.type === 'move') {
    return { ...state, focus: {
      row: Math.max(0, Math.min(state.definition.size - 1, action.row)),
      column: Math.max(0, Math.min(state.definition.size - 1, action.column)),
    } };
  }
  if (action.type === 'preview') {
    return state.start && allowedLine(state.definition, state.start, action.end) ? { ...state, preview: action.end } : state;
  }
  if (action.type === 'select') {
    if (!state.start) return { ...state, start: state.focus, preview: state.focus };
    return reduceWordSearch(state, { type: 'select-endpoints', start: state.start, end: state.focus });
  }
  if (action.type === 'select-endpoints') {
    const placement = findSelection(state.definition, action.start, action.end);
    if (!placement || state.found.includes(placement.word)) return { ...state, start: null, preview: null };
    const found = [...state.found, placement.word];
    return { ...state, found, start: null, preview: null, completed: found.length === state.definition.placements.length, lastFound: placement.word };
  }
  if (action.type === 'hint') {
    const placement = state.definition.placements.find(({ word }) => !state.found.includes(word));
    if (!placement) return state;
    const found = [...state.found, placement.word];
    return { ...state, found, assisted: true, completed: found.length === state.definition.placements.length, lastFound: placement.word };
  }
  if (action.type === 'check') return { ...state, assisted: true };
  return state;
}

const persisted = (definition, play, assisted) => ({
  ...createWordSearchState(definition), ...(play ?? {}), definition,
  assisted: assisted || play?.assisted === true,
});

const cellsOnLine = (start, end) => {
  if (!start || !end || !straight(start, end)) return [];
  const length = Math.max(Math.abs(end.row - start.row), Math.abs(end.column - start.column));
  const dr = Math.sign(end.row - start.row), dc = Math.sign(end.column - start.column);
  return Array.from({ length: length + 1 }, (_, index) => ({ row: start.row + dr * index, column: start.column + dc * index }));
};

export async function renderWordSearch(root, store) {
  let session;
  session = createSession({
    root, game: 'word-search', store, createPuzzle: generateWordSearch, createPlay: createWordSearchState,
    progressed: (play) => Boolean(play?.found?.length), validateRun: validateWordSearchRun,
    onRender: (nextStore) => renderWordSearch(root, nextStore),
  });
  if (session.cancelled) {
    renderReplacementKept(root, 'word-search', session.existingDifficulty);
    return;
  }
  let state = persisted(session.run.puzzle.definition, session.run.puzzle.play, session.run.assisted);
  const shell = sharedShell({ title: 'Word Search', difficulty: session.difficulty });
  const instructions = element('details', { 'data-instructions': '' }, element('summary', { text: 'How to play' }),
    element('p', { text: 'Drag from the first letter to the last. With a keyboard, use arrows and press Space or Enter at both endpoints.' }));
  const layout = element('div', { class: 'word-search-layout' });
  const board = element('div', { class: 'game-board word-search-board', role: 'grid', 'aria-label': `${state.definition.theme} word search` });
  board.setAttribute('style', `--word-search-size:${state.definition.size}`);
  const words = element('ul', { class: 'word-search-list', 'aria-label': 'Words to find' });
  const hint = element('button', { type: 'button', 'data-hint': '', text: 'Hint' });
  const check = element('button', { type: 'button', 'data-check': '', text: 'Check' });
  const controls = element('div', { class: 'game-controls' }, hint, check);
  const boardScroll = element('div', { class: 'game-board-scroll' }, board);
  layout.append(boardScroll, element('section', {}, element('h2', { text: state.definition.theme }), words));
  root.replaceChildren(shell.toolbar, shell.notice, instructions, layout, controls, shell.live);
  let drag = null, completed = false;

  const coordinateForTarget = (target) => {
    let node = target;
    while (node && !node.dataset?.cell) node = node.parentNode;
    if (!node?.dataset?.cell) return null;
    const [row, column] = node.dataset.cell.split(':').map(Number);
    return { row, column };
  };
  const hitCoordinate = (event) => coordinateForTarget(document.elementFromPoint(event.clientX ?? 0, event.clientY ?? 0));
  const removeDragListeners = () => {
    document.removeEventListener('pointermove', pointerMove);
    document.removeEventListener('pointerup', pointerEnd);
    document.removeEventListener('pointercancel', pointerCancel);
  };
  const clearDrag = (cancelled = false) => {
    if (!drag) return;
    drag = null;
    removeDragListeners();
    if (cancelled) {
      state = { ...state, start: null, preview: null };
      session.updatePlay(state); draw();
    }
  };
  const pointerMove = (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const coordinate = hitCoordinate(event);
    if (!coordinate) return;
    drag.last = coordinate;
    dispatch({ type: 'preview', end: coordinate });
  };
  const pointerEnd = (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const { start, last } = drag;
    const end = hitCoordinate(event) ?? last;
    clearDrag();
    if (end) dispatch({ type: 'select-endpoints', start, end });
  };
  const pointerCancel = (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    clearDrag(true);
  };
  const pointerStart = (event, coordinate) => {
    if (drag) clearDrag(true);
    drag = { pointerId: event.pointerId, start: coordinate, last: coordinate };
    document.addEventListener('pointermove', pointerMove);
    document.addEventListener('pointerup', pointerEnd);
    document.addEventListener('pointercancel', pointerCancel);
    state = { ...state, start: coordinate, preview: coordinate };
    session.updatePlay(state); draw();
    event.preventDefault();
  };
  session.addCleanup(() => clearDrag());

  const foundCells = () => state.definition.placements.filter(({ word }) => state.found.includes(word)).flatMap((placement) => cellsOnLine(placement.start, placement.end).map(keyFor));
  const draw = () => {
    board.replaceChildren(); words.replaceChildren();
    const preview = cellsOnLine(state.start, state.preview).map(keyFor);
    const solved = foundCells();
    state.definition.grid.forEach((row, rowIndex) => {
      const rowNode = element('div', { role: 'row', class: 'word-search-row' });
      row.forEach((letter, columnIndex) => {
      const coordinate = { row: rowIndex, column: columnIndex }, key = keyFor(coordinate);
      const button = element('button', {
        type: 'button',
        'aria-label': `${letter}, row ${rowIndex + 1}, column ${columnIndex + 1}${solved.includes(key) ? ', found' : ''}`,
        class: `word-search-cell${preview.includes(key) ? ' is-preview' : ''}${solved.includes(key) ? ' is-found' : ''}`,
        'data-cell': key, tabindex: same(state.focus, coordinate) ? '0' : '-1', text: letter,
      });
      button.addEventListener('focus', () => { state = { ...state, focus: coordinate }; });
      button.addEventListener('pointerdown', (event) => pointerStart(event, coordinate));
      button.addEventListener('lostpointercapture', pointerCancel);
      button.addEventListener('keydown', keydown);
      rowNode.append(element('div', {
        role: 'gridcell', class: 'word-search-gridcell', 'aria-rowindex': rowIndex + 1,
        'aria-colindex': columnIndex + 1,
      }, button));
      });
      board.append(rowNode);
    });
    state.definition.placements.forEach(({ word }) => words.append(element('li', {
      class: state.found.includes(word) ? 'is-found' : '', text: word,
    })));
    shell.timer.textContent = formatElapsed(visibleElapsedMs(session.run, Date.now()));
    if (state.completed && !completed) {
      completed = true; const result = session.finish();
      const completion = completionPanel({ ...result, playAnother: session.playAnother });
      root.append(completion.panel); shell.live.textContent = 'Word Search complete.'; completion.heading.focus();
    }
  };
  const dispatch = (action, focus = false) => {
    const before = state.found.length; const next = reduceWordSearch(state, action); if (next === state) return;
    state = next;
    if (action.type === 'hint' || action.type === 'check') session.assist();
    session.updatePlay(state); draw();
    if (state.found.length > before && !state.completed) shell.live.textContent = `${state.lastFound} found.`;
    if (focus && !state.completed) board.querySelector(`[data-cell="${keyFor(state.focus)}"]`)?.focus();
  };
  const keydown = (event) => {
    const { row, column } = state.focus; const key = event.key;
    if (key === 'ArrowUp') dispatch({ type: 'move', row: row - 1, column }, true);
    else if (key === 'ArrowDown') dispatch({ type: 'move', row: row + 1, column }, true);
    else if (key === 'ArrowLeft') dispatch({ type: 'move', row, column: column - 1 }, true);
    else if (key === 'ArrowRight') dispatch({ type: 'move', row, column: column + 1 }, true);
    else if (key === ' ' || key === 'Enter') dispatch({ type: 'select' }, true); else return;
    event.preventDefault();
  };
  hint.addEventListener('click', () => dispatch({ type: 'hint' }));
  check.addEventListener('click', () => { dispatch({ type: 'check' }); shell.live.textContent = `${state.definition.placements.length - state.found.length} words remaining.`; });
  shell.toolbar.querySelector('[data-new-game]').addEventListener('click', () => { if (!state.found.length || window.confirm('Replace this puzzle?')) void session.playAnother(); });
  shell.select.addEventListener('change', () => { globalThis.location.href = `/games/word-search?difficulty=${shell.select.value}`; });
  draw();
  session.repeat(() => { if (!completed) shell.timer.textContent = formatElapsed(visibleElapsedMs(session.run, Date.now())); }, 1000);
}
