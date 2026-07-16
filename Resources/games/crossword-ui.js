import { generateCrossword, validateCrossword } from './crossword.js';
import { celebrate } from './celebration.js';
import { createGameAudio } from './game-audio.js';
import {
  completionPanel, createAudioControls, createConfirmDialog, createSession, element,
  formatElapsed, makeGameTerminal, prefersReducedMotion, renderReplacementKept, sharedShell,
} from './controller-common.js';

const directions = { across: [0, 1], down: [1, 0] };
const keyFor = ({ row, column }) => `${row}:${column}`;
const clueKeyFor = (answer) => `${answer.number}:${answer.direction}`;

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

export function validateCrosswordRun(payload, difficulty) {
  const definition = payload?.definition;
  if (!definition || definition.difficulty !== difficulty || !Number.isInteger(definition.seed)
      || definition.seed < 0 || !Number.isInteger(definition.size) || definition.size < 1
      || !Array.isArray(definition.cells) || definition.cells.length !== definition.size
      || definition.cells.some((row) => !Array.isArray(row) || row.length !== definition.size)
      || !Array.isArray(definition.answers) || definition.answers.length < 1
      || !validateCrossword(definition).valid
      || definition.cells.flat().some((cell) => cell !== null && (!cell || !/^[A-Z]$/.test(cell.solution ?? '')))) return false;
  const play = payload.play;
  if (play == null) return true;
  const occupied = (row, column) => definition.cells[row]?.[column] != null;
  const isComplete = Array.isArray(play.values) && play.values.length === definition.size
    && definition.cells.every((row, rowIndex) => row.every((cell, columnIndex) => (
      !cell || play.values[rowIndex]?.[columnIndex] === cell.solution
    )));
  return Array.isArray(play.values) && play.values.length === definition.size
    && play.values.every((row, rowIndex) => Array.isArray(row) && row.length === definition.size
      && row.every((value, columnIndex) => occupied(rowIndex, columnIndex)
        ? typeof value === 'string' && /^[A-Z]?$/.test(value) : value === null))
    && Number.isInteger(play.selected?.row) && Number.isInteger(play.selected?.column)
    && occupied(play.selected.row, play.selected.column)
    && ['across', 'down'].includes(play.direction)
    && Array.isArray(play.errors) && play.errors.every((key) => {
      if (!/^\d+:\d+$/.test(key)) return false;
      const [row, column] = key.split(':').map(Number);
      return occupied(row, column);
    })
    && play.completed === isComplete && typeof play.assisted === 'boolean';
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
  if (state.completed) return state;
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
  if (action.type === 'navigate') {
    let row = state.selected.row + action.dr, column = state.selected.column + action.dc;
    while (row >= 0 && column >= 0 && row < state.definition.size && column < state.definition.size) {
      if (state.definition.cells[row][column]) {
        return {
          ...state, selected: { row, column },
          direction: action.dr === 0 ? 'across' : 'down',
        };
      }
      row += action.dr; column += action.dc;
    }
    return state;
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
    root, game: 'crossword', store, createPuzzle: generateCrossword, createPlay: createCrosswordState,
    progressed: (play) => play?.values?.some((row) => row.some(Boolean)),
    validateRun: validateCrosswordRun,
    onRender: (nextStore) => renderCrossword(root, nextStore),
  });
  if (session.cancelled) {
    renderReplacementKept(root, 'crossword', session.existingDifficulty);
    return;
  }
  let state = persisted(session.run.puzzle.definition, session.run.puzzle.play, session.run.assisted);
  const shell = sharedShell({ title: 'Crossword', difficulty: session.difficulty });
  shell.setAssisted(state.assisted);
  const instructions = element('details', { 'data-instructions': '' }, element('summary', { text: 'How to play' }),
    element('p', { text: 'Type letters. Arrow keys move, Backspace erases, Tab moves through clues, and selecting a crossing twice changes direction.' }));
  const layout = element('div', { class: 'crossword-layout' });
  const board = element('div', { class: 'game-board crossword-board', role: 'grid', 'aria-label': 'Crossword puzzle' });
  board.setAttribute('style', `--crossword-size:${state.definition.size}`);
  const clues = element('div', { class: 'crossword-clues' });
  const clueButtons = new Map();
  for (const direction of ['across', 'down']) {
    const list = element('ul', { 'aria-label': direction === 'across' ? 'Across clues' : 'Down clues' });
    state.definition.answers.filter((answer) => answer.direction === direction).forEach((answer) => {
      const key = clueKeyFor(answer);
      const button = element('button', { type: 'button', 'data-clue': key, text: `${answer.number}. ${answer.clue}` });
      button.addEventListener('click', () => dispatch({ type: 'select', row: answer.row, column: answer.column, direction }, true));
      clueButtons.set(key, button);
      list.append(element('li', {}, button));
    });
    clues.append(element('section', {}, element('h2', { text: direction === 'across' ? 'Across' : 'Down' }), list));
  }
  const boardScroll = element('div', { class: 'game-board-scroll' }, board);
  layout.append(boardScroll, clues);
  const hint = element('button', { type: 'button', 'data-hint': '', text: 'Reveal Letter' });
  const check = element('button', { type: 'button', 'data-check': '', text: 'Check Entry' });
  const checkAll = element('button', { type: 'button', 'data-check-all': '', text: 'Check Puzzle' });
  const controls = element('div', { class: 'game-controls' }, hint, check, checkAll);

  // Effects-only audio: lazily started on the player's first gesture (a
  // click/keydown inside dispatch()) so we never call AudioContext.resume()
  // before a user gesture has actually happened. Mirrors sudoku-ui.js.
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

  root.replaceChildren(shell.toolbar, shell.notice, shell.assistedStatus, instructions, layout, controls, audioControls.element, shell.live);
  let completed = false;

  // Build the grid inputs (and their number markers) once. draw() below only
  // ever patches attributes/classes/value on these same nodes so cell and
  // clue-button identity survives across dispatches, matching the sudoku
  // build-once/patch-in-place pattern.
  const cellInputs = state.definition.cells.map((row) => row.map(() => null));
  state.definition.cells.forEach((row, rowIndex) => {
    const rowNode = element('div', { role: 'row', class: 'crossword-row' });
    row.forEach((cell, columnIndex) => {
      if (!cell) return;
      const input = element('input', {
        class: 'crossword-cell', maxlength: '1', 'data-cell': `${rowIndex}:${columnIndex}`,
      });
      input.addEventListener('click', () => dispatch({ type: 'select', row: rowIndex, column: columnIndex }, true));
      // Deferred reference: keydown is declared later in this function, so
      // wrap it instead of passing the (not-yet-initialized) binding directly.
      input.addEventListener('keydown', (event) => keydown(event));
      const marker = cell.number ? element('span', {
        class: 'crossword-number', 'data-cell-number': cell.number, 'aria-hidden': 'true', text: String(cell.number),
      }) : null;
      const gridCell = element('div', {
        role: 'gridcell', class: 'crossword-gridcell', 'aria-rowindex': rowIndex + 1,
        'aria-colindex': columnIndex + 1,
      }, input, marker);
      gridCell.setAttribute('style', `grid-row:${rowIndex + 1};grid-column:${columnIndex + 1}`);
      rowNode.append(gridCell);
      cellInputs[rowIndex][columnIndex] = input;
    });
    board.append(rowNode);
  });

  const announceEntry = () => {
    const answer = entryFor(state);
    if (answer) shell.live.textContent = `${answer.number} ${answer.direction}. ${answer.clue}`;
  };
  const draw = () => {
    const activeEntry = entryFor(state);
    const activeKeys = activeEntry ? new Set(positions(activeEntry).map(keyFor)) : new Set();
    const activeClueKey = activeEntry ? clueKeyFor(activeEntry) : null;
    state.definition.cells.forEach((row, rowIndex) => row.forEach((cell, columnIndex) => {
      if (!cell) return;
      const input = cellInputs[rowIndex][columnIndex];
      const selected = rowIndex === state.selected.row && columnIndex === state.selected.column;
      const answer = cell[state.direction];
      const mistake = state.errors.includes(keyFor({ row: rowIndex, column: columnIndex }));
      const isActiveEntry = activeKeys.has(keyFor({ row: rowIndex, column: columnIndex }));
      input.className = `crossword-cell${selected ? ' is-selected' : ''}${isActiveEntry ? ' is-active-entry' : ''}${mistake ? ' is-error' : ''}`;
      input.setAttribute('aria-label', `${cell.number ? `${cell.number}, ` : ''}row ${rowIndex + 1}, column ${columnIndex + 1}${answer ? `, ${state.direction}` : ''}${mistake ? ', mistake' : ''}`);
      input.value = state.values[rowIndex][columnIndex];
      input.setAttribute('tabindex', selected ? '0' : '-1');
    }));
    for (const [key, button] of clueButtons) button.classList.toggle('is-active', key === activeClueKey);
    shell.timer.textContent = formatElapsed(session.elapsed());
    if (state.completed && !completed) {
      completed = true;
      puzzleAudio.finish({ outcome: 'completion' });
      const reducedMotion = prefersReducedMotion();
      let order = 0;
      state.definition.cells.forEach((row, rowIndex) => row.forEach((cell, columnIndex) => {
        if (!cell) return;
        const input = cellInputs[rowIndex][columnIndex];
        input.classList.add('is-celebrating');
        input.style.setProperty('--cell-delay', `${reducedMotion ? 0 : order * 20}ms`);
        order += 1;
      }));
      celebrate({ root });
      const result = session.finish(); makeGameTerminal(root);
      const completion = completionPanel({ ...result, playAnother: session.playAnother });
      root.append(completion.panel); shell.live.textContent = 'Crossword complete.'; completion.heading.focus();
    }
  };
  const dispatch = (action, focus = false) => {
    if (completed || state.completed || session.finished) return;
    const previousErrors = state.errors;
    const next = reduceCrossword(state, action); if (next === state) return;
    state = next;
    ensurePuzzleAudioStarted();
    if (action.type === 'letter') puzzleAudio.playEffect('puzzle-place');
    if (action.type === 'check-entry' || action.type === 'check-all') {
      for (const key of state.errors) {
        if (!previousErrors.includes(key)) puzzleAudio.playEffect('puzzle-error');
      }
    }
    const assistedAction = ['reveal', 'check-entry', 'check-all'].includes(action.type);
    if (assistedAction) { session.assist(); shell.setAssisted(true); }
    session.updatePlay(state); draw();
    if (!state.completed) {
      if (assistedAction) shell.setAssisted(true, true); else announceEntry();
    }
    if (focus && !state.completed) cellInputs[state.selected.row][state.selected.column]?.focus();
  };
  const keydown = (event) => {
    const { row, column } = state.selected; const key = event.key;
    if (/^[A-Za-z]$/.test(key)) dispatch({ type: 'letter', value: key }, true);
    else if (key === 'Backspace' || key === 'Delete') dispatch({ type: 'erase' }, true);
    else if (key === 'ArrowUp') dispatch({ type: 'navigate', dr: -1, dc: 0 }, true);
    else if (key === 'ArrowDown') dispatch({ type: 'navigate', dr: 1, dc: 0 }, true);
    else if (key === 'ArrowLeft') dispatch({ type: 'navigate', dr: 0, dc: -1 }, true);
    else if (key === 'ArrowRight') dispatch({ type: 'navigate', dr: 0, dc: 1 }, true);
    else if (key === ' ') dispatch({ type: 'select', row, column }, true);
    else return;
    event.preventDefault();
  };
  hint.addEventListener('click', () => dispatch({ type: 'reveal' }));
  check.addEventListener('click', () => { dispatch({ type: 'check-entry' }); shell.live.textContent = `${state.errors.length} errors in this entry. Assisted run; this time is ineligible for best-time records.`; });
  checkAll.addEventListener('click', () => { dispatch({ type: 'check-all' }); shell.live.textContent = `${state.errors.length} errors in the puzzle. Assisted run; this time is ineligible for best-time records.`; });
  shell.toolbar.querySelector('[data-restart]').addEventListener('click', () => {
    const dialog = createConfirmDialog(root, {
      title: 'Restart this puzzle?', body: 'Current progress will be cleared.',
      confirmLabel: 'Restart', cancelLabel: 'Cancel',
      onConfirm: () => { void session.restart(); }, onCancel: () => {},
    });
    dialog.open();
  });
  shell.toolbar.querySelector('[data-new-game]').addEventListener('click', () => {
    if (!state.values.some((row) => row.some(Boolean))) { void session.playAnother(); return; }
    const dialog = createConfirmDialog(root, {
      title: 'Replace this puzzle?', body: 'Current progress will be cleared.',
      confirmLabel: 'New Game', cancelLabel: 'Cancel',
      onConfirm: () => { void session.playAnother(); }, onCancel: () => {},
    });
    dialog.open();
  });
  shell.select.addEventListener('change', () => { globalThis.location.href = `/games/crossword?difficulty=${shell.select.value}`; });
  draw(); announceEntry();
  session.repeat(() => { if (!completed) shell.timer.textContent = formatElapsed(session.elapsed()); }, 1000);
}
