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
  if (fixedEntries.some(([placementKey, placement]) => {
    if (placement === null || typeof placement !== 'object' || Array.isArray(placement)
        || !Number.isSafeInteger(placement.pieceId)) return true;
    const piece = pieceById.get(placement.pieceId);
    return placementKey !== String(placement.pieceId)
      || !piece
      || piece.typeId !== placement.typeId
      || !piece.allowedRotations.includes(placement.rotation);
  })) {
    return { status: 'dead-end', placements: [], operations: 0 };
  }
  fixedEntries.sort(
    (left, right) => left[1].pieceId - right[1].pieceId,
  );
  for (const [, placement] of fixedEntries) {
    const piece = pieceById.get(placement.pieceId);
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

const contractSnapshot = (state) => structuredClone({
  board: state.board,
  placements: state.placements,
  selectedPieceId: state.selectedPieceId,
  selectedRotation: state.selectedRotation,
  focus: state.focus,
  hint: state.hint,
});

export function createContractState(definition) {
  if (!validateContractDefinition(definition).valid) {
    throw new TypeError('Invalid Contract definition');
  }
  return {
    kind: 'contracts', status: 'preview', definition,
    board: Array.from({ length: definition.height },
      () => Array(definition.width).fill(null)),
    placements: {},
    selectedPieceId: definition.pieces[0]?.pieceId ?? null,
    selectedRotation: definition.pieces[0]?.initialRotation ?? 0,
    focus: { row: 0, column: 0 }, moves: 0, assisted: false,
    hint: null, history: [], terminalReason: null,
  };
}

export function prepareContractForContinue(play) {
  const result = validateContractState(play, play?.definition?.difficulty);
  if (!result.valid || play.status === 'terminal' || play.status === 'error') {
    throw new TypeError('Invalid saved Contract');
  }
  return structuredClone({ ...play, status: 'paused' });
}

const contractInvalid = (state, action, reason) => ({
  state, events: [{ type: 'invalid', action, reason }],
});

const reduceContractBase = (state, action) => {
  if (['terminal', 'error', 'disposed'].includes(state.status)) {
    return { state, events: [] };
  }
  if (action.type === 'start') {
    if (state.status === 'active') return { state, events: [] };
    return state.status === 'preview'
      ? { state: { ...state, status: 'active' }, events: [{ type: 'started' }] }
      : contractInvalid(state, 'start', 'The Contract cannot start from this state.');
  }
  if (action.type === 'pause') {
    if (state.status === 'paused') return { state, events: [] };
    if (state.status !== 'active' || !['user', 'hidden'].includes(action.reason)) {
      return contractInvalid(state, 'pause', 'The Contract cannot pause from this state.');
    }
    return { state: { ...state, status: 'paused' },
      events: [{ type: 'paused', reason: action.reason }] };
  }
  if (action.type === 'resume') {
    if (state.status === 'active') return { state, events: [] };
    return state.status === 'paused'
      ? { state: { ...state, status: 'active' }, events: [{ type: 'resumed' }] }
      : contractInvalid(state, 'resume', 'The Contract cannot resume from this state.');
  }
  if (state.status !== 'active') return contractInvalid(state, action.type, 'Game is paused.');

  if (action.type === 'set-focus') {
    const focus = action.focus;
    if (!isRecord(focus)
        || JSON.stringify(Object.keys(focus).sort()) !== JSON.stringify(['column', 'row'])
        || !Number.isInteger(focus.row) || !Number.isInteger(focus.column)
        || focus.row < 0 || focus.row >= state.definition.height
        || focus.column < 0 || focus.column >= state.definition.width) {
      return contractInvalid(state, action.type, 'Focus must be an in-bounds Yard cell.');
    }
    if (focus.row === state.focus.row && focus.column === state.focus.column) {
      return { state, events: [] };
    }
    return { state: { ...state, focus: { ...focus } },
      events: [{ type: 'focus-changed', focus: { ...focus } }] };
  }

  if (action.type === 'select-piece') {
    const piece = state.definition.pieces.find((value) => value.pieceId === action.pieceId);
    if (!piece) return contractInvalid(state, action.type, 'Unknown cargo piece.');
    const rotation = state.placements[piece.pieceId]?.rotation ?? piece.initialRotation;
    return { state: { ...state, selectedPieceId: piece.pieceId,
      selectedRotation: rotation, hint: null },
    events: [{ type: 'selected', pieceId: piece.pieceId }] };
  }

  if (action.type === 'rotate-piece') {
    if (action.quarterTurns !== 1) {
      return contractInvalid(state, action.type, 'Rotation must be one quarter turn.');
    }
    const piece = state.definition.pieces.find(
      (value) => value.pieceId === state.selectedPieceId,
    );
    if (!piece || piece.allowedRotations.length < 2) {
      return contractInvalid(state, action.type, 'This cargo has one fixed orientation.');
    }
    const index = piece.allowedRotations.indexOf(state.selectedRotation);
    const rotation = piece.allowedRotations[(index + 1) % piece.allowedRotations.length];
    const next = { ...state, selectedRotation: rotation, hint: null,
      moves: saturatingAdd(state.moves, 1),
      history: [...state.history, contractSnapshot(state)] };
    return { state: next, events: [{ type: 'rotated', pieceId: piece.pieceId, rotation }] };
  }
  return null;
};

const reduceContractPlacement = (state, action) => {
  if (action.type !== 'place-piece') return null;
  const piece = state.definition.pieces.find(
    (value) => value.pieceId === state.selectedPieceId,
  );
  if (!piece || !Number.isInteger(action.row) || !Number.isInteger(action.column)) {
    return contractInvalid(state, action.type, 'Choose cargo and a target cell.');
  }
  const rotated = rotationsFor(piece.typeId, piece.allowedRotations)
    .find((value) => value.rotation === state.selectedRotation);
  const origin = { row: action.row, column: action.column };
  const cells = placedCells(rotated.cells, origin);
  const target = new Set(state.definition.target.map(keyFor));
  const cleared = removePiece(state.board, piece.pieceId);
  if (!cells.every((cell) => target.has(keyFor(cell)))
      || !canPlace(cleared, rotated.cells, origin)) {
    return contractInvalid(state, action.type, 'Cargo does not fit the Contract target.');
  }
  const repositioning = Object.hasOwn(state.placements, String(piece.pieceId));
  const placement = { pieceId: piece.pieceId, typeId: piece.typeId,
    rotation: state.selectedRotation, row: action.row, column: action.column };
  const board = placePiece(cleared, placement);
  const placements = { ...state.placements, [piece.pieceId]: placement };
  const moves = saturatingAdd(state.moves, 1);
  const complete = Object.keys(placements).length === state.definition.pieces.length
    && board.flat().filter(Boolean).length === state.definition.target.length;
  const next = { ...state, board, placements, moves, hint: null,
    history: [...state.history, contractSnapshot(state)],
    status: complete ? 'terminal' : 'active',
    terminalReason: complete ? 'completed' : null };
  const event = repositioning
    ? { type: 'repositioned', mode: 'contracts', pieceId: piece.pieceId,
      row: action.row, column: action.column, rotation: state.selectedRotation, move: moves }
    : { type: 'placed', mode: 'contracts', pieceId: piece.pieceId,
      row: action.row, column: action.column, rotation: state.selectedRotation, move: moves };
  return { state: next, events: complete
    ? [event, { type: 'completed', moves }] : [event] };
};

export function getContractHint(state) {
  const result = solveContract(state.definition, state.placements);
  if (result.status !== 'solved') return {
    status: 'dead-end',
    message: 'Undo to the most recent completable position or Restart this contract.',
  };
  const piece = [...state.definition.pieces]
    .filter((value) => !Object.hasOwn(state.placements, String(value.pieceId)))
    .sort((left, right) => left.trayIndex - right.trayIndex)[0];
  return { status: 'solved', placement: result.placements
    .find((value) => value.pieceId === piece.pieceId) };
}

export function reduceContract(state, action) {
  const base = reduceContractBase(state, action);
  if (base) return base;
  const placement = reduceContractPlacement(state, action);
  if (placement) return placement;
  if (action.type === 'undo') {
    if (state.history.length === 0) return { state, events: [] };
    const snapshot = state.history.at(-1);
    const moves = saturatingAdd(state.moves, 1);
    const next = { ...state, ...structuredClone(snapshot), moves,
      assisted: state.assisted, history: state.history.slice(0, -1) };
    return { state: next, events: [{ type: 'undone', mode: 'contracts',
      move: moves, assisted: false }] };
  }
  if (action.type === 'hint') {
    const hint = getContractHint(state);
    const assistedEvent = state.assisted ? []
      : [{ type: 'assisted', reason: 'hint' }];
    if (hint.status === 'dead-end') return {
      state: { ...state, assisted: true, hint },
      events: [...assistedEvent, { type: 'hint-dead-end', message: hint.message }],
    };
    const { pieceId, row, column, rotation } = hint.placement;
    return { state: { ...state, assisted: true, hint },
      events: [...assistedEvent, { type: 'hint', pieceId, row, column, rotation }] };
  }
  return contractInvalid(state, action.type, 'Unsupported Contract action.');
}

const contractSnapshotKeys = Object.freeze([
  'board', 'focus', 'hint', 'placements', 'selectedPieceId', 'selectedRotation',
]);
const isRecord = (value) => value !== null && typeof value === 'object'
  && !Array.isArray(value);

const contractPositionErrors = (position, definition) => {
  const errors = [];
  if (!isRecord(position?.placements)) return ['invalid Contract placements'];
  const placementEntries = Object.entries(position.placements);
  if (placementEntries.some(([key, placement]) => key !== String(placement?.pieceId))) {
    errors.push('invalid Contract placement key');
  }

  let board = Array.from({ length: definition.height },
    () => Array(definition.width).fill(null));
  const target = new Set(definition.target.map(keyFor));
  for (const [, placement] of placementEntries
    .sort((left, right) => left[1].pieceId - right[1].pieceId)) {
    const piece = definition.pieces.find(
      (candidate) => candidate.pieceId === placement?.pieceId,
    );
    if (!piece || piece.typeId !== placement.typeId
        || !piece.allowedRotations.includes(placement.rotation)
        || !Number.isInteger(placement.row) || !Number.isInteger(placement.column)) {
      errors.push('invalid Contract placement');
      continue;
    }
    const rotated = rotationsFor(piece.typeId, piece.allowedRotations)
      .find((candidate) => candidate.rotation === placement.rotation);
    const origin = { row: placement.row, column: placement.column };
    const cells = placedCells(rotated.cells, origin);
    if (!cells.every((cell) => target.has(keyFor(cell)))
        || !canPlace(board, rotated.cells, origin)) {
      errors.push('invalid Contract placement geometry');
      continue;
    }
    board = placePiece(board, placement);
  }
  if (!validateBoard(position?.board, {
    width: definition.width, height: definition.height,
  }).valid || JSON.stringify(board) !== JSON.stringify(position.board)) {
    errors.push('board mismatch');
  }

  const selected = definition.pieces.find(
    (piece) => piece.pieceId === position?.selectedPieceId,
  );
  if (!selected || !selected.allowedRotations.includes(position?.selectedRotation)) {
    errors.push('invalid Contract selection');
  }
  if (!Number.isInteger(position?.focus?.row)
      || !Number.isInteger(position?.focus?.column)
      || position.focus.row < 0 || position.focus.row >= definition.height
      || position.focus.column < 0 || position.focus.column >= definition.width) {
    errors.push('invalid Contract focus');
  }

  const hint = position?.hint;
  if (hint !== null) {
    const canonicalHint = getContractHint({ definition, placements: position.placements });
    if (JSON.stringify(hint) !== JSON.stringify(canonicalHint)) {
      errors.push('invalid Contract hint');
    }
  }
  return errors;
};

export function validateContractState(value, difficulty) {
  const errors = [];
  try {
    if (value?.kind !== 'contracts') errors.push('invalid Contract kind');
    if (!['preview', 'active', 'paused'].includes(value?.status)
        || value?.terminalReason !== null) errors.push('invalid saved Contract status');
    if (value?.definition?.difficulty !== difficulty
        || !validateContractDefinition(value?.definition).valid) {
      errors.push('invalid Contract definition');
    } else {
      errors.push(...contractPositionErrors(value, value.definition));
    }
    if (!Number.isSafeInteger(value?.moves) || value.moves < 0) errors.push('invalid moves');
    if (typeof value?.assisted !== 'boolean') errors.push('invalid assistance');
    if (!Array.isArray(value?.history)) {
      errors.push('invalid Contract history');
    } else if (value.history.some((entry) => {
      if (!isRecord(entry)
          || JSON.stringify(Object.keys(entry).sort()) !== JSON.stringify(contractSnapshotKeys)) {
        return true;
      }
      return contractPositionErrors(entry, value.definition).length > 0;
    })) {
      errors.push('invalid Contract history');
    }
  } catch {
    errors.push('invalid Contract state');
  }
  return { valid: errors.length === 0, errors };
}

export const ENDLESS_RULES = Object.freeze({
  easy: Object.freeze({
    width: 10, height: 10, cargoCount: 6,
    rotationPolicy: 'all', manifestCount: 1,
    manifestShapeIds: Object.freeze(['rectangle-eight']),
  }),
  medium: Object.freeze({
    width: 9, height: 9, cargoCount: 12,
    rotationPolicy: 'selected-opposites', manifestCount: 2,
    manifestShapeIds: Object.freeze(['rectangle-six', 'step-five', 'step-seven']),
  }),
  hard: Object.freeze({
    width: 8, height: 8, cargoCount: 12,
    rotationPolicy: 'initial-plus-one', manifestCount: 2,
    manifestShapeIds: Object.freeze(['step-five', 'corner-six', 'harbour-seven']),
  }),
});

export function createEndlessDefinition({ difficulty, seed }) {
  const rules = ENDLESS_RULES[difficulty];
  if (!rules || !unsignedSeed(seed)) {
    throw new TypeError('Invalid Endless definition request');
  }
  return Object.freeze({ version: 1, game: 'kinnoki-yard', mode: 'endless',
    difficulty, seed: seed >>> 0, width: rules.width, height: rules.height });
}

export const endlessSignature = (definition) => JSON.stringify([
  definition.version, definition.game, definition.mode, definition.difficulty,
  definition.seed, definition.width, definition.height,
]);

const endlessPieceAt = (definition, sequenceIndex, batchIndex) => {
  const rules = ENDLESS_RULES[definition.difficulty];
  const rng = createRng(indexedSeed(definition.seed, 'yard-batch', sequenceIndex));
  const type = CARGO_CATALOG[rng.int(rules.cargoCount)];
  const rotations = rotationsFor(type.id);
  const initial = rotations[rng.int(rotations.length)].rotation;
  let allowedRotations = rotations.map(({ rotation }) => rotation);
  if (rules.rotationPolicy === 'selected-opposites' && type.cells.length === 5) {
    const opposite = rotations.find(({ rotation }) => rotation === ((initial + 2) % 4));
    allowedRotations = [...new Set([initial, opposite?.rotation ?? initial])];
  } else if (rules.rotationPolicy === 'initial-plus-one') {
    const alternatives = rotations.filter(({ rotation }) => rotation !== initial);
    const alternate = alternatives.length ? alternatives[rng.int(alternatives.length)].rotation : initial;
    allowedRotations = [...new Set([initial, alternate])];
  }
  return { pieceId: sequenceIndex, typeId: type.id, allowedRotations,
    rotation: initial, batchIndex };
};

const dealEndlessBatch = (definition, sequenceIndex, batchIndex) => (
  [0, 1, 2].map((offset) => endlessPieceAt(
    definition, sequenceIndex + offset, batchIndex,
  ))
);

export function createEndlessState(definition) {
  const rules = ENDLESS_RULES[definition?.difficulty];
  let expectedDefinition;
  try {
    expectedDefinition = createEndlessDefinition({
      difficulty: definition?.difficulty, seed: definition?.seed,
    });
  } catch {}
  if (!rules || JSON.stringify(definition) !== JSON.stringify(expectedDefinition)) {
    throw new TypeError('Invalid Endless definition');
  }
  const board = Array.from({ length: definition.height },
    () => Array(definition.width).fill(null));
  const selected = selectNextManifestZones({ board, width: definition.width,
    height: definition.height, shapeIds: rules.manifestShapeIds,
    seed: definition.seed, startIndex: 0, count: rules.manifestCount });
  const tray = dealEndlessBatch(definition, 0, 0);
  return { kind: 'endless', status: 'preview', definition, board, tray,
    selectedPieceId: tray[0].pieceId, focus: { row: 0, column: 0 },
    manifests: selected.manifests, manifestIndex: selected.nextIndex,
    sequenceIndex: 3, batchIndex: 0, score: 0, combo: 0, bestCombo: 0,
    dispatchedManifests: 0, assisted: false, history: [], commandLog: [],
    terminalReason: null };
}

export function prepareEndlessForContinue(play) {
  if (!validateEndlessState(play, play?.definition?.difficulty).valid
      || play.status === 'terminal') {
    throw new TypeError('Invalid saved Endless Yard');
  }
  return structuredClone({ ...play, status: 'paused',
    commandLog: [...play.commandLog, { type: 'prepare-continue' }] });
}

const endlessSnapshot = (state) => structuredClone({
  board: state.board, tray: state.tray, selectedPieceId: state.selectedPieceId,
  focus: state.focus, manifests: state.manifests, manifestIndex: state.manifestIndex,
  sequenceIndex: state.sequenceIndex, batchIndex: state.batchIndex,
  score: state.score, combo: state.combo, bestCombo: state.bestCombo,
  dispatchedManifests: state.dispatchedManifests,
});

export function hasAnyEndlessPlacement(state) {
  return state.tray.some((piece) => rotationsFor(piece.typeId, piece.allowedRotations)
    .some((rotated) => {
      const bounds = boundsFor(rotated.cells);
      for (let row = 0; row <= state.definition.height - bounds.height; row += 1) {
        for (let column = 0; column <= state.definition.width - bounds.width; column += 1) {
          if (canPlace(state.board, rotated.cells, { row, column })) return true;
        }
      }
      return false;
    }));
}

const endlessInvalid = (state, action, reason) => ({
  state, events: [{ type: 'invalid', action, reason }],
});

const appendEndlessCommand = (state, command, record) => record
  ? { ...state, commandLog: [...(state.commandLog ?? []), structuredClone(command)] }
  : state;

const reduceEndlessInternal = (state, action, {
  record = true, retainHistory = true,
} = {}) => {
  if (['terminal', 'error', 'disposed'].includes(state.status)) return { state, events: [] };
  if (action.type === 'start') {
    if (state.status === 'active') return { state, events: [] };
    return state.status === 'preview'
      ? { state: appendEndlessCommand({ ...state, status: 'active' },
        { type: 'start' }, record), events: [{ type: 'started' }] }
      : endlessInvalid(state, 'start', 'Endless Yard cannot start from this state.');
  }
  if (action.type === 'pause') {
    if (state.status === 'paused') return { state, events: [] };
    if (state.status !== 'active' || !['user', 'hidden'].includes(action.reason)) {
      return endlessInvalid(state, 'pause', 'Endless Yard cannot pause from this state.');
    }
    return { state: appendEndlessCommand({ ...state, status: 'paused' },
      { type: 'pause', reason: action.reason }, record),
      events: [{ type: 'paused', reason: action.reason }] };
  }
  if (action.type === 'resume') {
    if (state.status === 'active') return { state, events: [] };
    return state.status === 'paused'
      ? { state: appendEndlessCommand({ ...state, status: 'active' },
        { type: 'resume' }, record), events: [{ type: 'resumed' }] }
      : endlessInvalid(state, 'resume', 'Endless Yard cannot resume from this state.');
  }
  if (state.status !== 'active') return endlessInvalid(state, action.type, 'Game is paused.');
  if (action.type === 'set-focus') {
    const focus = action.focus;
    if (!isRecord(focus)
        || !sameJson(Object.keys(focus).sort(), ['column', 'row'])
        || !Number.isInteger(focus.row) || !Number.isInteger(focus.column)
        || focus.row < 0 || focus.row >= state.definition.height
        || focus.column < 0 || focus.column >= state.definition.width) {
      return endlessInvalid(state, action.type, 'Focus must be an in-bounds Yard cell.');
    }
    if (focus.row === state.focus.row && focus.column === state.focus.column) {
      return { state, events: [] };
    }
    const nextFocus = { row: focus.row, column: focus.column };
    return { state: appendEndlessCommand({ ...state, focus: nextFocus },
      { type: 'set-focus', focus: nextFocus }, record),
    events: [{ type: 'focus-changed', focus: nextFocus }] };
  }
  if (action.type === 'hint') {
    return endlessInvalid(state, 'hint', 'Hint is unavailable in Endless Yard.');
  }
  if (action.type === 'select-piece') {
    const piece = state.tray.find((value) => value.pieceId === action.pieceId);
    return piece
      ? { state: appendEndlessCommand({ ...state, selectedPieceId: piece.pieceId },
        { type: 'select-piece', pieceId: piece.pieceId }, record),
        events: [{ type: 'selected', pieceId: piece.pieceId }] }
      : endlessInvalid(state, action.type, 'Unknown cargo piece.');
  }
  if (action.type === 'rotate-piece') {
    if (action.quarterTurns !== 1) {
      return endlessInvalid(state, action.type, 'Rotation must be one quarter turn.');
    }
    const index = state.tray.findIndex((value) => value.pieceId === state.selectedPieceId);
    if (index < 0) return endlessInvalid(state, action.type, 'Choose cargo first.');
    const piece = state.tray[index];
    const rotationIndex = piece.allowedRotations.indexOf(piece.rotation);
    const rotation = piece.allowedRotations[(rotationIndex + 1) % piece.allowedRotations.length];
    if (rotation === piece.rotation) {
      return endlessInvalid(state, action.type, 'This cargo has one fixed orientation.');
    }
    const tray = state.tray.map((value, pieceIndex) => (
      pieceIndex === index ? { ...value, rotation } : value
    ));
    return { state: appendEndlessCommand({ ...state, tray },
      { type: 'rotate-piece', quarterTurns: 1 }, record),
      events: [{ type: 'rotated', pieceId: piece.pieceId, rotation }] };
  }
  if (action.type === 'undo') {
    if (state.history.length === 0) return { state, events: [] };
    const restored = structuredClone(state.history.at(-1));
    const next = { ...state, ...restored, assisted: true,
      history: state.history.slice(0, -1) };
    return { state: appendEndlessCommand(next, { type: 'undo' }, record),
    events: [
      ...(state.assisted ? [] : [{ type: 'assisted', reason: 'endless-undo' }]),
      { type: 'undone', mode: 'endless', assisted: true },
    ] };
  }
  if (action.type !== 'place-piece') {
    return endlessInvalid(state, action.type, 'Unsupported Endless Yard action.');
  }

  const piece = state.tray.find((value) => value.pieceId === state.selectedPieceId);
  const rotated = piece && rotationsFor(piece.typeId, piece.allowedRotations)
    .find((value) => value.rotation === piece.rotation);
  const origin = { row: action.row, column: action.column };
  if (!piece || !rotated || !Number.isInteger(action.row) || !Number.isInteger(action.column)
      || !canPlace(state.board, rotated.cells, origin)) {
    return endlessInvalid(state, action.type, 'Cargo does not fit here.');
  }

  const history = retainHistory
    ? [...state.history, endlessSnapshot(state)] : state.history;
  const placedBoard = placePiece(state.board, { pieceId: piece.pieceId,
    typeId: piece.typeId, rotation: piece.rotation, ...origin });
  const placementScore = 10 * rotated.cells.length;
  let board = placedBoard;
  let manifests = state.manifests;
  let manifestIndex = state.manifestIndex;
  let combo = state.combo;
  let bestCombo = state.bestCombo;
  let dispatchedManifests = state.dispatchedManifests;
  let score = saturatingAdd(state.score, placementScore);
  const events = [{ type: 'placed', mode: 'endless', pieceId: piece.pieceId,
    row: action.row, column: action.column, rotation: piece.rotation,
    scoreAdded: placementScore }];
  const dispatched = dispatchCompletedManifests(placedBoard, state.manifests);
  if (dispatched.completed.length > 0) {
    combo = saturatingAdd(combo, 1);
    bestCombo = Math.max(bestCombo, combo);
    const dispatchScore = Math.min(Number.MAX_SAFE_INTEGER,
      100 * dispatched.dispatchedCells * combo);
    score = saturatingAdd(score, dispatchScore);
    dispatchedManifests = saturatingAdd(dispatchedManifests, dispatched.completed.length);
    board = dispatched.board;
    const completedIds = new Set(dispatched.completed.map(({ id }) => id));
    const incomplete = state.manifests.filter(({ id }) => !completedIds.has(id));
    events.push({ type: 'dispatch',
      manifestIds: dispatched.completed.map(({ id }) => id),
      cells: dispatched.dispatchedCells, combo, scoreAdded: dispatchScore });
    try {
      const replacement = selectNextManifestZones({ board,
        width: state.definition.width, height: state.definition.height,
        shapeIds: ENDLESS_RULES[state.definition.difficulty].manifestShapeIds,
        seed: state.definition.seed, startIndex: manifestIndex,
        count: dispatched.completed.length,
        occupied: incomplete.flatMap(({ cells }) => cells) });
      manifests = [...incomplete, ...replacement.manifests];
      manifestIndex = replacement.nextIndex;
    } catch {
      const tray = state.tray.filter((value) => value.pieceId !== piece.pieceId);
      return { state: { ...state, board, score, combo, bestCombo,
        manifests: incomplete, dispatchedManifests, history, tray,
        selectedPieceId: tray[0]?.pieceId ?? null, status: 'error',
        commandLog: record ? [...(state.commandLog ?? []), {
          type: 'place-piece', row: action.row, column: action.column,
        }] : state.commandLog },
      events: [...events, { type: 'error', code: 'manifest-generation',
        message: 'A new Cargo Manifest could not be prepared.' }] };
    }
  } else if (combo > 0) {
    events.push({ type: 'combo-reset', previousCombo: combo });
    combo = 0;
  }

  let tray = state.tray.filter((value) => value.pieceId !== piece.pieceId);
  let sequenceIndex = state.sequenceIndex;
  let batchIndex = state.batchIndex;
  if (tray.length === 0) {
    batchIndex = saturatingAdd(batchIndex, 1);
    tray = dealEndlessBatch(state.definition, sequenceIndex, batchIndex);
    sequenceIndex = saturatingAdd(sequenceIndex, 3);
  }
  let next = { ...state, board, tray, selectedPieceId: tray[0].pieceId,
    manifests, manifestIndex, sequenceIndex, batchIndex, score, combo, bestCombo,
    dispatchedManifests, history };
  if (!hasAnyEndlessPlacement(next)) {
    next = { ...next, status: 'terminal', terminalReason: 'no-placement' };
    events.push({ type: 'terminal', reason: 'no-placement' });
  }
  return { state: appendEndlessCommand(next, {
    type: 'place-piece', row: action.row, column: action.column,
  }, record), events };
};

export function reduceEndless(state, action) {
  return reduceEndlessInternal(state, action);
}

export function yardDefinitionSignature(definition) {
  if (definition?.mode === 'contracts') return contractSignature(definition);
  if (definition?.mode === 'endless') return endlessSignature(definition);
  throw new TypeError('Invalid Yard definition mode');
}

export function createYardState(definition) {
  if (definition?.mode === 'contracts' && validateContractDefinition(definition).valid) {
    return createContractState(definition);
  }
  if (definition?.mode === 'endless') return createEndlessState(definition);
  throw new TypeError('Invalid Yard definition');
}

export function prepareYardForContinue(play) {
  if (play?.kind === 'contracts') return prepareContractForContinue(play);
  if (play?.kind === 'endless') return prepareEndlessForContinue(play);
  throw new TypeError('Invalid Yard state kind');
}

export function reduceYard(state, action) {
  if (state?.kind === 'contracts') return reduceContract(state, action);
  if (state?.kind === 'endless') return reduceEndless(state, action);
  throw new TypeError('Invalid Yard state kind');
}

export function validateYardState(value, difficulty, mode) {
  if (mode === 'contracts') return validateContractState(value, difficulty);
  if (mode === 'endless') return validateEndlessState(value, difficulty);
  return { valid: false, errors: ['invalid Yard mode'] };
}

const safeCount = (value) => Number.isSafeInteger(value) && value >= 0;

export function yardCompletionPayload(state, elapsedMs) {
  if (state?.status !== 'terminal') return null;
  if (!safeCount(elapsedMs)) {
    throw new TypeError('Elapsed time must be a non-negative safe integer');
  }
  if (state.kind === 'contracts') return {
    game: 'kinnoki-yard', mode: 'contracts',
    records: { time: elapsedMs, moves: state.moves },
    summary: { elapsedMs, moves: state.moves, assisted: state.assisted,
      piecesPlaced: Object.keys(state.placements).length,
      totalPieces: state.definition.pieces.length },
  };
  if (state.kind === 'endless' && state.terminalReason === 'no-placement') return {
    game: 'kinnoki-yard', mode: 'endless',
    records: { score: state.score, combo: state.bestCombo },
    summary: { score: state.score, dispatchedManifests: state.dispatchedManifests,
      bestCombo: state.bestCombo, elapsedMs, assisted: state.assisted,
      reason: 'no-placement' },
  };
  return null;
}

const endlessSnapshotKeys = Object.freeze([
  'batchIndex', 'bestCombo', 'board', 'combo', 'dispatchedManifests', 'focus',
  'manifestIndex', 'manifests', 'score', 'selectedPieceId', 'sequenceIndex', 'tray',
]);

const endlessPositionErrors = (position, definition, rules) => {
  const errors = [];
  if (!validateBoard(position?.board, {
    width: rules.width, height: rules.height,
  }).valid) errors.push('invalid Endless board');

  for (const key of ['manifestIndex', 'sequenceIndex', 'batchIndex', 'score',
    'combo', 'bestCombo', 'dispatchedManifests']) {
    if (!safeCount(position?.[key])) errors.push(`invalid Endless ${key}`);
  }
  if (safeCount(position?.combo) && safeCount(position?.bestCombo)
      && position.bestCombo < position.combo) errors.push('invalid Endless best combo');

  const expectedBatch = safeCount(position?.sequenceIndex)
    && position.sequenceIndex >= 3 && position.sequenceIndex % 3 === 0
    ? (position.sequenceIndex / 3) - 1 : null;
  if (expectedBatch === null || position?.batchIndex !== expectedBatch) {
    errors.push('invalid Endless stream indices');
  }
  if (!Array.isArray(position?.tray)
      || position.tray.length < 1 || position.tray.length > 3) {
    errors.push('invalid Endless tray');
  } else if (expectedBatch !== null) {
    const firstPieceId = position.sequenceIndex - 3;
    let previousPieceId = firstPieceId - 1;
    for (const piece of position.tray) {
      let expected;
      try { expected = endlessPieceAt(definition, piece?.pieceId, expectedBatch); } catch {}
      if (!expected || piece.pieceId < firstPieceId || piece.pieceId >= position.sequenceIndex
          || piece.pieceId <= previousPieceId
          || piece.batchIndex !== expectedBatch
          || piece.typeId !== expected.typeId
          || JSON.stringify(piece.allowedRotations) !== JSON.stringify(expected.allowedRotations)
          || !piece.allowedRotations.includes(piece.rotation)) {
        errors.push('invalid Endless tray piece');
      }
      previousPieceId = piece?.pieceId;
    }
  }
  if (!position?.tray?.some((piece) => piece.pieceId === position.selectedPieceId)) {
    errors.push('invalid Endless selection');
  }
  if (!Number.isInteger(position?.focus?.row)
      || !Number.isInteger(position?.focus?.column)
      || position.focus.row < 0 || position.focus.row >= rules.height
      || position.focus.column < 0 || position.focus.column >= rules.width) {
    errors.push('invalid Endless focus');
  }

  const manifestCells = new Set();
  const manifestIds = new Set();
  if (!Array.isArray(position?.manifests)
      || position.manifests.length !== rules.manifestCount) {
    errors.push('invalid Endless manifests');
  } else {
    for (const manifest of position.manifests) {
      if (!validateManifest(manifest, { width: rules.width, height: rules.height }).valid
          || manifestIds.has(manifest.id)) errors.push('invalid Endless manifest');
      manifestIds.add(manifest.id);
      for (const cell of manifest.cells ?? []) {
        const key = keyFor(cell);
        if (manifestCells.has(key)) errors.push('overlapping Endless manifests');
        manifestCells.add(key);
      }
    }
  }
  const trayIds = new Set((position?.tray ?? []).map(({ pieceId }) => pieceId));
  if ((position?.board ?? []).flat().some((cell) => cell && trayIds.has(cell.pieceId))) {
    errors.push('Endless tray cargo is already on the board');
  }
  try {
    if (dispatchCompletedManifests(position.board, position.manifests).completed.length > 0) {
      errors.push('completed Endless manifest was not dispatched');
    }
  } catch {
    errors.push('invalid Endless dispatch state');
  }
  return errors;
};

const sameJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const endlessReplayFields = Object.freeze([
  'assisted', 'batchIndex', 'bestCombo', 'board', 'combo', 'dispatchedManifests',
  'focus', 'kind', 'manifestIndex', 'manifests', 'score',
  'selectedPieceId', 'sequenceIndex', 'status', 'terminalReason', 'tray',
]);

const exactCommandKeys = (command, keys) => sameJson(Object.keys(command).sort(), keys);
const validEndlessCommand = (command) => {
  if (!isRecord(command) || typeof command.type !== 'string') return false;
  if (['start', 'resume', 'undo', 'prepare-continue'].includes(command.type)) {
    return exactCommandKeys(command, ['type']);
  }
  if (command.type === 'pause') {
    return exactCommandKeys(command, ['reason', 'type'])
      && ['user', 'hidden'].includes(command.reason);
  }
  if (command.type === 'select-piece') {
    return exactCommandKeys(command, ['pieceId', 'type']) && safeCount(command.pieceId);
  }
  if (command.type === 'set-focus') {
    return exactCommandKeys(command, ['focus', 'type'])
      && isRecord(command.focus)
      && sameJson(Object.keys(command.focus).sort(), ['column', 'row'])
      && Number.isInteger(command.focus.row)
      && Number.isInteger(command.focus.column);
  }
  if (command.type === 'rotate-piece') {
    return exactCommandKeys(command, ['quarterTurns', 'type']) && command.quarterTurns === 1;
  }
  if (command.type === 'place-piece') {
    return exactCommandKeys(command, ['column', 'row', 'type'])
      && Number.isInteger(command.row) && Number.isInteger(command.column);
  }
  return false;
};

const replayEndlessHistory = (value, definition) => {
  if (!Array.isArray(value?.commandLog) || !Array.isArray(value?.history)) return false;
  try {
    let replay = createEndlessState(definition);
    const snapshots = [];
    for (const command of value.commandLog) {
      if (!validEndlessCommand(command)) return false;
      if (command.type === 'prepare-continue') {
        if (replay.status === 'terminal') return false;
        replay = { ...replay, status: 'paused' };
        continue;
      }
      if (command.type === 'undo') {
        if (replay.status !== 'active' || snapshots.length === 0) return false;
        replay = { ...replay, ...structuredClone(snapshots.pop()),
          assisted: true, history: [] };
        continue;
      }
      const snapshot = command.type === 'place-piece' ? endlessSnapshot(replay) : null;
      const result = reduceEndlessInternal(replay, command, {
        record: false, retainHistory: false,
      });
      if (result.state === replay) return false;
      replay = result.state;
      if (snapshot) snapshots.push(snapshot);
    }
    return sameJson(value.history, snapshots)
      && endlessReplayFields.every((field) => sameJson(value?.[field], replay[field]));
  } catch {
    return false;
  }
};

export function validateEndlessState(value, difficulty) {
  const errors = [];
  try {
    const rules = ENDLESS_RULES[difficulty];
    const definition = value?.definition;
    if (value?.kind !== 'endless') errors.push('invalid Endless kind');
    if (!['preview', 'active', 'paused', 'terminal'].includes(value?.status)
        || (value.status === 'terminal'
          ? value?.terminalReason !== 'no-placement'
          : value?.terminalReason !== null)) {
      errors.push('invalid saved Endless status');
    }
    let expectedDefinition;
    try {
      expectedDefinition = createEndlessDefinition({
        difficulty, seed: definition?.seed,
      });
    } catch {}
    if (!rules || JSON.stringify(definition) !== JSON.stringify(expectedDefinition)) {
      errors.push('invalid Endless definition');
    } else {
      errors.push(...endlessPositionErrors(value, definition, rules));
    }
    if (typeof value?.assisted !== 'boolean' || !Array.isArray(value?.history)) {
      errors.push('invalid Endless history');
    } else if (value.history.some((entry) => (
      !isRecord(entry)
      || JSON.stringify(Object.keys(entry).sort()) !== JSON.stringify(endlessSnapshotKeys)
      || endlessPositionErrors(entry, definition, rules).length > 0
    ))) {
      errors.push('invalid Endless history');
    }
    if (!expectedDefinition || !replayEndlessHistory(value, expectedDefinition)) {
      errors.push('invalid Endless action history');
    }
  } catch {
    errors.push('invalid Endless state');
  }
  return { valid: errors.length === 0, errors };
}
