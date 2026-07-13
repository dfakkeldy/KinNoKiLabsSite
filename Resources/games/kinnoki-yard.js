import {
  CARGO_CATALOG, boundsFor, canPlace, dispatchCompletedManifests, normalizeCells,
  placePiece, placedCells, removePiece, rotationsFor, selectNextManifestZones,
  validateBoard, validateManifest,
} from './cargo-geometry.js';
import {
  createRng, deriveSeed, indexedSeed, saturatingAdd,
} from './core.js';

const keyFor = ({ row, column }) => `${row}:${column}`;
const sortedPlacements = (placements) => [...placements]
  .sort((left, right) => left.pieceId - right.pieceId);

const placementCells = (piece, placement) => placedCells(
  rotationsFor(piece.typeId, piece.allowedRotations)
    .find((value) => value.rotation === placement.rotation).cells,
  { row: placement.row, column: placement.column },
);

const enumerateContractPlacements = (definition, piece, occupied, targetKeys) => {
  const candidates = [];
  for (const rotated of rotationsFor(piece.typeId, piece.allowedRotations)) {
    const bounds = boundsFor(rotated.cells);
    for (let row = 0; row <= definition.height - bounds.height; row += 1) {
      for (let column = 0; column <= definition.width - bounds.width; column += 1) {
        const cells = placedCells(rotated.cells, { row, column });
        if (cells.every((cell) => targetKeys.has(keyFor(cell))
            && !occupied.has(keyFor(cell)))) {
          candidates.push({
            placement: {
              pieceId: piece.pieceId, typeId: piece.typeId,
              rotation: rotated.rotation, row, column,
            },
            cells,
          });
        }
      }
    }
  }
  return candidates;
};

export function solveContract(definition, placements = {}, {
  operationLimit = Number.MAX_SAFE_INTEGER,
} = {}) {
  if (!Number.isSafeInteger(operationLimit) || operationLimit < 0) {
    throw new TypeError('Invalid Contract solver operation limit');
  }
  if (placements === null || typeof placements !== 'object' || Array.isArray(placements)) {
    return { status: 'dead-end', placements: [], operations: 0 };
  }
  const targetKeys = new Set(definition.target.map(keyFor));
  const pieceById = new Map(definition.pieces.map((piece) => [piece.pieceId, piece]));
  const occupied = new Set();
  const fixed = [];
  const fixedEntries = Object.entries(placements);
  if (fixedEntries.some(([, placement]) => (
    placement === null || typeof placement !== 'object' || Array.isArray(placement)
  ))) {
    return { status: 'dead-end', placements: [], operations: 0 };
  }
  fixedEntries.sort(
    (left, right) => left[1].pieceId - right[1].pieceId,
  );
  for (const [placementKey, placement] of fixedEntries) {
    const piece = pieceById.get(placement.pieceId);
    if (placementKey !== String(placement.pieceId)
        || !piece || piece.typeId !== placement.typeId
        || !piece.allowedRotations.includes(placement.rotation)) {
      return { status: 'dead-end', placements: [], operations: 0 };
    }
    const cells = placementCells(piece, placement);
    if (cells.some((cell) => !targetKeys.has(keyFor(cell)) || occupied.has(keyFor(cell)))) {
      return { status: 'dead-end', placements: [], operations: 0 };
    }
    for (const cell of cells) occupied.add(keyFor(cell));
    fixed.push(placement);
  }

  if (operationLimit > 0 && fixed.length === 0 && Array.isArray(definition.witness)
      && definition.witness.length === definition.pieces.length) {
    const witnessOccupied = new Set();
    const witnessPieceIds = new Set();
    const witness = [];
    let witnessValid = true;
    for (const placement of definition.witness) {
      const piece = placement && typeof placement === 'object'
        ? pieceById.get(placement.pieceId) : null;
      if (!piece || (piece.typeId !== placement.typeId && placement.typeId !== undefined)
          || !piece.allowedRotations.includes(placement.rotation)
          || witnessPieceIds.has(placement.pieceId)) {
        witnessValid = false;
        break;
      }
      witnessPieceIds.add(placement.pieceId);
      const cells = placementCells(piece, placement);
      if (cells.some((cell) => !targetKeys.has(keyFor(cell))
          || witnessOccupied.has(keyFor(cell)))) {
        witnessValid = false;
        break;
      }
      for (const cell of cells) witnessOccupied.add(keyFor(cell));
      witness.push({ ...placement, typeId: piece.typeId });
    }
    if (witnessValid && witnessOccupied.size === targetKeys.size
        && witnessPieceIds.size === pieceById.size
        && [...pieceById.keys()].every((pieceId) => witnessPieceIds.has(pieceId))) {
      return { status: 'solved', placements: sortedPlacements(witness), operations: 0 };
    }
  }

  const remaining = definition.pieces.filter((piece) => !Object.hasOwn(
    placements, String(piece.pieceId),
  ));
  let operations = 0;
  let limited = false;

  const search = (pending, current, used) => {
    if (pending.length === 0) return used.size === targetKeys.size ? current : null;
    operations += 1;
    if (operations > operationLimit) {
      limited = true;
      return null;
    }
    const ranked = pending.map((piece) => ({
      piece,
      candidates: enumerateContractPlacements(definition, piece, used, targetKeys),
    })).sort((left, right) => (
      left.candidates.length - right.candidates.length
      || left.piece.pieceId - right.piece.pieceId
    ));
    const chosen = ranked[0];
    if (chosen.candidates.length === 0) return null;
    const nextPending = pending.filter((piece) => piece.pieceId !== chosen.piece.pieceId);
    for (const candidate of chosen.candidates) {
      const nextUsed = new Set(used);
      for (const cell of candidate.cells) nextUsed.add(keyFor(cell));
      const solved = search(nextPending, [...current, candidate.placement], nextUsed);
      if (solved) return solved;
      if (limited) return null;
    }
    return null;
  };

  const solved = search(remaining, [...fixed], occupied);
  if (solved) return {
    status: 'solved', placements: sortedPlacements(solved), operations,
  };
  return {
    status: limited ? 'limit' : 'dead-end', placements: [], operations,
  };
}
export const CONTRACT_RULES = Object.freeze({
  easy: Object.freeze({
    minPieces: 4, maxPieces: 6, generationAttempts: 16,
    solverOperations: 50000, restrictOrientations: false,
    minimumTargetArea: 12, maximumTargetArea: 24,
    minimumShortSide: 3, maximumLongSide: 8,
    minimumFillRatio: 0.68, maximumFillRatio: 1,
    minimumConcaveCorners: 0, maximumConcaveCorners: 2,
    minimumNarrowBayCells: 0, maximumNarrowBayCells: 0,
  }),
  medium: Object.freeze({
    minPieces: 7, maxPieces: 10, generationAttempts: 20,
    solverOperations: 150000, restrictOrientations: true,
    minimumTargetArea: 24, maximumTargetArea: 46,
    minimumShortSide: 5, maximumLongSide: 11,
    minimumFillRatio: 0.50, maximumFillRatio: 0.82,
    minimumConcaveCorners: 2, maximumConcaveCorners: 12,
    minimumNarrowBayCells: 1, maximumNarrowBayCells: 4,
  }),
  hard: Object.freeze({
    minPieces: 10, maxPieces: 14, generationAttempts: 24,
    solverOperations: 400000, restrictOrientations: true,
    minimumTargetArea: 40, maximumTargetArea: 70,
    minimumShortSide: 7, maximumLongSide: 12,
    minimumFillRatio: 0.40, maximumFillRatio: 0.68,
    minimumConcaveCorners: 4, maximumConcaveCorners: Number.MAX_SAFE_INTEGER,
    minimumNarrowBayCells: 2, maximumNarrowBayCells: Number.MAX_SAFE_INTEGER,
  }),
});

const P = (typeId, rotation, row, column, allowedRotations,
  initialRotation = allowedRotations[0]) => Object.freeze({
  typeId, initialRotation, allowedRotations: Object.freeze(allowedRotations),
  witness: Object.freeze({ rotation, row, column }),
});
const F = (id, pieces) => Object.freeze({ id, pieces: Object.freeze(pieces) });

export const CONTRACT_FALLBACK_PACKINGS = Object.freeze({
  easy: Object.freeze([
    F('easy-east-berth', [
      P('dock-square', 0, 1, 3, [0]),
      P('dock-square', 0, 1, 1, [0]),
      P('barge-three', 0, 0, 3, [0, 1]),
      P('crate-pair', 1, 1, 0, [0, 1]),
    ]),
    F('easy-crane-court', [
      P('corner-three', 3, 2, 2, [0, 1, 2, 3]),
      P('dock-square', 0, 3, 0, [0]),
      P('barge-three', 0, 2, 0, [0, 1]),
      P('crate-pair', 0, 4, 2, [0, 1]),
      P('crate-pair', 1, 0, 3, [0, 1]),
    ]),
    F('easy-quay-pocket', [
      P('dock-square', 0, 2, 1, [0]),
      P('barge-three', 1, 2, 3, [0, 1]),
      P('barge-three', 0, 1, 0, [0, 1]),
      P('corner-three', 2, 0, 2, [0, 1, 2, 3]),
      P('crate-pair', 0, 0, 0, [0, 1]),
    ]),
    F('easy-long-dock', [
      P('dock-square', 0, 0, 4, [0]),
      P('dock-square', 0, 0, 2, [0]),
      P('corner-three', 2, 2, 4, [0, 1, 2, 3]),
      P('barge-three', 0, 2, 1, [0, 1]),
      P('crate-pair', 0, 1, 0, [0, 1]),
      P('crate-pair', 0, 0, 0, [0, 1]),
    ]),
  ]),
  medium: Object.freeze([
    F('medium-ferry-lane', [
      P('fork-four', 0, 3, 1, [0, 1, 2, 3]),
      P('dock-square', 0, 1, 2, [0]),
      P('barge-five', 0, 0, 3, [0]),
      P('harbour-five', 1, 1, 7, [0, 1, 2, 3]),
      P('corner-three', 1, 1, 4, [1, 3]),
      P('crate-pair', 0, 2, 8, [0]),
      P('quay-five', 1, 0, 0, [0, 1, 2, 3]),
    ]),
    F('medium-harbour-turn', [
      P('anchor-five', 0, 4, 2, [0]),
      P('fork-four', 1, 2, 4, [0, 1, 2, 3]),
      P('barge-three', 0, 6, 0, [0]),
      P('harbour-five', 2, 2, 1, [0, 1, 2, 3]),
      P('dock-square', 0, 5, 5, [0]),
      P('zigzag-five', 0, 1, 5, [0, 2]),
      P('crate-pair', 0, 1, 3, [0, 1]),
      P('corner-three', 3, 0, 1, [0, 1, 2, 3]),
    ]),
    F('medium-quay-step', [
      P('quay-five', 1, 3, 5, [0, 1, 2, 3]),
      P('fork-four', 1, 2, 3, [0, 1, 2, 3]),
      P('dock-square', 0, 3, 1, [0]),
      P('barge-five', 0, 2, 5, [0]),
      P('corner-three', 3, 1, 1, [0, 1, 2, 3]),
      P('harbour-five', 2, 0, 1, [0, 2]),
      P('crate-pair', 0, 5, 1, [0, 1]),
      P('zigzag-five', 1, 0, 4, [0, 1, 2, 3]),
      P('barge-three', 1, 3, 0, [1]),
    ]),
    F('medium-yard-channel', [
      P('anchor-five', 0, 3, 3, [0]),
      P('harbour-five', 1, 3, 2, [0, 1, 2, 3]),
      P('quay-five', 1, 2, 1, [1, 3]),
      P('fork-four', 0, 3, 6, [0, 1, 2, 3]),
      P('dock-square', 0, 2, 5, [0]),
      P('corner-three', 0, 0, 2, [0, 2]),
      P('barge-three', 1, 2, 0, [0, 1]),
      P('crate-pair', 1, 1, 4, [0, 1]),
      P('zigzag-five', 3, 1, 8, [1, 3]),
      P('barge-five', 0, 0, 3, [0, 1]),
    ]),
  ]),
  hard: Object.freeze([
    F('hard-tidal-maze', [
      P('anchor-five', 0, 2, 2, [0]),
      P('harbour-five', 2, 0, 3, [2]),
      P('quay-five', 2, 0, 6, [2]),
      P('zigzag-five', 2, 1, 9, [0, 2]),
      P('fork-four', 2, 4, 9, [2]),
      P('barge-five', 0, 5, 0, [0]),
      P('dock-square', 0, 6, 1, [0]),
      P('corner-three', 3, 5, 4, [3]),
      P('crate-pair', 0, 3, 0, [0]),
      P('barge-three', 0, 2, 0, [0, 1]),
    ]),
    F('hard-breakwater', [
      P('quay-five', 3, 2, 6, [3]),
      P('harbour-five', 1, 1, 5, [1, 3]),
      P('anchor-five', 0, 4, 4, [0]),
      P('fork-four', 2, 7, 5, [2]),
      P('zigzag-five', 1, 4, 2, [1]),
      P('barge-five', 0, 9, 2, [0]),
      P('dock-square', 0, 10, 5, [0]),
      P('corner-three', 1, 3, 2, [1, 3]),
      P('crate-pair', 1, 0, 4, [1]),
      P('barge-three', 1, 0, 2, [1]),
      P('harbour-five', 3, 3, 0, [1, 3]),
    ]),
    F('hard-narrow-channel', [
      P('anchor-five', 0, 8, 8, [0]),
      P('quay-five', 3, 7, 5, [3]),
      P('zigzag-five', 2, 6, 3, [0, 2]),
      P('harbour-five', 2, 4, 4, [2]),
      P('fork-four', 2, 2, 4, [2]),
      P('barge-five', 0, 8, 0, [0]),
      P('dock-square', 0, 9, 0, [0]),
      P('corner-three', 0, 9, 2, [0]),
      P('crate-pair', 0, 4, 7, [0, 1]),
      P('barge-three', 0, 1, 4, [0]),
      P('fork-four', 3, 4, 8, [1, 3]),
      P('quay-five', 2, 0, 5, [2]),
    ]),
    F('hard-inner-harbour', [
      P('harbour-five', 3, 5, 4, [3]),
      P('anchor-five', 0, 6, 6, [0]),
      P('quay-five', 0, 3, 7, [0]),
      P('zigzag-five', 0, 6, 2, [0, 2]),
      P('fork-four', 0, 3, 3, [0]),
      P('barge-five', 0, 9, 1, [0]),
      P('dock-square', 0, 7, 9, [0]),
      P('corner-three', 0, 5, 3, [0]),
      P('crate-pair', 1, 5, 1, [1]),
      P('barge-three', 1, 2, 9, [1]),
      P('harbour-five', 2, 10, 3, [0, 2]),
      P('fork-four', 1, 1, 3, [1]),
      P('anchor-five', 0, 0, 0, [0]),
      P('quay-five', 3, 4, 8, [3]),
    ]),
  ]),
});

export const CONTRACT_TRANSFORM_IDS = Object.freeze([
  'identity', 'rotate90', 'rotate180', 'rotate270',
  'reflect', 'reflect90', 'reflect180', 'reflect270',
]);
const ORTHOGONAL = Object.freeze([[-1, 0], [1, 0], [0, -1], [0, 1]]);
const targetKey = (row, column) => `${row}:${column}`;

export function measureContractTarget(cells) {
  const target = normalizeCells(cells);
  const { width, height } = boundsFor(target);
  const keys = new Set(target.map(({ row, column }) => targetKey(row, column)));
  let concaveCorners = 0;
  for (let row = -1; row < height; row += 1) {
    for (let column = -1; column < width; column += 1) {
      const occupied = [
        [row, column], [row, column + 1],
        [row + 1, column], [row + 1, column + 1],
      ].filter(([r, c]) => keys.has(targetKey(r, c))).length;
      if (occupied === 3) concaveCorners += 1;
    }
  }

  const exterior = new Set([targetKey(-1, -1)]);
  const queue = [[-1, -1]];
  for (let index = 0; index < queue.length; index += 1) {
    const [row, column] = queue[index];
    for (const [rowDelta, columnDelta] of ORTHOGONAL) {
      const nextRow = row + rowDelta;
      const nextColumn = column + columnDelta;
      const key = targetKey(nextRow, nextColumn);
      if (nextRow < -1 || nextRow > height || nextColumn < -1 || nextColumn > width
          || keys.has(key) || exterior.has(key)) continue;
      exterior.add(key);
      queue.push([nextRow, nextColumn]);
    }
  }

  let narrowBayCells = 0;
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const key = targetKey(row, column);
      if (keys.has(key) || !exterior.has(key)) continue;
      const neighbours = ORTHOGONAL.filter(([rowDelta, columnDelta]) => (
        keys.has(targetKey(row + rowDelta, column + columnDelta))
      )).length;
      if (neighbours >= 3) narrowBayCells += 1;
    }
  }

  const area = target.length;
  return Object.freeze({
    area, width, height,
    shortSide: Math.min(width, height),
    longSide: Math.max(width, height),
    boundingArea: width * height,
    fillRatio: area / (width * height),
    concaveCorners, narrowBayCells,
  });
}

export function transformContractPoint({ row, column }, transformId) {
  switch (transformId) {
    case 'identity': return { row, column };
    case 'rotate90': return { row: column, column: -row };
    case 'rotate180': return { row: -row, column: -column };
    case 'rotate270': return { row: -column, column: row };
    case 'reflect': return { row, column: -column };
    case 'reflect90': return { row: -column, column: -row };
    case 'reflect180': return { row: -row, column };
    case 'reflect270': return { row: column, column: row };
    default: throw new TypeError(`Unknown Contract transform: ${transformId}`);
  }
}
const rowMajorCell = (left, right) => left.row - right.row
  || left.column - right.column;
const cellsSignature = (cells) => JSON.stringify(normalizeCells(cells));
const cargoTypeIds = new Set(CARGO_CATALOG.map(({ id }) => id));

const canonicalRotation = (typeId, rotation) => {
  const match = rotationsFor(typeId)
    .find((candidate) => candidate.rotation === rotation);
  if (!match) throw new TypeError(`Invalid ${typeId} rotation: ${rotation}`);
  return match;
};

const transformedRotation = (typeId, rotation, transformId) => {
  const transformed = normalizeCells(canonicalRotation(typeId, rotation).cells
    .map((cell) => transformContractPoint(cell, transformId)));
  const signature = cellsSignature(transformed);
  const match = rotationsFor(typeId)
    .find((candidate) => cellsSignature(candidate.cells) === signature);
  if (!match) throw new TypeError(`Transform is not canonical for ${typeId}`);
  return match.rotation;
};

const freezeContractDefinition = (definition) => Object.freeze({
  ...definition,
  target: Object.freeze(definition.target.map((cell) => Object.freeze({ ...cell }))),
  pieces: Object.freeze(definition.pieces.map((piece) => Object.freeze({
    ...piece,
    allowedRotations: Object.freeze([...piece.allowedRotations]),
  }))),
  witness: Object.freeze(definition.witness.map((placement) => (
    Object.freeze({ ...placement })
  ))),
  generation: Object.freeze({ ...definition.generation }),
});
const validatedFallbacks = new Set();

export function contractSignature(definition) {
  return JSON.stringify([
    definition.version,
    definition.mode,
    definition.difficulty,
    [...definition.target].sort(rowMajorCell)
      .map(({ row, column }) => [row, column]),
    [...definition.pieces].sort((left, right) => left.pieceId - right.pieceId)
      .map((piece) => [
        piece.pieceId,
        piece.typeId,
        [...piece.allowedRotations],
        piece.initialRotation,
        piece.trayIndex,
      ]),
  ]);
}

export function definitionFromFallback(
  source,
  difficulty,
  transformId,
  seed = 0,
) {
  if (!CONTRACT_FALLBACK_PACKINGS[difficulty]?.includes(source)
      || !CONTRACT_TRANSFORM_IDS.includes(transformId)) {
    throw new TypeError('Invalid Contract fallback request');
  }
  const transformed = source.pieces.map((entry, pieceId) => {
    const rotation = canonicalRotation(entry.typeId, entry.witness.rotation);
    const globalCells = placedCells(rotation.cells, entry.witness)
      .map((cell) => transformContractPoint(cell, transformId));
    return { entry, pieceId, globalCells };
  });
  const combined = transformed.flatMap(({ globalCells }) => globalCells);
  const minimumRow = Math.min(...combined.map(({ row }) => row));
  const minimumColumn = Math.min(...combined.map(({ column }) => column));
  const shifted = transformed.map((value) => ({
    ...value,
    cells: value.globalCells.map(({ row, column }) => ({
      row: row - minimumRow,
      column: column - minimumColumn,
    })).sort(rowMajorCell),
  }));
  const target = normalizeCells(shifted.flatMap(({ cells }) => cells));
  const { width, height } = boundsFor(target);
  const pieces = shifted.map(({ entry, pieceId }) => ({
    pieceId,
    typeId: entry.typeId,
    allowedRotations: [...new Set(entry.allowedRotations.map((rotation) => (
      transformedRotation(entry.typeId, rotation, transformId)
    )))].sort((left, right) => left - right),
    initialRotation: transformedRotation(
      entry.typeId,
      entry.initialRotation,
      transformId,
    ),
    trayIndex: pieceId,
  }));
  const witness = shifted.map(({ entry, pieceId, cells }) => ({
    pieceId,
    rotation: transformedRotation(
      entry.typeId,
      entry.witness.rotation,
      transformId,
    ),
    row: Math.min(...cells.map(({ row }) => row)),
    column: Math.min(...cells.map(({ column }) => column)),
  }));
  const definition = freezeContractDefinition({
    version: 1,
    game: 'kinnoki-yard',
    mode: 'contracts',
    difficulty,
    seed: seed >>> 0,
    width,
    height,
    target,
    pieces,
    witness,
    generation: {
      usedFallback: true,
      attempt: 0,
      sourceId: source.id,
      transformId,
      operations: 0,
    },
  });
  const validationKey = `${difficulty}:${source.id}:${transformId}`;
  if (!validatedFallbacks.has(validationKey)) {
    const validation = validateContractDefinition(definition);
    if (!validation.valid) {
      throw new Error(`Invalid bundled Contract fallback: ${validation.errors.join(', ')}`);
    }
    validatedFallbacks.add(validationKey);
  }
  return definition;
}
export function selectContractFallback({ difficulty, seed, previousSignature }) {
  const sources = CONTRACT_FALLBACK_PACKINGS[difficulty];
  const combinationCount = sources.length * CONTRACT_TRANSFORM_IDS.length;
  const startSlot = indexedSeed(seed, 'fallback', 0) % combinationCount;
  for (let fallbackIndex = 0; fallbackIndex < combinationCount; fallbackIndex += 1) {
    const slot = (startSlot + fallbackIndex) % combinationCount;
    const source = sources[slot % sources.length];
    const transformId = CONTRACT_TRANSFORM_IDS[Math.floor(slot / sources.length)];
    const definition = definitionFromFallback(source, difficulty, transformId, seed);
    if (definition.seed !== (seed >>> 0)) {
      throw new Error('Contract fallback seed mismatch');
    }
    if (contractSignature(definition) !== previousSignature) return definition;
  }
  throw new Error('No non-repeating validated Contract fallback remains');
}
const touchesTarget = (cells, occupied) => cells.some(({ row, column }) => (
  ORTHOGONAL.some(([rowDelta, columnDelta]) => (
    occupied.has(targetKey(row + rowDelta, column + columnDelta))
  ))
));

const candidateAttachments = (typeId, occupiedCells) => {
  const occupied = new Set(occupiedCells.map(({ row, column }) => targetKey(row, column)));
  const rows = occupiedCells.map(({ row }) => row);
  const columns = occupiedCells.map(({ column }) => column);
  const minimumRow = Math.min(...rows);
  const maximumRow = Math.max(...rows);
  const minimumColumn = Math.min(...columns);
  const maximumColumn = Math.max(...columns);
  const candidates = [];
  for (const rotation of rotationsFor(typeId)) {
    const bounds = boundsFor(rotation.cells);
    for (let row = minimumRow - bounds.height; row <= maximumRow + 1; row += 1) {
      for (let column = minimumColumn - bounds.width;
        column <= maximumColumn + 1; column += 1) {
        const cells = placedCells(rotation.cells, { row, column });
        if (cells.some((cell) => occupied.has(targetKey(cell.row, cell.column)))
            || !touchesTarget(cells, occupied)) continue;
        candidates.push({ rotation: rotation.rotation, row, column, cells });
      }
    }
  }
  return candidates;
};

const restrictedRotations = (difficulty, pieceIndex, typeId, witnessRotation, rng) => {
  const rotations = rotationsFor(typeId).map(({ rotation }) => rotation);
  if (difficulty === 'easy' || rotations.length === 1) return rotations;
  const alternatePool = rotations.filter((rotation) => rotation !== witnessRotation);
  if (difficulty === 'medium' && pieceIndex % 3 === 2) {
    const opposite = transformedRotation(typeId, witnessRotation, 'rotate180');
    return [...new Set([witnessRotation, opposite])].sort((left, right) => left - right);
  }
  if (difficulty === 'hard' && pieceIndex % 2 === 1 && alternatePool.length > 0) {
    return [witnessRotation, alternatePool[rng.int(alternatePool.length)]]
      .sort((left, right) => left - right);
  }
  return rotations;
};

const shuffleTrayIndices = (pieces, rng) => {
  const order = pieces.map(({ pieceId }) => pieceId);
  for (let index = order.length - 1; index > 0; index -= 1) {
    const selected = rng.int(index + 1);
    [order[index], order[selected]] = [order[selected], order[index]];
  }
  const trayByPiece = new Map(order.map((pieceId, trayIndex) => [pieceId, trayIndex]));
  return pieces.map((piece) => ({
    ...piece,
    trayIndex: trayByPiece.get(piece.pieceId),
  }));
};

function buildContractAttempt({ difficulty, seed, attempt }) {
  const rules = CONTRACT_RULES[difficulty];
  const rng = createRng(indexedSeed(seed, 'contract', attempt));
  const catalogue = difficulty === 'easy' ? CARGO_CATALOG.slice(0, 6) : CARGO_CATALOG;
  const pieceCount = rules.minPieces + rng.int(rules.maxPieces - rules.minPieces + 1);
  const built = [];
  let occupiedCells = [];

  for (let pieceId = 0; pieceId < pieceCount; pieceId += 1) {
    const typeId = catalogue[rng.int(catalogue.length)].id;
    let chosen;
    if (pieceId === 0) {
      const rotations = rotationsFor(typeId);
      const rotation = rotations[rng.int(rotations.length)];
      chosen = {
        rotation: rotation.rotation,
        row: 0,
        column: 0,
        cells: placedCells(rotation.cells, { row: 0, column: 0 }),
      };
    } else {
      const candidates = candidateAttachments(typeId, occupiedCells);
      if (candidates.length === 0) return null;
      chosen = candidates[rng.int(candidates.length)];
    }
    built.push({ pieceId, typeId, ...chosen });
    occupiedCells = [...occupiedCells, ...chosen.cells];
  }

  const minimumRow = Math.min(...occupiedCells.map(({ row }) => row));
  const minimumColumn = Math.min(...occupiedCells.map(({ column }) => column));
  const target = normalizeCells(occupiedCells);
  const { width, height } = boundsFor(target);
  const witness = built.map(({ pieceId, rotation, row, column }) => ({
    pieceId,
    rotation,
    row: row - minimumRow,
    column: column - minimumColumn,
  }));
  const pieces = shuffleTrayIndices(built.map(({ pieceId, typeId, rotation }) => {
    const allowedRotations = restrictedRotations(
      difficulty,
      pieceId,
      typeId,
      rotation,
      rng,
    );
    return {
      pieceId,
      typeId,
      allowedRotations,
      initialRotation: allowedRotations[rng.int(allowedRotations.length)],
      trayIndex: pieceId,
    };
  }), rng);

  return freezeContractDefinition({
    version: 1,
    game: 'kinnoki-yard',
    mode: 'contracts',
    difficulty,
    seed: seed >>> 0,
    width,
    height,
    target,
    pieces,
    witness,
    generation: {
      usedFallback: false,
      attempt,
      sourceId: null,
      transformId: 'identity',
      operations: 0,
    },
  });
}
const targetMatchesRules = (metrics, rules) => (
  metrics.area >= rules.minimumTargetArea
  && metrics.area <= rules.maximumTargetArea
  && metrics.shortSide >= rules.minimumShortSide
  && metrics.longSide <= rules.maximumLongSide
  && metrics.fillRatio >= rules.minimumFillRatio
  && metrics.fillRatio <= rules.maximumFillRatio
  && metrics.concaveCorners >= rules.minimumConcaveCorners
  && metrics.concaveCorners <= rules.maximumConcaveCorners
  && metrics.narrowBayCells >= rules.minimumNarrowBayCells
  && metrics.narrowBayCells <= rules.maximumNarrowBayCells
);

export function generateContract({
  difficulty,
  seed,
  previousSignature = null,
  operationLimit,
  forceFallback = false,
}) {
  const rules = CONTRACT_RULES[difficulty];
  if (!rules || !Number.isSafeInteger(seed) || seed < 0) {
    throw new TypeError('Invalid Contract generation request');
  }
  const solverLimit = operationLimit === undefined
    ? rules.solverOperations
    : operationLimit;
  if (!Number.isSafeInteger(solverLimit) || solverLimit < 0) {
    throw new TypeError('Invalid Contract solver operation limit');
  }

  if (!forceFallback) {
    for (let attempt = 0; attempt < rules.generationAttempts; attempt += 1) {
      const candidate = buildContractAttempt({ difficulty, seed, attempt });
      if (!candidate
          || !targetMatchesRules(measureContractTarget(candidate.target), rules)
          || contractSignature(candidate) === previousSignature) continue;
      const solved = solveContract(candidate, {}, { operationLimit: solverLimit });
      if (solved.status !== 'solved') continue;
      const definition = freezeContractDefinition({
        ...candidate,
        generation: { ...candidate.generation, operations: solved.operations },
      });
      if (validateContractDefinition(definition).valid) return definition;
    }
  }
  return selectContractFallback({ difficulty, seed, previousSignature });
}
const unsignedSeed = (value) => Number.isSafeInteger(value)
  && value >= 0 && value <= 0xffffffff;
const uniqueValues = (values) => new Set(values).size === values.length;

const connectedTarget = (cells) => {
  const keys = new Set(cells.map(keyFor));
  const first = cells[0];
  if (!first) return false;
  const visited = new Set([keyFor(first)]);
  const queue = [first];
  for (let index = 0; index < queue.length; index += 1) {
    const cell = queue[index];
    for (const [rowDelta, columnDelta] of ORTHOGONAL) {
      const next = { row: cell.row + rowDelta, column: cell.column + columnDelta };
      const key = keyFor(next);
      if (keys.has(key) && !visited.has(key)) {
        visited.add(key);
        queue.push(next);
      }
    }
  }
  return visited.size === keys.size;
};

export function validateContractDefinition(definition) {
  const errors = [];
  const rules = CONTRACT_RULES[definition?.difficulty];
  const envelopeValid = definition?.version === 1
    && definition?.game === 'kinnoki-yard'
    && definition?.mode === 'contracts'
    && Boolean(rules)
    && unsignedSeed(definition?.seed)
    && Number.isSafeInteger(definition?.width) && definition.width > 0
    && Number.isSafeInteger(definition?.height) && definition.height > 0;
  if (!envelopeValid) errors.push('invalid contract envelope');

  let targetValid = envelopeValid && Array.isArray(definition.target)
    && definition.target.length > 0;
  try {
    if (targetValid) {
      const normalized = normalizeCells(definition.target);
      const bounds = boundsFor(normalized);
      targetValid = JSON.stringify(normalized) === JSON.stringify(definition.target)
        && bounds.width === definition.width
        && bounds.height === definition.height
        && normalized.every(({ row, column }) => (
          row >= 0 && row < definition.height
          && column >= 0 && column < definition.width
        ))
        && connectedTarget(normalized)
        && targetMatchesRules(measureContractTarget(normalized), rules);
    }
  } catch {
    targetValid = false;
  }
  if (!targetValid) errors.push('invalid contract target');

  let piecesValid = Boolean(rules) && Array.isArray(definition?.pieces)
    && definition.pieces.length >= rules.minPieces
    && definition.pieces.length <= rules.maxPieces;
  try {
    if (piecesValid) {
      const pieceIds = definition.pieces.map(({ pieceId }) => pieceId);
      const trayIndices = definition.pieces.map(({ trayIndex }) => trayIndex);
      piecesValid = pieceIds.every((value) => Number.isSafeInteger(value) && value >= 0)
        && trayIndices.every((value) => Number.isSafeInteger(value) && value >= 0)
        && uniqueValues(pieceIds)
        && uniqueValues(trayIndices)
        && definition.pieces.every((piece) => {
          if (!cargoTypeIds.has(piece.typeId)
              || !Array.isArray(piece.allowedRotations)
              || piece.allowedRotations.length === 0
              || !uniqueValues(piece.allowedRotations)) return false;
          const canonical = new Set(rotationsFor(piece.typeId)
            .map(({ rotation }) => rotation));
          return piece.allowedRotations.every((rotation) => canonical.has(rotation))
            && piece.allowedRotations.includes(piece.initialRotation);
        });
    }
  } catch {
    piecesValid = false;
  }
  if (!piecesValid) errors.push('invalid contract pieces');

  let areaValid = targetValid && piecesValid;
  try {
    if (areaValid) {
      const pieceArea = definition.pieces.reduce((total, piece) => (
        total + rotationsFor(piece.typeId)[0].cells.length
      ), 0);
      areaValid = pieceArea === definition.target.length;
    }
  } catch {
    areaValid = false;
  }
  if (!areaValid) errors.push('invalid contract area');

  let witnessValid = areaValid && Array.isArray(definition?.witness)
    && definition.witness.length === definition.pieces.length;
  try {
    if (witnessValid) {
      const pieceById = new Map(definition.pieces
        .map((piece) => [piece.pieceId, piece]));
      const witnessIds = definition.witness.map(({ pieceId }) => pieceId);
      const targetKeys = new Set(definition.target.map(keyFor));
      const occupied = new Set();
      witnessValid = uniqueValues(witnessIds)
        && witnessIds.every((pieceId) => pieceById.has(pieceId));
      for (const placement of witnessValid ? definition.witness : []) {
        const piece = pieceById.get(placement.pieceId);
        if (!piece.allowedRotations.includes(placement.rotation)
            || !Number.isInteger(placement.row)
            || !Number.isInteger(placement.column)) {
          witnessValid = false;
          break;
        }
        const cells = placementCells(piece, placement);
        if (cells.some((cell) => !targetKeys.has(keyFor(cell))
            || occupied.has(keyFor(cell)))) {
          witnessValid = false;
          break;
        }
        for (const cell of cells) occupied.add(keyFor(cell));
      }
      witnessValid = witnessValid && occupied.size === targetKeys.size;
    }
  } catch {
    witnessValid = false;
  }
  if (!witnessValid) errors.push('invalid contract witness');

  const generation = definition?.generation;
  const sourceIds = new Set((CONTRACT_FALLBACK_PACKINGS[definition?.difficulty] ?? [])
    .map(({ id }) => id));
  const generationValid = Boolean(rules)
    && typeof generation?.usedFallback === 'boolean'
    && Number.isSafeInteger(generation?.attempt) && generation.attempt >= 0
    && generation.attempt < rules.generationAttempts
    && Number.isSafeInteger(generation?.operations) && generation.operations >= 0
    && generation.operations <= rules.solverOperations
    && CONTRACT_TRANSFORM_IDS.includes(generation?.transformId)
    && (generation.usedFallback
      ? sourceIds.has(generation.sourceId)
      : generation.sourceId === null && generation.transformId === 'identity');
  if (!generationValid) errors.push('invalid contract generation');

  let solverValid = targetValid && piecesValid && areaValid;
  try {
    if (solverValid) {
      solverValid = solveContract(definition, {}, {
        operationLimit: rules.solverOperations,
      }).status === 'solved';
    }
  } catch {
    solverValid = false;
  }
  if (!solverValid) errors.push('invalid contract solver proof');
  return { valid: errors.length === 0, errors };
}
