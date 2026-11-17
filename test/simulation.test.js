import assert from 'node:assert/strict';
import test from 'node:test';
import { advance, columns, compare, createSimulation, exits, floor, metrics, setExitBlocked } from '../simulation.js';

test('fixed starts give reproducible before and after results', () => {
  assert.deepEqual(compare().map(({ evacuated, total, mean }) => [evacuated, total, mean]), [
    [12, 6.5, 5.25],
    [12, 12.5, 8.75],
  ]);
});

test('closing the west exit mid-run sends remaining occupants east', () => {
  const sim = createSimulation();
  while (!sim.occupants.some(person => person.arrival !== null && person.cell === exits.West)) {
    assert.equal(advance(sim), true);
  }
  const remaining = sim.occupants.filter(person => person.arrival === null);
  assert.ok(remaining.length);
  setExitBlocked(sim, 'West', true);
  for (let tick = 0; tick < floor.length * columns && advance(sim); tick++) {}
  assert.equal(metrics(sim).evacuated, 12);
  assert.ok(remaining.every(person => person.cell === exits.East));
  assert.ok(sim.occupants.some(person => person.cell === exits.West));
});

test('all-blocked occupants wait in place and resume when an exit reopens', () => {
  const sim = createSimulation(['West', 'East']);
  const cells = sim.occupants.map(person => person.cell);
  assert.equal(advance(sim), false);
  assert.equal(metrics(sim).waiting, 12);
  assert.equal(metrics(sim).total, null);
  assert.deepEqual(sim.occupants.map(person => person.cell), cells);
  setExitBlocked(sim, 'West', false);
  for (let tick = 0; tick < floor.length * columns && advance(sim); tick++) {}
  assert.equal(metrics(sim).evacuated, 12);
  assert.ok(sim.occupants.every(person => person.cell === exits.West));
});

test('route edges are adjacent and stay on walkable tiles', () => {
  assert.ok(floor.every(row => row.length === columns));
  const sim = createSimulation();
  for (const [cell, next] of sim.next) {
    if (cell === next) continue;
    const x = cell % columns;
    const y = Math.floor(cell / columns);
    const nextX = next % columns;
    const nextY = Math.floor(next / columns);
    assert.equal(Math.abs(x - nextX) + Math.abs(y - nextY), 1);
    assert.notEqual(floor[nextY][nextX], '#');
  }
});

test('custom maps compute paths around walls and compare a chosen exit', async () => {
  const { layoutFromGrid, validateLayout } = await import('../simulation.js');
  const layout = layoutFromGrid(['E..#E', '.#.#.', 'P....'].map(row => [...row]));
  assert.equal(validateLayout(layout), '');
  assert.deepEqual(compare(layout, 'Exit 1').map(result => result.total), [1, 3]);
  assert.deepEqual(compare(layout, 'Exit 2').map(result => result.total), [1, 1]);
});

test('editor validation catches missing exits, people and disconnected people', async () => {
  const { layoutFromGrid, validateLayout } = await import('../simulation.js');
  for (const [row, expected] of [['P..', /exit/], ['E..', /occupant/], ['E#P', /no route/]]) {
    assert.match(validateLayout(layoutFromGrid([[...row]])), expected);
  }
});

test('blocked custom exit reports incomplete evacuation and recovers', async () => {
  const { layoutFromGrid } = await import('../simulation.js');
  const layout = layoutFromGrid([['E', '.', 'P']]);
  const result = compare(layout)[1];
  assert.equal(result.total, null);
  assert.equal(result.mean, null);
  assert.equal(result.waiting, 1);
  const sim = createSimulation(['Exit 1'], layout);
  assert.equal(advance(sim), false);
  setExitBlocked(sim, 'Exit 1', false);
  assert.equal(advance(sim), true);
  assert.equal(advance(sim), true);
  assert.equal(metrics(sim).total, 1);
});

test('open grid edges never wrap into another row', async () => {
  const { layoutFromGrid } = await import('../simulation.js');
  const layout = layoutFromGrid(['..E', 'P..'].map(row => [...row]));
  assert.equal(compare(layout)[0].total, 1.5);
});
