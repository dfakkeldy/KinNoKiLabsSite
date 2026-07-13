import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CARGO_CATALOG, MANIFEST_POOLS, MANIFEST_SHAPES,
  boundsFor, normalizeCells, rotateCells, rotationsFor,
  canPlace, connectedComponents, dispatchCompletedManifests,
  isManifestComplete, placePiece, selectManifestZones, validateBoard, validateManifest,
} from '../../Resources/games/cargo-geometry.js';

const board = (width, height) => Array.from({ length: height }, () => Array(width).fill(null));

test('cargo catalogue spans two through five cells with stable text and patterns', () => {
  assert.ok(CARGO_CATALOG.length >= 12);
  assert.deepEqual([...new Set(CARGO_CATALOG.map((piece) => piece.cells.length))].sort(), [2, 3, 4, 5]);
  assert.equal(new Set(CARGO_CATALOG.map((piece) => piece.id)).size, CARGO_CATALOG.length);
  for (const piece of CARGO_CATALOG) {
    assert.match(piece.id, /^[a-z][a-z0-9-]+$/);
    assert.ok(piece.label.length >= 4);
    assert.match(piece.pattern, /^(solid|dots|diagonal|crosshatch|bands)$/);
    assert.deepEqual(piece.cells, normalizeCells(piece.cells));
  }
  const fourCellShapes = CARGO_CATALOG.filter((piece) => piece.cells.length === 4);
  assert.notEqual(fourCellShapes.length, 7);
});

test('rotations normalize origin, sort coordinates, and remove duplicates', () => {
  assert.deepEqual(normalizeCells([
    { row: 4, column: 6 }, { row: 3, column: 6 }, { row: 4, column: 7 },
  ]), [{ row: 0, column: 0 }, { row: 1, column: 0 }, { row: 1, column: 1 }]);
  assert.equal(rotationsFor('crate-pair').length, 2);
  assert.deepEqual(boundsFor(rotateCells([
    { row: 0, column: 0 }, { row: 0, column: 1 },
  ])), { width: 1, height: 2 });
});

test('manifest catalogues expose exact Stack and Endless difficulty pools', () => {
  assert.deepEqual(MANIFEST_POOLS.stack.easy, ['rectangle-eight']);
  assert.deepEqual(MANIFEST_POOLS.stack.medium, ['rectangle-six', 'rectangle-eight', 'step-five', 'step-seven']);
  assert.deepEqual(MANIFEST_POOLS.stack.hard, ['step-five', 'step-seven', 'corner-six', 'harbour-seven']);
  assert.deepEqual(MANIFEST_POOLS.endless.easy, ['rectangle-eight']);
  assert.deepEqual(MANIFEST_POOLS.endless.medium, ['rectangle-six', 'step-five', 'step-seven']);
  assert.deepEqual(MANIFEST_POOLS.endless.hard, ['step-five', 'corner-six', 'harbour-seven']);
  assert.equal(new Set(MANIFEST_SHAPES.map((shape) => shape.id)).size, 6);
});

test('placement preserves piece identity and rejects collision or bounds', () => {
  const empty = board(4, 4);
  const piece = { pieceId: 7, typeId: 'crate-pair', rotation: 0, row: 1, column: 1 };
  const placed = placePiece(empty, piece);
  assert.equal(placed[1][1].pieceId, 7);
  assert.equal(canPlace(placed, rotationsFor('crate-pair')[0].cells, { row: 1, column: 1 }), false);
  assert.equal(canPlace(empty, rotationsFor('crate-pair')[0].cells, { row: -1, column: 0 }), false);
});

test('dispatch removes only completed manifest cells and components split cleanly', () => {
  const occupied = board(5, 3);
  for (let column = 0; column < 5; column += 1) occupied[1][column] = { pieceId: 1, typeId: 'barge-five' };
  for (let column = 1; column <= 3; column += 1) occupied[0][column] = { pieceId: 2, typeId: 'barge-three' };
  const manifest = {
    id: 'manifest-1', shapeId: 'rectangle-six', rotation: 0,
    origin: { row: 0, column: 1 }, label: 'Six-cell rectangular manifest', pattern: 'bands',
    cells: [
      { row: 0, column: 1 }, { row: 0, column: 2 }, { row: 0, column: 3 },
      { row: 1, column: 1 }, { row: 1, column: 2 }, { row: 1, column: 3 },
    ],
  };
  assert.deepEqual(validateManifest(manifest, { width: 5, height: 3 }), { valid: true, errors: [] });
  assert.equal(isManifestComplete(occupied, manifest), true);
  const result = dispatchCompletedManifests(occupied, [manifest]);
  assert.equal(result.board[1][2], null);
  assert.equal(result.board[1][0].pieceId, 1);
  assert.equal(result.board[1][4].pieceId, 1);
  assert.equal(connectedComponents(result.board).length, 2);
  assert.equal(validateManifest({ ...manifest, label: 'Forged label' }, { width: 5, height: 3 }).valid, false);
  assert.equal(validateManifest({ ...manifest, pattern: 'forged-pattern' }, { width: 5, height: 3 }).valid, false);
});

test('requesting zero manifest zones returns the exact empty selection', () => {
  assert.deepEqual(selectManifestZones({
    board: board(4, 4), width: 4, height: 4,
    shapeIds: ['rectangle-six'], seed: 1, index: 0, count: 0,
  }), []);
});

test('hostile boards fail closed', () => {
  assert.deepEqual(validateBoard([[{ pieceId: -1, typeId: '<script>' }]], { width: 1, height: 1 }),
    { valid: false, errors: ['invalid cell at 0:0'] });
});
