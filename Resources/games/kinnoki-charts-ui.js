import {
  CHARTS_SIZE_BY_DIFFICULTY, buildClues, clueRuns, createChartsPlay, createChartsPuzzle,
  reduceCharts, solveChart, validateChartsState,
} from './kinnoki-charts.js';
import { historyKey } from './core.js';
import { celebrate } from './celebration.js';
import { createGameAudio } from './game-audio.js';
import {
  completionPanel, createAudioControls, createConfirmDialog, createSession, element,
  formatElapsed, makeGameTerminal, prefersReducedMotion, renderReplacementKept, sharedShell,
} from './controller-common.js';

export function createChartsState(definition) {
  return { definition, ...createChartsPlay(definition.size) };
}

function definitionMatchesCatalog(definition, difficulty) {
  const size = CHARTS_SIZE_BY_DIFFICULTY[difficulty];
  if (!size || !definition || typeof definition !== 'object') return false;
  if (typeof definition.id !== 'string' || definition.id.length === 0) return false;
  if (typeof definition.title !== 'string' || definition.title.length === 0) return false;
  if (definition.size !== size) return false;
  if (!Array.isArray(definition.solution) || definition.solution.length !== size * size
      || !definition.solution.every((value) => value === 0 || value === 1)) return false;
  const clues = buildClues(definition.solution, size);
  if (JSON.stringify(clues) !== JSON.stringify(definition.clues)) return false;
  const solved = solveChart(clues, size);
  return solved.solvable && [...solved.grid].every((value, index) => value === definition.solution[index]);
}

export function validateChartsRun(payload, difficulty) {
  const definition = payload?.definition;
  if (!definitionMatchesCatalog(definition, difficulty)) return false;
  const play = payload?.play;
  if (play == null) return true;
  return validateChartsState(play, difficulty).valid;
}

const persisted = (definition, play) => ({
  ...createChartsState(definition),
  ...(play ?? {}),
  definition,
});

// clueRuns only looks at filled (1) cells, so a mark of 2 (marked-empty)
// reads identically to a blank (0) cell here — exactly matching how the
// engine's own completion check ignores marks.
const lineAt = (marks, size, { row, column }) => {
  const line = [];
  if (row != null) {
    for (let c = 0; c < size; c += 1) line.push(marks[row * size + c] === 1 ? 1 : 0);
  } else {
    for (let r = 0; r < size; r += 1) line.push(marks[r * size + column] === 1 ? 1 : 0);
  }
  return line;
};
const sameRuns = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);

export async function renderCharts(root, store) {
  let session;
  const createPuzzleWithHistory = ({ difficulty, seed }) => createChartsPuzzle({
    difficulty, seed, previousSignatures: store.previousSignatures?.[historyKey('kinnoki-charts')] ?? null,
  });
  session = createSession({
    root, game: 'kinnoki-charts', store, createPuzzle: createPuzzleWithHistory, createPlay: createChartsState,
    progressed: (play) => play?.marks?.some((mark) => mark !== 0),
    validateRun: validateChartsRun,
    onRender: (nextStore) => renderCharts(root, nextStore),
  });
  if (session.cancelled) {
    renderReplacementKept(root, 'kinnoki-charts', session.existingDifficulty);
    return;
  }
  let state = persisted(session.run.puzzle.definition, session.run.puzzle.play);
  const size = state.definition.size;
  const shell = sharedShell({ title: 'Kinnoki Charts', difficulty: session.difficulty });
  shell.setAssisted(session.run.assisted);
  const instructions = element('details', { 'data-instructions': '' },
    element('summary', { text: 'How to play' }),
    element('p', {
      text: 'Row clues sit to the left of the grid, column clues sit above it. Choose a '
        + 'cell and cycle it blank, filled, or marked to match the clues. Arrow keys move, '
        + 'Enter or Space cycles the selected cell, and X or M toggles a mark.',
    }));
  const corner = element('div', { class: 'charts-corner', 'aria-hidden': 'true' });
  const columnClueNodes = [];
  const columnsContainer = element('div', { class: 'charts-columns' });
  for (let column = 0; column < size; column += 1) {
    const runs = state.definition.clues.columns[column];
    const clue = element('div', {
      class: 'charts-clue charts-clue-column',
      text: runs.length ? runs.join('\n') : '0',
    });
    columnClueNodes[column] = clue;
    columnsContainer.append(clue);
  }
  const rowClueNodes = [];
  const rowsContainer = element('div', { class: 'charts-rows' });
  for (let row = 0; row < size; row += 1) {
    const runs = state.definition.clues.rows[row];
    const clue = element('div', {
      class: 'charts-clue charts-clue-row',
      text: runs.length ? runs.join(' ') : '0',
    });
    rowClueNodes[row] = clue;
    rowsContainer.append(clue);
  }
  const board = element('div', {
    class: 'charts-board', role: 'grid', 'aria-label': `${state.definition.title} nonogram puzzle`,
    'aria-rowcount': String(size), 'aria-colcount': String(size),
  });
  const layout = element('div', { class: 'charts-layout' }, corner, columnsContainer, rowsContainer, board);
  layout.style.setProperty('--charts-size', String(size));
  const boardScroll = element('div', { class: 'game-board-scroll' }, layout);
  const controls = element('div', { class: 'charts-controls' });
  const hint = element('button', { type: 'button', 'data-hint': '', text: 'Hint' });
  const check = element('button', { type: 'button', 'data-check': '', text: 'Check' });
  controls.append(hint, check);

  // Effects-only audio: lazily started on the player's first gesture (a
  // click/keydown inside dispatch()), mirroring the sudoku controller so we
  // never call AudioContext.resume() before a user gesture has happened.
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

  // Build the size*size cell buttons (and their gridcell wrappers) once.
  // draw() below only ever patches attributes/classes/content on these same
  // nodes so identity survives across dispatches.
  const cellButtons = [];
  const cellWrappers = [];
  for (let row = 0; row < size; row += 1) {
    const rowNode = element('div', { role: 'row', class: 'charts-row' });
    for (let column = 0; column < size; column += 1) {
      const index = row * size + column;
      const cell = element('button', { type: 'button', class: 'charts-cell', 'data-cell': index });
      cell.addEventListener('click', () => selectAndCycle(index));
      // Deferred reference: keydown is declared later in this function, so
      // wrap it instead of passing the (not-yet-initialized) binding directly.
      cell.addEventListener('keydown', (event) => keydown(event));
      const wrapper = element('div', {
        role: 'gridcell', class: 'charts-gridcell', 'aria-rowindex': row + 1, 'aria-colindex': column + 1,
      }, cell);
      rowNode.append(wrapper);
      cellButtons[index] = cell;
      cellWrappers[index] = wrapper;
    }
    board.append(rowNode);
  }

  let completed = false;
  const draw = () => {
    const selectedRow = Math.floor(state.selected / size), selectedColumn = state.selected % size;
    for (let row = 0; row < size; row += 1) {
      for (let column = 0; column < size; column += 1) {
        const index = row * size + column, mark = state.marks[index];
        const related = row === selectedRow || column === selectedColumn;
        const isSelected = index === state.selected;
        const isError = state.errors.includes(index);
        const stateLabel = mark === 1 ? 'filled' : mark === 2 ? 'marked empty' : 'blank';
        const cell = cellButtons[index];
        cell.className = `charts-cell${mark === 1 ? ' is-filled' : ''}${mark === 2 ? ' is-marked' : ''}`
          + `${related ? ' is-related' : ''}${isSelected ? ' is-selected' : ''}${isError ? ' is-error' : ''}`;
        cell.textContent = mark === 1 ? '■' : mark === 2 ? '×' : '';
        cell.setAttribute('aria-label', `Row ${row + 1}, column ${column + 1}, ${stateLabel}${isError ? ', mistake' : ''}`);
        cell.setAttribute('tabindex', isSelected ? '0' : '-1');
        cellWrappers[index].setAttribute('aria-selected', String(isSelected));
      }
    }
    for (let row = 0; row < size; row += 1) {
      const satisfied = sameRuns(clueRuns(lineAt(state.marks, size, { row })), state.definition.clues.rows[row]);
      rowClueNodes[row].classList.toggle('is-satisfied', satisfied);
    }
    for (let column = 0; column < size; column += 1) {
      const satisfied = sameRuns(clueRuns(lineAt(state.marks, size, { column })), state.definition.clues.columns[column]);
      columnClueNodes[column].classList.toggle('is-satisfied', satisfied);
    }
    shell.timer.textContent = formatElapsed(session.elapsed());
    if (state.completed && !completed) {
      completed = true;
      puzzleAudio.finish({ outcome: 'completion' });
      const reducedMotion = prefersReducedMotion();
      const lastRow = Math.floor(state.selected / size), lastColumn = state.selected % size;
      for (let index = 0; index < size * size; index += 1) {
        const row = Math.floor(index / size), column = index % size;
        const distance = reducedMotion ? 0 : Math.abs(row - lastRow) + Math.abs(column - lastColumn);
        if (state.definition.solution[index] === 1) {
          cellButtons[index].classList.add('is-reveal');
          cellButtons[index].style.setProperty('--cell-delay', `${distance * 20}ms`);
        } else if (state.marks[index] === 2) {
          cellButtons[index].classList.add('is-reveal-clear');
        }
      }
      celebrate({ root });
      const result = session.finish();
      makeGameTerminal(root);
      const completion = completionPanel({ ...result, playAnother: session.playAnother });
      completion.heading.textContent = `Chart revealed: ${state.definition.title}`;
      root.append(completion.panel);
      shell.live.textContent = `Chart revealed: ${state.definition.title}.`;
      completion.heading.focus();
    }
  };
  const dispatch = (action, focus = false) => {
    if (completed || state.completed || session.finished) return;
    const previousErrors = state.errors;
    const next = reduceCharts(state, action);
    if (next === state) return;
    state = next;
    ensurePuzzleAudioStarted();
    // 'cycle' (click or Enter/Space) is the only UI action that can turn a
    // cell filled; the engine's other placement actions ('fill'/'mark') are
    // not wired to any control here.
    if (action.type === 'cycle' && state.marks[state.selected] === 1) {
      puzzleAudio.playEffect('puzzle-place');
    }
    if (action.type === 'check') {
      for (const index of state.errors) {
        if (!previousErrors.includes(index)) puzzleAudio.playEffect('puzzle-error');
      }
    }
    if (action.type === 'hint' || action.type === 'check') {
      session.assist();
      shell.setAssisted(true, true);
    }
    if (action.type === 'hint') shell.live.textContent = 'Hint revealed. Assisted run; this time is ineligible for best-time records.';
    session.updatePlay(state);
    draw();
    if (focus && !state.completed) cellButtons[state.selected]?.focus();
  };
  const selectAndCycle = (index) => {
    if (completed || state.completed || session.finished) return;
    state = reduceCharts(state, { type: 'select', index });
    dispatch({ type: 'cycle' }, true);
  };
  const keydown = (event) => {
    const key = event.key;
    const row = Math.floor(state.selected / size), column = state.selected % size;
    if (key === 'ArrowUp') dispatch({ type: 'move', row: row - 1, column }, true);
    else if (key === 'ArrowDown') dispatch({ type: 'move', row: row + 1, column }, true);
    else if (key === 'ArrowLeft') dispatch({ type: 'move', row, column: column - 1 }, true);
    else if (key === 'ArrowRight') dispatch({ type: 'move', row, column: column + 1 }, true);
    else if (key === 'Enter' || key === ' ') dispatch({ type: 'cycle' }, true);
    else if (key.toLowerCase() === 'x' || key.toLowerCase() === 'm') {
      dispatch({ type: state.marks[state.selected] === 2 ? 'erase' : 'mark' }, true);
    } else return;
    event.preventDefault();
  };
  hint.addEventListener('click', () => dispatch({ type: 'hint' }));
  check.addEventListener('click', () => {
    dispatch({ type: 'check' });
    shell.live.textContent = `${state.errors.length} error${state.errors.length === 1 ? '' : 's'} found. `
      + 'Assisted run; this time is ineligible for best-time records.';
  });
  shell.toolbar.querySelector('[data-restart]').addEventListener('click', () => {
    const dialog = createConfirmDialog(root, {
      title: 'Restart this puzzle?', body: 'Current progress will be cleared.',
      confirmLabel: 'Restart', cancelLabel: 'Cancel',
      onConfirm: () => { void session.restart(); }, onCancel: () => {},
    });
    dialog.open();
  });
  shell.toolbar.querySelector('[data-new-game]').addEventListener('click', () => {
    if (!state.marks.some((mark) => mark !== 0)) { void session.playAnother(); return; }
    const dialog = createConfirmDialog(root, {
      title: 'Replace this puzzle?', body: 'Current progress will be cleared.',
      confirmLabel: 'New Game', cancelLabel: 'Cancel',
      onConfirm: () => { void session.playAnother(); }, onCancel: () => {},
    });
    dialog.open();
  });
  shell.select.addEventListener('change', () => { globalThis.location.href = `/games/kinnoki-charts?difficulty=${shell.select.value}`; });
  draw();
  session.repeat(() => { if (!completed) shell.timer.textContent = formatElapsed(session.elapsed()); }, 1000);
}
