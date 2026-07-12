import { generateSudoku } from './sudoku.js';
import { visibleElapsedMs } from './core.js';
import { completionPanel, createSession, element, formatElapsed, renderReplacementKept, sharedShell } from './controller-common.js';

const blankNotes = () => Array.from({ length: 81 }, () => []);
const complete = (state) => state.values.every((value, index) => value === state.definition.solution[index]);

export function createSudokuState(definition) {
  return {
    definition,
    values: [...definition.puzzle],
    notes: blankNotes(),
    selected: 0,
    pencil: false,
    history: [],
    errors: [],
    assisted: false,
    completed: false,
  };
}

const validDigit = (value, allowZero = true) => Number.isInteger(value) && value >= (allowZero ? 0 : 1) && value <= 9;
export function validateSudokuRun(payload, difficulty) {
  const definition = payload?.definition;
  if (!definition || definition.difficulty !== difficulty
      || !Number.isInteger(definition.seed) || definition.seed < 0
      || !Array.isArray(definition.puzzle) || definition.puzzle.length !== 81
      || !definition.puzzle.every((value) => validDigit(value))
      || !Array.isArray(definition.solution) || definition.solution.length !== 81
      || !definition.solution.every((value) => validDigit(value, false))
      || definition.puzzle.some((value, index) => value && value !== definition.solution[index])) return false;
  const play = payload.play;
  if (play == null) return true;
  const validSnapshot = (snapshot) => snapshot && Array.isArray(snapshot.values)
    && snapshot.values.length === 81 && snapshot.values.every((value) => validDigit(value))
    && Array.isArray(snapshot.notes) && snapshot.notes.length === 81
    && snapshot.notes.every((notes) => Array.isArray(notes)
      && new Set(notes).size === notes.length && notes.every((value) => validDigit(value, false)));
  return Array.isArray(play.values) && play.values.length === 81 && play.values.every((value) => validDigit(value))
    && definition.puzzle.every((value, index) => !value || play.values[index] === value)
    && Array.isArray(play.notes) && play.notes.length === 81
    && play.notes.every((notes) => Array.isArray(notes) && new Set(notes).size === notes.length
      && notes.every((value) => validDigit(value, false)))
    && Number.isInteger(play.selected) && play.selected >= 0 && play.selected < 81
    && Array.isArray(play.errors) && play.errors.every((index) => Number.isInteger(index) && index >= 0 && index < 81)
    && Array.isArray(play.history) && play.history.every(validSnapshot)
    && typeof play.pencil === 'boolean' && typeof play.completed === 'boolean'
    && typeof play.assisted === 'boolean';
}

const snapshot = (state) => ({ values: [...state.values], notes: state.notes.map((notes) => [...notes]) });

export function reduceSudoku(state, action) {
  const selected = state.selected ?? 0;
  if (action.type === 'select') return { ...state, selected: Math.max(0, Math.min(80, action.index)) };
  if (action.type === 'move') {
    const row = Math.max(0, Math.min(8, action.row));
    const column = Math.max(0, Math.min(8, action.column));
    return { ...state, selected: row * 9 + column };
  }
  if (action.type === 'toggle-pencil') return { ...state, pencil: !state.pencil };
  if (action.type === 'undo') {
    const previous = state.history.at(-1);
    return previous ? { ...state, ...previous, history: state.history.slice(0, -1), errors: [], completed: false } : state;
  }
  if (action.type === 'reveal') {
    const target = state.definition.puzzle[selected] === 0
      && state.values[selected] !== state.definition.solution[selected]
      ? selected
      : state.values.findIndex((value, index) => (
        state.definition.puzzle[index] === 0 && value !== state.definition.solution[index]
      ));
    if (target < 0) return { ...state, assisted: true };
    const values = [...state.values]; values[target] = state.definition.solution[target];
    const notes = state.notes.map((values) => [...values]); notes[target] = [];
    const next = { ...state, selected: target, values, notes, assisted: true, history: [...state.history, snapshot(state)] };
    return { ...next, completed: complete(next) };
  }
  if (state.definition.puzzle[selected] !== 0 && ['digit', 'erase'].includes(action.type)) return state;
  if (action.type === 'digit' && Number.isInteger(action.value) && action.value >= 1 && action.value <= 9) {
    const history = [...state.history, snapshot(state)];
    if (state.pencil) {
      const notes = state.notes.map((values) => [...values]);
      notes[selected] = notes[selected].includes(action.value)
        ? notes[selected].filter((value) => value !== action.value)
        : [...notes[selected], action.value].sort();
      return { ...state, notes, history };
    }
    const values = [...state.values]; values[selected] = action.value;
    const notes = state.notes.map((values) => [...values]); notes[selected] = [];
    const next = { ...state, values, notes, history, errors: state.errors.filter((index) => index !== selected) };
    return { ...next, completed: complete(next) };
  }
  if (action.type === 'erase') {
    if (!state.values[selected] && state.notes[selected].length === 0) return state;
    const values = [...state.values]; values[selected] = 0;
    const notes = state.notes.map((values) => [...values]); notes[selected] = [];
    return { ...state, values, notes, history: [...state.history, snapshot(state)], errors: [], completed: false };
  }
  if (action.type === 'check') {
    return { ...state, assisted: true, errors: state.values.flatMap((value, index) => (
      value !== 0 && value !== state.definition.solution[index] ? [index] : []
    )) };
  }
  return state;
}

const persisted = (definition, play, assisted) => ({
  ...createSudokuState(definition),
  ...(play ?? {}),
  definition,
  notes: Array.isArray(play?.notes) ? play.notes : blankNotes(),
  assisted: assisted || play?.assisted === true,
});

export async function renderSudoku(root, store) {
  let session;
  session = createSession({
    root, game: 'sudoku', store, createPuzzle: generateSudoku, createPlay: createSudokuState,
    progressed: (play) => play?.values?.some((value, index) => value !== (play.definition?.puzzle?.[index] ?? value)),
    validateRun: validateSudokuRun,
    onRender: (nextStore) => renderSudoku(root, nextStore),
  });
  if (session.cancelled) {
    renderReplacementKept(root, 'sudoku', session.existingDifficulty);
    return;
  }
  let state = persisted(session.run.puzzle.definition, session.run.puzzle.play, session.run.assisted);
  const shell = sharedShell({ title: 'Sudoku', difficulty: session.difficulty });
  const instructions = element('details', { 'data-instructions': '' },
    element('summary', { text: 'How to play' }),
    element('p', { text: 'Choose a cell and enter 1–9. Arrow keys move, P toggles pencil marks, U undoes, and Delete erases.' }));
  const board = element('div', { class: 'game-board sudoku-board', role: 'grid', 'aria-label': 'Sudoku puzzle', 'aria-rowcount': '9', 'aria-colcount': '9' });
  const controls = element('div', { class: 'game-controls' });
  const hint = element('button', { type: 'button', 'data-hint': '', text: 'Hint' });
  const check = element('button', { type: 'button', 'data-check': '', text: 'Check' });
  const pencil = element('button', { type: 'button', 'data-pencil': '', 'aria-pressed': String(state.pencil), text: 'Pencil' });
  const undo = element('button', { type: 'button', 'data-undo': '', text: 'Undo' });
  const erase = element('button', { type: 'button', 'data-erase': '', text: 'Erase' });
  const numberPad = element('div', { class: 'sudoku-number-pad', 'aria-label': 'Number pad' },
    ...Array.from({ length: 9 }, (_, index) => element('button', { type: 'button', 'data-number': index + 1, text: String(index + 1) })));
  controls.append(pencil, undo, erase, hint, check, numberPad);
  const boardScroll = element('div', { class: 'game-board-scroll' }, board);
  root.replaceChildren(shell.toolbar, shell.notice, instructions, boardScroll, controls, shell.live);

  let completed = false;
  const draw = () => {
    board.replaceChildren();
    const selectedRow = Math.floor(state.selected / 9), selectedColumn = state.selected % 9;
    for (let row = 0; row < 9; row += 1) {
      const rowNode = element('div', { role: 'row', class: 'sudoku-row' });
      for (let column = 0; column < 9; column += 1) {
      const index = row * 9 + column, value = state.values[index];
      const given = state.definition.puzzle[index] !== 0;
      const related = row === selectedRow || column === selectedColumn
        || (Math.floor(row / 3) === Math.floor(selectedRow / 3) && Math.floor(column / 3) === Math.floor(selectedColumn / 3));
      const noteText = !value && state.notes[index].length ? `, pencil notes ${state.notes[index].join(', ')}` : '';
      const label = `Row ${row + 1}, column ${column + 1}${given ? ', given' : ', editable'}${value ? `, ${value}` : ', empty'}${noteText}${state.errors.includes(index) ? ', mistake' : ''}`;
      const cell = element('button', {
        type: 'button', class: `sudoku-cell${given ? ' is-given' : ''}${related ? ' is-related' : ''}${index === state.selected ? ' is-selected' : ''}${state.errors.includes(index) ? ' is-error' : ''}`,
        'aria-label': label, 'data-cell': index,
        tabindex: index === state.selected ? '0' : '-1', text: value || state.notes[index].join(' '),
      });
      cell.addEventListener('click', () => dispatch({ type: 'select', index }, true));
      cell.addEventListener('keydown', keydown);
      rowNode.append(element('div', {
        role: 'gridcell', class: 'sudoku-gridcell', 'aria-rowindex': row + 1,
        'aria-colindex': column + 1, 'aria-selected': String(index === state.selected),
      }, cell));
      }
      board.append(rowNode);
    }
    pencil.setAttribute('aria-pressed', String(state.pencil));
    shell.timer.textContent = formatElapsed(visibleElapsedMs(session.run, Date.now()));
    if (state.completed && !completed) {
      completed = true;
      const result = session.finish();
      const completion = completionPanel({ ...result, playAnother: session.playAnother });
      root.append(completion.panel);
      shell.live.textContent = 'Sudoku complete.';
      completion.heading.focus();
    }
  };
  const dispatch = (action, focus = false) => {
    const next = reduceSudoku(state, action);
    if (next === state) return;
    state = next;
    if (action.type === 'reveal' || action.type === 'check') session.assist();
    session.updatePlay(state);
    draw();
    if (focus && !state.completed) board.querySelector(`[data-cell="${state.selected}"]`)?.focus();
  };
  const keydown = (event) => {
    const key = event.key;
    const row = Math.floor(state.selected / 9), column = state.selected % 9;
    if (/^[1-9]$/.test(key)) dispatch({ type: 'digit', value: Number(key) });
    else if (key === 'ArrowUp') dispatch({ type: 'move', row: row - 1, column }, true);
    else if (key === 'ArrowDown') dispatch({ type: 'move', row: row + 1, column }, true);
    else if (key === 'ArrowLeft') dispatch({ type: 'move', row, column: column - 1 }, true);
    else if (key === 'ArrowRight') dispatch({ type: 'move', row, column: column + 1 }, true);
    else if (key === 'Backspace' || key === 'Delete') dispatch({ type: 'erase' });
    else if (key.toLowerCase() === 'p') dispatch({ type: 'toggle-pencil' });
    else if (key.toLowerCase() === 'u') dispatch({ type: 'undo' }); else return;
    event.preventDefault();
  };
  numberPad.querySelectorAll('[data-number]').forEach((button) => button.addEventListener('click', () => dispatch({ type: 'digit', value: Number(button.dataset.number) })));
  pencil.addEventListener('click', () => dispatch({ type: 'toggle-pencil' }));
  undo.addEventListener('click', () => dispatch({ type: 'undo' }));
  erase.addEventListener('click', () => dispatch({ type: 'erase' }));
  hint.addEventListener('click', () => dispatch({ type: 'reveal' }));
  check.addEventListener('click', () => { dispatch({ type: 'check' }); shell.live.textContent = `${state.errors.length} errors found.`; });
  shell.toolbar.querySelector('[data-new-game]').addEventListener('click', () => { if (!state.history.length || window.confirm('Replace this puzzle?')) void session.playAnother(); });
  shell.select.addEventListener('change', () => { globalThis.location.href = `/games/sudoku?difficulty=${shell.select.value}`; });
  draw();
  session.repeat(() => { if (!completed) shell.timer.textContent = formatElapsed(visibleElapsedMs(session.run, Date.now())); }, 1000);
}
