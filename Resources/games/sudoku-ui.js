import { generateSudoku, isValidSudokuBoard, solveSudoku } from './sudoku.js';
import { celebrate } from './celebration.js';
import { createGameAudio } from './game-audio.js';
import {
  completionPanel, createAudioControls, createConfirmDialog, createSession, element,
  formatElapsed, makeGameTerminal, prefersReducedMotion, renderReplacementKept, sharedShell,
} from './controller-common.js';

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
      || !isValidSudokuBoard(definition.solution)
      || definition.puzzle.some((value, index) => value && value !== definition.solution[index])) return false;
  const solved = solveSudoku(definition.puzzle, 2).solutions;
  if (solved.length !== 1 || solved[0].some((value, index) => value !== definition.solution[index])) return false;
  const play = payload.play;
  if (play == null) return true;
  const validBoardState = (values, notes) => Array.isArray(values) && values.length === 81
    && values.every((value) => validDigit(value))
    && Array.isArray(notes) && notes.length === 81
    && notes.every((cellNotes, index) => Array.isArray(cellNotes)
      && new Set(cellNotes).size === cellNotes.length
      && cellNotes.every((value) => validDigit(value, false))
      && (values[index] === 0 || cellNotes.length === 0)
      && (definition.puzzle[index] === 0 || values[index] === definition.puzzle[index]));
  const validSnapshot = (snapshot) => snapshot
    && validBoardState(snapshot.values, snapshot.notes);
  const isComplete = Array.isArray(play.values) && play.values.length === 81
    && play.values.every((value, index) => value === definition.solution[index]);
  return validBoardState(play.values, play.notes)
    && Number.isInteger(play.selected) && play.selected >= 0 && play.selected < 81
    && Array.isArray(play.errors) && play.errors.every((index) => Number.isInteger(index) && index >= 0 && index < 81)
    && Array.isArray(play.history) && play.history.every(validSnapshot)
    && typeof play.pencil === 'boolean' && play.completed === isComplete
    && typeof play.assisted === 'boolean';
}

const snapshot = (state) => ({ values: [...state.values], notes: state.notes.map((notes) => [...notes]) });

export function reduceSudoku(state, action) {
  if (state.completed) return state;
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
  shell.setAssisted(state.assisted);
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
  const numberPadButtons = [...numberPad.querySelectorAll('[data-number]')];
  const boardScroll = element('div', { class: 'game-board-scroll' }, board);

  // Effects-only audio: lazily started on the player's first gesture (a
  // click/keydown inside dispatch()) so we never call AudioContext.resume()
  // before a user gesture has actually happened.
  const puzzleAudio = createGameAudio({ preferences: store.audio });
  let audioStarted = false;
  const ensurePuzzleAudioStarted = () => {
    if (audioStarted) return;
    audioStarted = true;
    void puzzleAudio.start({});
  };
  const audioControls = createAudioControls({
    channels: ['effects'],
    preferences: store.audio,
    onChange: (preferences) => {
      puzzleAudio.setPreferences(preferences);
      session.setAudio(preferences);
    },
  });
  session.addCleanup(() => {
    audioControls.dispose();
    if (!completed) void puzzleAudio.dispose();
  });

  root.replaceChildren(shell.toolbar, shell.notice, shell.assistedStatus, instructions, boardScroll, controls, audioControls.element, shell.live);

  // Build the 81 cell buttons (and their wrappers + fixed 9-slot notes grids)
  // once. draw() below only ever patches attributes/classes/content on these
  // same nodes so identity survives across dispatches.
  const cellButtons = [];
  const cellWrappers = [];
  const noteSpansByCell = [];
  const notesGridByCell = [];
  for (let row = 0; row < 9; row += 1) {
    const rowNode = element('div', { role: 'row', class: 'sudoku-row' });
    for (let column = 0; column < 9; column += 1) {
      const index = row * 9 + column;
      const cell = element('button', { type: 'button', 'data-cell': index });
      cell.addEventListener('click', () => dispatch({ type: 'select', index }, true));
      // Deferred reference: keydown is declared later in this function, so
      // wrap it instead of passing the (not-yet-initialized) binding directly.
      cell.addEventListener('keydown', (event) => keydown(event));
      const noteSpans = Array.from({ length: 9 }, () => element('span', { class: 'sudoku-note' }));
      noteSpansByCell[index] = noteSpans;
      notesGridByCell[index] = element('div', { class: 'sudoku-notes-grid' }, ...noteSpans);
      const wrapper = element('div', {
        role: 'gridcell', class: 'sudoku-gridcell', 'aria-rowindex': row + 1, 'aria-colindex': column + 1,
      }, cell);
      rowNode.append(wrapper);
      cellButtons[index] = cell;
      cellWrappers[index] = wrapper;
    }
    board.append(rowNode);
  }

  let completed = false;
  const draw = () => {
    const selectedRow = Math.floor(state.selected / 9), selectedColumn = state.selected % 9;
    const selectedValue = state.values[state.selected];
    for (let row = 0; row < 9; row += 1) {
      for (let column = 0; column < 9; column += 1) {
        const index = row * 9 + column, value = state.values[index];
        const given = state.definition.puzzle[index] !== 0;
        const related = row === selectedRow || column === selectedColumn
          || (Math.floor(row / 3) === Math.floor(selectedRow / 3) && Math.floor(column / 3) === Math.floor(selectedColumn / 3));
        const isSelected = index === state.selected;
        const isError = state.errors.includes(index);
        const sameDigit = selectedValue !== 0 && value === selectedValue;
        const noteText = !value && state.notes[index].length ? `, pencil notes ${state.notes[index].join(', ')}` : '';
        const label = `Row ${row + 1}, column ${column + 1}${given ? ', given' : ', editable'}${value ? `, ${value}` : ', empty'}${noteText}${isError ? ', mistake' : ''}`;
        const cell = cellButtons[index];
        cell.className = `sudoku-cell${given ? ' is-given' : ''}${related ? ' is-related' : ''}${isSelected ? ' is-selected' : ''}${isError ? ' is-error' : ''}${sameDigit ? ' is-same-digit' : ''}`;
        cell.setAttribute('aria-label', label);
        cell.setAttribute('tabindex', isSelected ? '0' : '-1');
        cellWrappers[index].setAttribute('aria-selected', String(isSelected));
        if (!value && state.notes[index].length) {
          const noteSpans = noteSpansByCell[index];
          for (let digit = 1; digit <= 9; digit += 1) {
            noteSpans[digit - 1].textContent = state.notes[index].includes(digit) ? String(digit) : '';
          }
          cell.replaceChildren(notesGridByCell[index]);
        } else {
          cell.textContent = value ? String(value) : '';
        }
      }
    }
    const digitCounts = Array(10).fill(0);
    for (const value of state.values) if (value) digitCounts[value] += 1;
    for (let digit = 1; digit <= 9; digit += 1) numberPadButtons[digit - 1].disabled = digitCounts[digit] >= 9;
    pencil.setAttribute('aria-pressed', String(state.pencil));
    shell.timer.textContent = formatElapsed(session.elapsed());
    if (state.completed && !completed) {
      completed = true;
      puzzleAudio.finish({ outcome: 'completion' });
      const reducedMotion = prefersReducedMotion();
      const lastRow = Math.floor(state.selected / 9), lastColumn = state.selected % 9;
      for (let index = 0; index < 81; index += 1) {
        const distance = reducedMotion ? 0 : Math.abs(Math.floor(index / 9) - lastRow) + Math.abs(index % 9 - lastColumn);
        cellButtons[index].classList.add('is-celebrating');
        cellButtons[index].style.setProperty('--cell-delay', `${distance * 20}ms`);
      }
      celebrate({ root });
      const result = session.finish();
      makeGameTerminal(root);
      const completion = completionPanel({ ...result, playAnother: session.playAnother });
      root.append(completion.panel);
      shell.live.textContent = 'Sudoku complete.';
      completion.heading.focus();
    }
  };
  const dispatch = (action, focus = false) => {
    if (completed || state.completed || session.finished) return;
    const previousErrors = state.errors;
    const wasPencil = state.pencil;
    const next = reduceSudoku(state, action);
    if (next === state) return;
    state = next;
    ensurePuzzleAudioStarted();
    if (action.type === 'digit' && !wasPencil) puzzleAudio.playEffect('puzzle-place');
    if (action.type === 'check') {
      for (const index of state.errors) {
        if (!previousErrors.includes(index)) puzzleAudio.playEffect('puzzle-error');
      }
    }
    if (action.type === 'reveal' || action.type === 'check') {
      session.assist();
      shell.setAssisted(true, true);
    }
    if (action.type === 'reveal') shell.live.textContent = 'Hint revealed. Assisted run; this time is ineligible for best-time records.';
    session.updatePlay(state);
    draw();
    if (focus && !state.completed) cellButtons[state.selected]?.focus();
  };
  const keydown = (event) => {
    const key = event.key;
    const row = Math.floor(state.selected / 9), column = state.selected % 9;
    if (/^[1-9]$/.test(key)) dispatch({ type: 'digit', value: Number(key) }, true);
    else if (key === 'ArrowUp') dispatch({ type: 'move', row: row - 1, column }, true);
    else if (key === 'ArrowDown') dispatch({ type: 'move', row: row + 1, column }, true);
    else if (key === 'ArrowLeft') dispatch({ type: 'move', row, column: column - 1 }, true);
    else if (key === 'ArrowRight') dispatch({ type: 'move', row, column: column + 1 }, true);
    else if (key === 'Backspace' || key === 'Delete') dispatch({ type: 'erase' }, true);
    else if (key.toLowerCase() === 'p') dispatch({ type: 'toggle-pencil' }, true);
    else if (key.toLowerCase() === 'u') dispatch({ type: 'undo' }, true); else return;
    event.preventDefault();
  };
  numberPad.querySelectorAll('[data-number]').forEach((button) => button.addEventListener('click', () => dispatch({ type: 'digit', value: Number(button.dataset.number) })));
  pencil.addEventListener('click', () => dispatch({ type: 'toggle-pencil' }));
  undo.addEventListener('click', () => dispatch({ type: 'undo' }));
  erase.addEventListener('click', () => dispatch({ type: 'erase' }));
  hint.addEventListener('click', () => dispatch({ type: 'reveal' }));
  check.addEventListener('click', () => { dispatch({ type: 'check' }); shell.live.textContent = `${state.errors.length} errors found. Assisted run; this time is ineligible for best-time records.`; });
  shell.toolbar.querySelector('[data-restart]').addEventListener('click', () => {
    const dialog = createConfirmDialog(root, {
      title: 'Restart this puzzle?', body: 'Current progress will be cleared.',
      confirmLabel: 'Restart', cancelLabel: 'Cancel',
      onConfirm: () => { void session.restart(); }, onCancel: () => {},
    });
    dialog.open();
  });
  shell.toolbar.querySelector('[data-new-game]').addEventListener('click', () => {
    if (!state.history.length) { void session.playAnother(); return; }
    const dialog = createConfirmDialog(root, {
      title: 'Replace this puzzle?', body: 'Current progress will be cleared.',
      confirmLabel: 'New Game', cancelLabel: 'Cancel',
      onConfirm: () => { void session.playAnother(); }, onCancel: () => {},
    });
    dialog.open();
  });
  shell.select.addEventListener('change', () => { globalThis.location.href = `/games/sudoku?difficulty=${shell.select.value}`; });
  draw();
  session.repeat(() => { if (!completed) shell.timer.textContent = formatElapsed(session.elapsed()); }, 1000);
}
