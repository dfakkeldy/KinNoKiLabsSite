import { findSelection, generateWordSearch } from './word-search.js';
import { visibleElapsedMs } from './core.js';
import { completionPanel, createSession, element, formatElapsed, sharedShell } from './controller-common.js';

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
    game: 'word-search', store, createPuzzle: generateWordSearch, createPlay: createWordSearchState,
    progressed: (play) => Boolean(play?.found?.length), onRender: (nextStore) => renderWordSearch(root, nextStore),
  });
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
  layout.append(board, element('section', {}, element('h2', { text: state.definition.theme }), words));
  root.replaceChildren(shell.toolbar, shell.notice, instructions, layout, controls, shell.live);
  let pointerStart = null, completed = false;

  const foundCells = () => state.definition.placements.filter(({ word }) => state.found.includes(word)).flatMap((placement) => cellsOnLine(placement.start, placement.end).map(keyFor));
  const draw = () => {
    board.replaceChildren(); words.replaceChildren();
    const preview = cellsOnLine(state.start, state.preview).map(keyFor);
    const solved = foundCells();
    state.definition.grid.forEach((row, rowIndex) => row.forEach((letter, columnIndex) => {
      const coordinate = { row: rowIndex, column: columnIndex }, key = keyFor(coordinate);
      const button = element('button', {
        type: 'button', role: 'gridcell', 'aria-rowindex': rowIndex + 1, 'aria-colindex': columnIndex + 1,
        'aria-label': `${letter}, row ${rowIndex + 1}, column ${columnIndex + 1}${solved.includes(key) ? ', found' : ''}`,
        class: `word-search-cell${preview.includes(key) ? ' is-preview' : ''}${solved.includes(key) ? ' is-found' : ''}`,
        'data-cell': key, tabindex: same(state.focus, coordinate) ? '0' : '-1', text: letter,
      });
      button.addEventListener('focus', () => { state = { ...state, focus: coordinate }; });
      button.addEventListener('pointerdown', (event) => { pointerStart = coordinate; state = { ...state, start: coordinate, preview: coordinate }; draw(); event.preventDefault(); });
      button.addEventListener('pointerenter', () => { if (pointerStart) dispatch({ type: 'preview', end: coordinate }); });
      button.addEventListener('pointerup', () => { if (pointerStart) { dispatch({ type: 'select-endpoints', start: pointerStart, end: coordinate }); pointerStart = null; } });
      button.addEventListener('keydown', keydown);
      board.append(button);
    }));
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
  shell.toolbar.querySelector('[data-new-game]').addEventListener('click', () => { if (!state.found.length || window.confirm('Replace this puzzle?')) session.playAnother(); });
  shell.select.addEventListener('change', () => { globalThis.location.href = `/games/word-search?difficulty=${shell.select.value}`; });
  draw();
  const timerHandle = setInterval(() => { if (!completed) shell.timer.textContent = formatElapsed(visibleElapsedMs(session.run, Date.now())); }, 1000); timerHandle.unref?.();
}
