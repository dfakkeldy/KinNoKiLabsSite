import { generateCrossword } from './crossword.js';
import { visibleElapsedMs } from './core.js';
import { completionPanel, createSession, element, formatElapsed, sharedShell } from './controller-common.js';

const directions = { across: [0, 1], down: [1, 0] };
const keyFor = ({ row, column }) => `${row}:${column}`;

export function createCrosswordState(definition) {
  const first = definition.answers[0];
  return {
    definition,
    values: definition.cells.map((row) => row.map((cell) => (cell ? '' : null))),
    selected: { row: first.row, column: first.column },
    direction: first.direction,
    errors: [], assisted: false, completed: false,
  };
}

const entryFor = (state, direction = state.direction) => {
  const cell = state.definition.cells[state.selected.row]?.[state.selected.column];
  const number = cell?.[direction];
  return state.definition.answers.find((answer) => answer.number === number && answer.direction === direction)
    ?? state.definition.answers.find((answer) => answer.number === cell?.across && answer.direction === 'across')
    ?? state.definition.answers.find((answer) => answer.number === cell?.down && answer.direction === 'down');
};

const positions = (answer) => {
  const [dr, dc] = directions[answer.direction];
  return [...answer.answer].map((_, index) => ({ row: answer.row + dr * index, column: answer.column + dc * index }));
};

const complete = (state) => state.definition.cells.every((row, rowIndex) => row.every((cell, columnIndex) => (
  !cell || state.values[rowIndex][columnIndex] === cell.solution
)));

const moveWithinEntry = (state, delta) => {
  const entry = entryFor(state);
  if (!entry) return state.selected;
  const cells = positions(entry);
  const current = cells.findIndex((cell) => keyFor(cell) === keyFor(state.selected));
  return cells[Math.max(0, Math.min(cells.length - 1, current + delta))];
};

export function reduceCrossword(state, action) {
  if (action.type === 'select') {
    const cell = state.definition.cells[action.row]?.[action.column];
    if (!cell) return state;
    let direction = action.direction ?? state.direction;
    if (!action.direction && action.row === state.selected.row && action.column === state.selected.column && cell.across && cell.down) {
      direction = state.direction === 'across' ? 'down' : 'across';
    } else if (!cell[direction]) direction = cell.across ? 'across' : 'down';
    return { ...state, selected: { row: action.row, column: action.column }, direction };
  }
  if (action.type === 'move') {
    const row = Math.max(0, Math.min(state.definition.size - 1, action.row));
    const column = Math.max(0, Math.min(state.definition.size - 1, action.column));
    return state.definition.cells[row][column] ? { ...state, selected: { row, column } } : state;
  }
  if (action.type === 'next-entry') {
    const current = entryFor(state);
    const index = state.definition.answers.indexOf(current);
    const entry = state.definition.answers[(index + action.delta + state.definition.answers.length) % state.definition.answers.length];
    return { ...state, selected: { row: entry.row, column: entry.column }, direction: entry.direction };
  }
  if (action.type === 'letter' && /^[A-Za-z]$/.test(action.value)) {
    const values = state.values.map((row) => [...row]);
    values[state.selected.row][state.selected.column] = action.value.toUpperCase();
    const next = { ...state, values, errors: state.errors.filter((key) => key !== keyFor(state.selected)) };
    next.selected = moveWithinEntry(next, 1);
    return { ...next, completed: complete(next) };
  }
  if (action.type === 'erase') {
    const values = state.values.map((row) => [...row]);
    if (values[state.selected.row][state.selected.column]) values[state.selected.row][state.selected.column] = '';
    else {
      const previous = moveWithinEntry(state, -1);
      values[previous.row][previous.column] = '';
      return { ...state, values, selected: previous, completed: false };
    }
    return { ...state, values, completed: false };
  }
  if (action.type === 'reveal') {
    const values = state.values.map((row) => [...row]);
    values[state.selected.row][state.selected.column] = state.definition.cells[state.selected.row][state.selected.column].solution;
    const next = { ...state, values, assisted: true, errors: state.errors.filter((key) => key !== keyFor(state.selected)) };
    return { ...next, completed: complete(next) };
  }
  if (action.type === 'check-entry' || action.type === 'check-all') {
    const checked = action.type === 'check-entry' ? new Set(positions(entryFor(state)).map(keyFor)) : null;
    const errors = [];
    state.definition.cells.forEach((row, rowIndex) => row.forEach((cell, columnIndex) => {
      const key = `${rowIndex}:${columnIndex}`;
      const value = state.values[rowIndex][columnIndex];
      if (cell && value && value !== cell.solution && (!checked || checked.has(key))) errors.push(key);
    }));
    return { ...state, errors, assisted: true, completed: complete(state) };
  }
  return state;
}

const persisted = (definition, play, assisted) => ({
  ...createCrosswordState(definition), ...(play ?? {}), definition,
  assisted: assisted || play?.assisted === true,
});

export async function renderCrossword(root, store) {
  let session;
  session = createSession({
    game: 'crossword', store, createPuzzle: generateCrossword, createPlay: createCrosswordState,
    progressed: (play) => play?.values?.some((row) => row.some(Boolean)),
    onRender: (nextStore) => renderCrossword(root, nextStore),
  });
  let state = persisted(session.run.puzzle.definition, session.run.puzzle.play, session.run.assisted);
  const shell = sharedShell({ title: 'Crossword', difficulty: session.difficulty });
  const instructions = element('details', { 'data-instructions': '' }, element('summary', { text: 'How to play' }),
    element('p', { text: 'Type letters. Arrow keys move, Backspace erases, Tab moves through clues, and selecting a crossing twice changes direction.' }));
  const layout = element('div', { class: 'crossword-layout' });
  const board = element('div', { class: 'game-board crossword-board', role: 'grid', 'aria-label': 'Crossword puzzle' });
  board.setAttribute('style', `--crossword-size:${state.definition.size}`);
  const clues = element('div', { class: 'crossword-clues' });
  for (const direction of ['across', 'down']) {
    const list = element('ol', { 'aria-label': direction === 'across' ? 'Across clues' : 'Down clues' });
    state.definition.answers.filter((answer) => answer.direction === direction).forEach((answer) => {
      const button = element('button', { type: 'button', 'data-clue': `${answer.number}:${direction}`, text: `${answer.number}. ${answer.clue}` });
      button.addEventListener('click', () => dispatch({ type: 'select', row: answer.row, column: answer.column, direction }, true));
      list.append(element('li', {}, button));
    });
    clues.append(element('section', {}, element('h2', { text: direction === 'across' ? 'Across' : 'Down' }), list));
  }
  layout.append(board, clues);
  const hint = element('button', { type: 'button', 'data-hint': '', text: 'Reveal Letter' });
  const check = element('button', { type: 'button', 'data-check': '', text: 'Check Entry' });
  const checkAll = element('button', { type: 'button', 'data-check-all': '', text: 'Check Puzzle' });
  const controls = element('div', { class: 'game-controls' }, hint, check, checkAll);
  root.replaceChildren(shell.toolbar, shell.notice, instructions, layout, controls, shell.live);
  let completed = false;

  const announceEntry = () => {
    const answer = entryFor(state);
    if (answer) shell.live.textContent = `${answer.number} ${answer.direction}. ${answer.clue}`;
  };
  const draw = () => {
    board.replaceChildren();
    state.definition.cells.forEach((row, rowIndex) => row.forEach((cell, columnIndex) => {
      if (!cell) return;
      const selected = rowIndex === state.selected.row && columnIndex === state.selected.column;
      const answer = cell[state.direction];
      const input = element('input', {
        class: `crossword-cell${selected ? ' is-selected' : ''}${state.errors.includes(`${rowIndex}:${columnIndex}`) ? ' is-error' : ''}`,
        role: 'gridcell', 'aria-rowindex': rowIndex + 1, 'aria-colindex': columnIndex + 1,
        'aria-label': `${cell.number ? `${cell.number}, ` : ''}row ${rowIndex + 1}, column ${columnIndex + 1}${answer ? `, ${state.direction}` : ''}`,
        maxlength: '1', value: state.values[rowIndex][columnIndex], 'data-cell': `${rowIndex}:${columnIndex}`,
        tabindex: selected ? '0' : '-1',
      });
      input.setAttribute('style', `grid-row:${rowIndex + 1};grid-column:${columnIndex + 1}`);
      input.addEventListener('click', () => dispatch({ type: 'select', row: rowIndex, column: columnIndex }, true));
      input.addEventListener('keydown', keydown);
      board.append(input);
    }));
    shell.timer.textContent = formatElapsed(visibleElapsedMs(session.run, Date.now()));
    if (state.completed && !completed) {
      completed = true; const result = session.finish();
      const completion = completionPanel({ ...result, playAnother: session.playAnother });
      root.append(completion.panel); shell.live.textContent = 'Crossword complete.'; completion.heading.focus();
    }
  };
  const dispatch = (action, focus = false) => {
    const next = reduceCrossword(state, action); if (next === state) return;
    state = next;
    if (['reveal', 'check-entry', 'check-all'].includes(action.type)) session.assist();
    session.updatePlay(state); draw();
    if (!state.completed) announceEntry();
    if (focus && !state.completed) board.querySelector(`[data-cell="${keyFor(state.selected)}"]`)?.focus();
  };
  const keydown = (event) => {
    const { row, column } = state.selected; const key = event.key;
    if (/^[A-Za-z]$/.test(key)) dispatch({ type: 'letter', value: key }, true);
    else if (key === 'Backspace' || key === 'Delete') dispatch({ type: 'erase' }, true);
    else if (key === 'ArrowUp') dispatch({ type: 'move', row: row - 1, column }, true);
    else if (key === 'ArrowDown') dispatch({ type: 'move', row: row + 1, column }, true);
    else if (key === 'ArrowLeft') dispatch({ type: 'move', row, column: column - 1 }, true);
    else if (key === 'ArrowRight') dispatch({ type: 'move', row, column: column + 1 }, true);
    else if (key === 'Tab') dispatch({ type: 'next-entry', delta: event.shiftKey ? -1 : 1 }, true); else return;
    event.preventDefault();
  };
  hint.addEventListener('click', () => dispatch({ type: 'reveal' }));
  check.addEventListener('click', () => { dispatch({ type: 'check-entry' }); shell.live.textContent = `${state.errors.length} errors in this entry.`; });
  checkAll.addEventListener('click', () => { dispatch({ type: 'check-all' }); shell.live.textContent = `${state.errors.length} errors in the puzzle.`; });
  shell.toolbar.querySelector('[data-new-game]').addEventListener('click', () => { if (!state.values.some((row) => row.some(Boolean)) || window.confirm('Replace this puzzle?')) session.playAnother(); });
  shell.select.addEventListener('change', () => { globalThis.location.href = `/games/crossword?difficulty=${shell.select.value}`; });
  draw(); announceEntry();
  const timerHandle = setInterval(() => { if (!completed) shell.timer.textContent = formatElapsed(visibleElapsedMs(session.run, Date.now())); }, 1000); timerHandle.unref?.();
}
