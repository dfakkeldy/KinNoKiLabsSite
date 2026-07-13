import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CARGO_CATALOG, MANIFEST_POOLS, MANIFEST_SHAPES,
  boundsFor, normalizeCells, rotateCells, rotationsFor,
  canPlace, connectedComponents, dispatchCompletedManifests,
  isManifestComplete, placePiece, selectManifestZones, selectNextManifestZones,
  validateBoard, validateManifest,
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

test('cargo catalogue preserves every binding identity, label, pattern, and cell', () => {
  const cargo = (id, label, pattern, cells) => ({ id, label, pattern, cells: cells.map(([row, column]) => ({ row, column })) });
  assert.deepEqual(CARGO_CATALOG, [
    cargo('crate-pair', 'Crate pair', 'dots', [[0, 0], [0, 1]]),
    cargo('barge-three', 'Three-crate barge', 'bands', [[0, 0], [0, 1], [0, 2]]),
    cargo('corner-three', 'Three-crate corner', 'diagonal', [[0, 0], [1, 0], [1, 1]]),
    cargo('dock-square', 'Four-crate dock square', 'crosshatch', [[0, 0], [0, 1], [1, 0], [1, 1]]),
    cargo('hook-four', 'Four-crate hook', 'solid', [[0, 0], [1, 0], [2, 0], [2, 1]]),
    cargo('step-four', 'Four-crate step', 'dots', [[0, 0], [1, 0], [1, 1], [2, 1]]),
    cargo('fork-four', 'Four-crate fork', 'bands', [[0, 1], [1, 0], [1, 1], [1, 2]]),
    cargo('barge-five', 'Five-crate barge', 'diagonal', [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]]),
    cargo('harbour-five', 'Five-crate harbour', 'crosshatch', [[0, 0], [0, 2], [1, 0], [1, 1], [1, 2]]),
    cargo('quay-five', 'Five-crate quay', 'solid', [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]]),
    cargo('zigzag-five', 'Five-crate zigzag', 'dots', [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2]]),
    cargo('anchor-five', 'Five-crate anchor', 'bands', [[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]]),
  ]);
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

test('manifest catalogue preserves every binding identity, metadata, and cell', () => {
  const shape = (id, label, pattern, cells) => ({ id, label, pattern, cells: cells.map(([row, column]) => ({ row, column })) });
  assert.deepEqual(MANIFEST_SHAPES, [
    shape('rectangle-six', 'Six-cell rectangular manifest', 'bands', [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]]),
    shape('rectangle-eight', 'Eight-cell rectangular manifest', 'crosshatch', [[0, 0], [0, 1], [0, 2], [0, 3], [1, 0], [1, 1], [1, 2], [1, 3]]),
    shape('step-five', 'Stepped five-cell manifest', 'diagonal', [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2]]),
    shape('step-seven', 'Stepped seven-cell manifest', 'dots', [[0, 0], [0, 1], [1, 1], [1, 2], [2, 2], [2, 3], [3, 3]]),
    shape('corner-six', 'Corner six-cell manifest', 'bands', [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2]]),
    shape('harbour-seven', 'Harbour seven-cell manifest', 'crosshatch', [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 1], [2, 2]]),
  ]);
});

test('placement preserves piece identity and rejects collision or bounds', () => {
  const empty = board(4, 4);
  const piece = { pieceId: 7, typeId: 'crate-pair', rotation: 0, row: 1, column: 1 };
  const placed = placePiece(empty, piece);
  assert.notStrictEqual(placed[1], empty[1]);
  assert.strictEqual(placed[0], empty[0]);
  assert.strictEqual(placed[2], empty[2]);
  assert.strictEqual(placed[3], empty[3]);
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

test('manifest selection rejects hostile dimensions, seed, index, board, and occupied zones', () => {
  const valid = { board: board(4, 4), width: 4, height: 4, shapeIds: ['rectangle-six'], seed: 1, index: 0, count: 1 };
  for (const override of [
    { width: Infinity }, { height: Infinity }, { width: -1 }, { seed: Infinity }, { seed: -1 },
    { index: Infinity }, { index: -1 }, { board: board(3, 4) },
    { occupied: [{ row: Infinity, column: 0 }] }, { occupied: [{ cells: null }] },
    { occupied: [{ cells: [{ row: 0, column: '0' }] }] },
  ]) assert.throws(() => selectManifestZones({ ...valid, ...override }), TypeError);
});

test('next manifest selection rejects hostile start indices and attempt bounds', () => {
  const valid = { board: board(4, 4), width: 4, height: 4, shapeIds: ['rectangle-six'], seed: 1, count: 1, startIndex: 0 };
  for (const override of [
    { startIndex: Infinity }, { startIndex: -1 }, { maxAttempts: Infinity },
    { maxAttempts: -1 }, { maxAttempts: 1.5 },
    { startIndex: Number.MAX_SAFE_INTEGER, maxAttempts: 2 },
  ]) assert.throws(() => selectNextManifestZones({ ...valid, ...override }), TypeError);
});
