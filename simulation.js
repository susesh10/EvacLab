export const floor = [
  '#######################',
  '#.........#...........#',
  '#.........#...........#',
  '#.........#...........#',
  '#####.###########.#####',
  'W.....................E',
  '#.....................#',
  '#####.###########.#####',
  '#.........#...........#',
  '#.........#...........#',
  '#.........#...........#',
  '#######################',
];

export const columns = floor[0].length;
export const exits = { West: 5 * columns, East: 6 * columns - 1 };
export const stepSeconds = 0.5;
export const fireSpreadSeconds = 2;

const starts = [[2, 1], [5, 2], [8, 3], [3, 3], [13, 1], [17, 2],
  [20, 3], [3, 8], [6, 9], [8, 10], [15, 8], [20, 10]];
const directions = [[0, -1], [-1, 0], [1, 0], [0, 1]];

function routesFromExits(blocked, layout, fire = new Set()) {
  const { floor, exits, columns } = layout;
  const queue = Object.keys(exits).filter(name => !blocked.has(name) && !fire.has(exits[name])).map(name => exits[name]);
  const next = new Map(queue.map(cell => [cell, cell]));
  for (let i = 0; i < queue.length; i++) {
    const cell = queue[i];
    const x = cell % columns;
    const y = Math.floor(cell / columns);
    for (const [dx, dy] of directions) {
      const tile = floor[y + dy]?.[x + dx];
      const neighbor = cell + dy * columns + dx;
      if (tile !== '.' || fire.has(neighbor) || next.has(neighbor)) continue;
      next.set(neighbor, cell);
      queue.push(neighbor);
    }
  }
  return next;
}

export const defaultLayout = { floor, exits, columns, starts };

export function createSimulation(initialBlocked = [], layout = defaultLayout) {
  const blocked = new Set(initialBlocked);
  const fire = new Set(layout.fires ?? []);
  const occupants = layout.starts.map(([x, y]) => ({
    cell: y * layout.columns + x, arrival: null, affected: fire.has(y * layout.columns + x),
  }));
  return { layout, occupants, blocked, fire, next: routesFromExits(blocked, layout, fire), tick: 0 };
}

export function setExitBlocked(sim, name, blocked) {
  if (blocked) sim.blocked.add(name);
  else sim.blocked.delete(name);
  sim.next = routesFromExits(sim.blocked, sim.layout, sim.fire);
}

function fireFrontier(sim) {
  const cells = new Set();
  const { floor, columns } = sim.layout;
  for (const cell of sim.fire) {
    const x = cell % columns;
    const y = Math.floor(cell / columns);
    for (const [dx, dy] of directions) {
      const tile = floor[y + dy]?.[x + dx];
      const neighbor = cell + dy * columns + dx;
      if (tile && tile !== '#' && !sim.fire.has(neighbor)) cells.add(neighbor);
    }
  }
  return cells;
}

export function advance(sim) {
  const active = sim.occupants.filter(person => person.arrival === null && !person.affected);
  if (!active.length) return false;
  const frontier = fireFrontier(sim);
  if (!frontier.size && active.every(person => !sim.next.has(person.cell))) return false;
  sim.tick++;
  // Fire spreads before movement on the same tick. Newly ignited cells spread next interval.
  if (sim.tick % (fireSpreadSeconds / stepSeconds) === 0) {
    for (const cell of frontier) sim.fire.add(cell);
    sim.next = routesFromExits(sim.blocked, sim.layout, sim.fire);
  }
  for (const person of active) {
    if (sim.fire.has(person.cell)) {
      person.affected = true;
      continue;
    }
    if (!sim.next.has(person.cell)) continue;
    person.cell = sim.next.get(person.cell);
    if (sim.next.get(person.cell) === person.cell) person.arrival = sim.tick * stepSeconds;
  }
  return true;
}

export function metrics(sim) {
  const arrivals = sim.occupants.map(person => person.arrival).filter(time => time !== null);
  return {
    evacuated: arrivals.length,
    affected: sim.occupants.filter(person => person.affected).length,
    burning: sim.fire.size,
    waiting: sim.occupants.filter(person => person.arrival === null && !person.affected && !sim.next.has(person.cell)).length,
    elapsed: sim.tick * stepSeconds,
    total: arrivals.length > 0 && arrivals.length === sim.occupants.length ? Math.max(...arrivals) : null,
    mean: arrivals.length ? arrivals.reduce((sum, time) => sum + time, 0) / arrivals.length : null,
  };
}

export function compare(layout = defaultLayout, closedExit = Object.keys(layout.exits)[0]) {
  return [[], [closedExit]].map(blocked => {
    const sim = createSimulation(blocked, layout);
    while (advance(sim)) {}
    return metrics(sim);
  });
}

export function layoutFromGrid(grid) {
  const floor = grid.map(row => row.map(tile => tile === 'P' || tile === 'F' ? '.' : tile).join(''));
  const columns = floor[0].length;
  const exits = {};
  const starts = [];
  const fires = [];
  grid.forEach((row, y) => row.forEach((tile, x) => {
    if (tile === 'E') exits['Exit ' + (Object.keys(exits).length + 1)] = y * columns + x;
    if (tile === 'P') starts.push([x, y]);
    if (tile === 'F') fires.push(y * columns + x);
  }));
  return { floor, columns, exits, starts, fires };
}

export function validateLayout(layout) {
  if (!Object.keys(layout.exits).length) return 'Add at least one exit.';
  if (!layout.starts.length) return 'Add at least one occupant.';
  const sim = createSimulation([], { ...layout, fires: [] });
  const waiting = metrics(sim).waiting;
  if (waiting) return waiting + ' occupant(s) have no route to an exit. Open a path or move them.';
  return '';
}
