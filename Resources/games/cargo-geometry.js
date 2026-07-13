import { createRng, indexedSeed } from './core.js';

export const CARGO_CATALOG = Object.freeze([
  { id: 'crate-pair', label: 'Crate pair', pattern: 'dots', cells: [{ row: 0, column: 0 }, { row: 0, column: 1 }] },
  { id: 'barge-three', label: 'Three-crate barge', pattern: 'bands', cells: [{ row: 0, column: 0 }, { row: 0, column: 1 }, { row: 0, column: 2 }] },
  { id: 'corner-three', label: 'Three-crate corner', pattern: 'diagonal', cells: [{ row: 0, column: 0 }, { row: 1, column: 0 }, { row: 1, column: 1 }] },
  { id: 'dock-square', label: 'Four-crate dock square', pattern: 'crosshatch', cells: [{ row: 0, column: 0 }, { row: 0, column: 1 }, { row: 1, column: 0 }, { row: 1, column: 1 }] },
  { id: 'hook-four', label: 'Four-crate hook', pattern: 'solid', cells: [{ row: 0, column: 0 }, { row: 1, column: 0 }, { row: 2, column: 0 }, { row: 2, column: 1 }] },
  { id: 'step-four', label: 'Four-crate step', pattern: 'dots', cells: [{ row: 0, column: 0 }, { row: 1, column: 0 }, { row: 1, column: 1 }, { row: 2, column: 1 }] },
  { id: 'fork-four', label: 'Four-crate fork', pattern: 'bands', cells: [{ row: 0, column: 1 }, { row: 1, column: 0 }, { row: 1, column: 1 }, { row: 1, column: 2 }] },
  { id: 'barge-five', label: 'Five-crate barge', pattern: 'diagonal', cells: [{ row: 0, column: 0 }, { row: 0, column: 1 }, { row: 0, column: 2 }, { row: 0, column: 3 }, { row: 0, column: 4 }] },
  { id: 'harbour-five', label: 'Five-crate harbour', pattern: 'crosshatch', cells: [{ row: 0, column: 0 }, { row: 0, column: 2 }, { row: 1, column: 0 }, { row: 1, column: 1 }, { row: 1, column: 2 }] },
  { id: 'quay-five', label: 'Five-crate quay', pattern: 'solid', cells: [{ row: 0, column: 0 }, { row: 1, column: 0 }, { row: 2, column: 0 }, { row: 2, column: 1 }, { row: 2, column: 2 }] },
  { id: 'zigzag-five', label: 'Five-crate zigzag', pattern: 'dots', cells: [{ row: 0, column: 0 }, { row: 1, column: 0 }, { row: 1, column: 1 }, { row: 2, column: 1 }, { row: 2, column: 2 }] },
  { id: 'anchor-five', label: 'Five-crate anchor', pattern: 'bands', cells: [{ row: 0, column: 1 }, { row: 1, column: 0 }, { row: 1, column: 1 }, { row: 1, column: 2 }, { row: 2, column: 1 }] },
]);

const rowMajor = (left, right) => left.row - right.row || left.column - right.column;
const cellSignature = (cells) => JSON.stringify(cells);
const cargoById = new Map(CARGO_CATALOG.map((piece) => [piece.id, piece]));

export function normalizeCells(cells) {
  if (!Array.isArray(cells) || cells.length === 0 || cells.some(({ row, column } = {}) => !Number.isInteger(row) || !Number.isInteger(column))) throw new TypeError('Cargo cells must be integer coordinates');
  const minimumRow = Math.min(...cells.map(({ row }) => row));
  const minimumColumn = Math.min(...cells.map(({ column }) => column));
  const normalized = cells.map(({ row, column }) => ({ row: row - minimumRow, column: column - minimumColumn })).sort(rowMajor);
  if (new Set(normalized.map(({ row, column }) => row + ':' + column)).size !== normalized.length) throw new TypeError('Cargo cells must be unique');
  return normalized;
}

export function rotateCells(cells, quarterTurns = 1) {
  let rotated = normalizeCells(cells);
  const turns = ((quarterTurns % 4) + 4) % 4;
  for (let turn = 0; turn < turns; turn += 1) rotated = normalizeCells(rotated.map(({ row, column }) => ({ row: column, column: -row })));
  return rotated;
}

const uniqueRotations = (cells) => {
  const seen = new Set();
  const rotations = [];
  for (let rotation = 0; rotation < 4; rotation += 1) {
    const rotated = rotateCells(cells, rotation);
    const signature = cellSignature(rotated);
    if (seen.has(signature)) continue;
    seen.add(signature);
    rotations.push(Object.freeze({ rotation, cells: Object.freeze(rotated) }));
  }
  return rotations;
};

export function rotationsFor(typeId, allowedRotations = null) {
  const cargo = cargoById.get(typeId);
  if (!cargo) throw new TypeError('Unknown cargo type: ' + typeId);
  const rotations = uniqueRotations(cargo.cells);
  if (allowedRotations === null) return rotations;
  if (!Array.isArray(allowedRotations)) throw new TypeError('Invalid allowed rotations');
  const allowed = new Set(allowedRotations);
  return rotations.filter(({ rotation }) => allowed.has(rotation));
}

export function boundsFor(cells) {
  const normalized = normalizeCells(cells);
  return { width: Math.max(...normalized.map(({ column }) => column)) + 1, height: Math.max(...normalized.map(({ row }) => row)) + 1 };
}

export function placedCells(cells, origin) {
  if (!Number.isInteger(origin?.row) || !Number.isInteger(origin?.column)) throw new TypeError('Invalid placement origin');
  return normalizeCells(cells).map(({ row, column }) => ({ row: row + origin.row, column: column + origin.column })).sort(rowMajor);
}

const boardDimensions = (board) => ({ height: Array.isArray(board) ? board.length : 0, width: Array.isArray(board?.[0]) ? board[0].length : 0 });

export function canPlace(board, cells, origin, { ignorePieceId = null } = {}) {
  const { width, height } = boardDimensions(board);
  if (width === 0 || board.some((row) => !Array.isArray(row) || row.length !== width)) return false;
  let destinations;
  try { destinations = placedCells(cells, origin); } catch { return false; }
  return destinations.every(({ row, column }) => row >= 0 && row < height && column >= 0 && column < width && (board[row][column] === null || board[row][column]?.pieceId === ignorePieceId));
}

export function placePiece(board, piece) {
  if (!Number.isSafeInteger(piece?.pieceId) || piece.pieceId < 0) throw new TypeError('Invalid piece identity');
  const rotation = rotationsFor(piece.typeId).find((candidate) => candidate.rotation === piece.rotation);
  if (!rotation || !canPlace(board, rotation.cells, { row: piece.row, column: piece.column }, { ignorePieceId: piece.pieceId })) throw new RangeError('Invalid cargo placement');
  const destinations = placedCells(rotation.cells, piece);
  const next = [...board];
  for (const row of new Set(destinations.map((cell) => cell.row))) next[row] = [...board[row]];
  for (const { row, column } of destinations) next[row][column] = { pieceId: piece.pieceId, typeId: piece.typeId };
  return next;
}

export function removePiece(board, pieceId) {
  return board.map((row) => row.some((cell) => cell?.pieceId === pieceId) ? row.map((cell) => cell?.pieceId === pieceId ? null : cell) : row);
}

export function connectedComponents(board) {
  const { width, height } = boardDimensions(board);
  const visited = new Set();
  const components = [];
  for (let row = 0; row < height; row += 1) for (let column = 0; column < width; column += 1) {
    const startKey = row + ':' + column;
    if (!board[row][column] || visited.has(startKey)) continue;
    const queue = [{ row, column }];
    const cells = [];
    visited.add(startKey);
    for (let index = 0; index < queue.length; index += 1) {
      const cell = queue[index];
      cells.push(cell);
      for (const [rowDelta, columnDelta] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const next = { row: cell.row + rowDelta, column: cell.column + columnDelta };
        const key = next.row + ':' + next.column;
        if (next.row < 0 || next.row >= height || next.column < 0 || next.column >= width || !board[next.row][next.column] || visited.has(key)) continue;
        visited.add(key);
        queue.push(next);
      }
    }
    cells.sort(rowMajor);
    components.push({ id: cells[0].row + ':' + cells[0].column, cells, minColumn: Math.min(...cells.map((cell) => cell.column)), maxColumn: Math.max(...cells.map((cell) => cell.column)) });
  }
  return components;
}

const MANIFEST_CELLS = Object.freeze({
  'rectangle-six': [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]],
  'rectangle-eight': [[0, 0], [0, 1], [0, 2], [0, 3], [1, 0], [1, 1], [1, 2], [1, 3]],
  'step-five': [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2]],
  'step-seven': [[0, 0], [0, 1], [1, 1], [1, 2], [2, 2], [2, 3], [3, 3]],
  'corner-six': [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2]],
  'harbour-seven': [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 1], [2, 2]],
});

const manifestCells = (pairs) => pairs.map(([row, column]) => ({ row, column }));
export const MANIFEST_SHAPES = Object.freeze([
  ['rectangle-six', 'Six-cell rectangular manifest', 'bands'], ['rectangle-eight', 'Eight-cell rectangular manifest', 'crosshatch'],
  ['step-five', 'Stepped five-cell manifest', 'diagonal'], ['step-seven', 'Stepped seven-cell manifest', 'dots'],
  ['corner-six', 'Corner six-cell manifest', 'bands'], ['harbour-seven', 'Harbour seven-cell manifest', 'crosshatch'],
].map(([id, label, pattern]) => Object.freeze({ id, label, pattern, cells: Object.freeze(manifestCells(MANIFEST_CELLS[id])) })));
const manifestById = new Map(MANIFEST_SHAPES.map((shape) => [shape.id, shape]));

export const MANIFEST_POOLS = Object.freeze({
  stack: Object.freeze({ easy: Object.freeze(['rectangle-eight']), medium: Object.freeze(['rectangle-six', 'rectangle-eight', 'step-five', 'step-seven']), hard: Object.freeze(['step-five', 'step-seven', 'corner-six', 'harbour-seven']) }),
  endless: Object.freeze({ easy: Object.freeze(['rectangle-eight']), medium: Object.freeze(['rectangle-six', 'step-five', 'step-seven']), hard: Object.freeze(['step-five', 'corner-six', 'harbour-seven']) }),
});

export function rotationsForManifest(shapeId) {
  const shape = manifestById.get(shapeId);
  if (!shape) throw new TypeError('Unknown manifest shape: ' + shapeId);
  return uniqueRotations(shape.cells);
}

export function validateBoard(value, { width, height }) {
  const errors = [];
  if (!Array.isArray(value) || value.length !== height || value.some((row) => !Array.isArray(row) || row.length !== width)) return { valid: false, errors: ['invalid board dimensions'] };
  for (let row = 0; row < height; row += 1) for (let column = 0; column < width; column += 1) {
    const cell = value[row][column];
    if (cell === null) continue;
    if (!Number.isSafeInteger(cell?.pieceId) || cell.pieceId < 0 || !cargoById.has(cell?.typeId)) errors.push('invalid cell at ' + row + ':' + column);
  }
  return { valid: errors.length === 0, errors };
}

export function validateManifest(value, { width, height }) {
  const errors = [];
  try {
    const shape = manifestById.get(value?.shapeId);
    const rotation = rotationsForManifest(value?.shapeId).find((candidate) => candidate.rotation === value?.rotation);
    const expected = rotation && placedCells(rotation.cells, value.origin);
    if (!shape || !rotation || typeof value.id !== 'string' || value.label !== shape.label || value.pattern !== shape.pattern || !Array.isArray(value.cells) || JSON.stringify([...value.cells].sort(rowMajor)) !== JSON.stringify(expected) || expected.some(({ row, column }) => row < 0 || row >= height || column < 0 || column >= width)) errors.push('invalid manifest geometry');
  } catch { errors.push('invalid manifest geometry'); }
  return { valid: errors.length === 0, errors };
}

export function isManifestComplete(board, manifest) { return manifest.cells.every(({ row, column }) => board[row]?.[column] != null); }

export function dispatchCompletedManifests(board, manifests) {
  const completed = manifests.filter((manifest) => isManifestComplete(board, manifest));
  const dispatched = new Set(completed.flatMap(({ cells }) => cells.map(({ row, column }) => row + ':' + column)));
  const next = board.map((row, rowIndex) => row.map((cell, columnIndex) => dispatched.has(rowIndex + ':' + columnIndex) ? null : cell));
  return { board: next, completed, dispatchedCells: dispatched.size, components: connectedComponents(next) };
}

export class ManifestGenerationError extends Error {}

export function selectManifestZones({ board, width, height, shapeIds, seed, index, count, occupied = [] }) {
  const dimensionsValid = Number.isSafeInteger(width) && width > 0
    && Number.isSafeInteger(height) && height > 0;
  const boardValid = dimensionsValid && validateBoard(board, { width, height }).valid;
  const selectionValid = Array.isArray(shapeIds) && shapeIds.every((id) => manifestById.has(id))
    && Number.isSafeInteger(seed) && seed >= 0
    && Number.isSafeInteger(index) && index >= 0
    && Number.isSafeInteger(count) && count >= 0 && Array.isArray(occupied);
  const occupiedCells = selectionValid ? occupied.flatMap((entry) => entry?.cells ?? [entry]) : [];
  const occupiedValid = occupiedCells.every(({ row, column } = {}) => (
    Number.isSafeInteger(row) && row >= 0 && row < height
      && Number.isSafeInteger(column) && column >= 0 && column < width
  ));
  if (!boardValid || !selectionValid || !occupiedValid) throw new TypeError('Invalid manifest selection request');
  if (count === 0) return [];
  const blocked = new Set(occupiedCells.map(({ row, column }) => row + ':' + column));
  const candidates = [];
  for (const shapeId of shapeIds) {
    const shape = manifestById.get(shapeId);
    for (const rotation of rotationsForManifest(shapeId)) {
      const bounds = boundsFor(rotation.cells);
      for (let row = 0; row <= height - bounds.height; row += 1) for (let column = 0; column <= width - bounds.width; column += 1) {
        const cells = placedCells(rotation.cells, { row, column });
        if (cells.some((cell) => blocked.has(cell.row + ':' + cell.column))) continue;
        candidates.push({ shapeId, rotation: rotation.rotation, origin: { row, column }, label: shape.label, pattern: shape.pattern, cells });
      }
    }
  }
  const shuffled = createRng(indexedSeed(seed, 'manifest', index)).shuffle(candidates);
  const selected = [];
  const selectedCells = new Set(blocked);
  for (const candidate of shuffled) {
    if (candidate.cells.some((cell) => selectedCells.has(cell.row + ':' + cell.column))) continue;
    const manifest = { id: 'manifest-' + index + '-' + selected.length, ...candidate };
    if (isManifestComplete(board, manifest)) continue;
    selected.push(manifest);
    for (const cell of candidate.cells) selectedCells.add(cell.row + ':' + cell.column);
    if (selected.length === count) return selected;
  }
  throw new ManifestGenerationError('Unable to select Cargo Manifest zones');
}

export function selectNextManifestZones({ startIndex, maxAttempts = 64, ...options }) {
  if (!Number.isSafeInteger(startIndex) || startIndex < 0
      || !Number.isSafeInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 64
      || startIndex > Number.MAX_SAFE_INTEGER - maxAttempts) {
    throw new TypeError('Invalid manifest attempt request');
  }
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const acceptedIndex = startIndex + attempt;
    try { return { manifests: selectManifestZones({ ...options, index: acceptedIndex }), nextIndex: acceptedIndex + 1 }; }
    catch (error) { if (!(error instanceof ManifestGenerationError)) throw error; }
  }
  throw new ManifestGenerationError('Unable to select a manifest within the bound');
}
