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
  const targetKeys = new Set(definition.target.map(keyFor));
  const pieceById = new Map(definition.pieces.map((piece) => [piece.pieceId, piece]));
  const occupied = new Set();
  const fixed = [];
  const fixedEntries = Object.entries(placements).sort(
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
