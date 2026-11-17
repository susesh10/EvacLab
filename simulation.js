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

const starts = [[2, 1], [5, 2], [8, 3], [3, 3], [13, 1], [17, 2],
  [20, 3], [3, 8], [6, 9], [8, 10], [15, 8], [20, 10]];
const directions = [[0, -1], [-1, 0], [1, 0], [0, 1]];

function routesFromExits(blocked, layout) {
  const { floor, exits, columns } = layout;
  const queue = Object.keys(exits).filter(name => !blocked.has(name)).map(name => exits[name]);
  const next = new Map(queue.map(cell => [cell, cell]));
  for (let i = 0; i < queue.length; i++) {
    const cell = queue[i];
    const x = cell % columns;
    const y = Math.floor(cell / columns);
    for (const [dx, dy] of directions) {
      const tile = floor[y + dy]?.[x + dx];
      const neighbor = cell + dy * columns + dx;
      if (tile !== '.' || next.has(neighbor)) continue;
      next.set(neighbor, cell);
      queue.push(neighbor);
    }
  }
  return next;
}

export const defaultLayout = { floor, exits, columns, starts };

export function createSimulation(initialBlocked = [], layout = defaultLayout) {
  const blocked = new Set(initialBlocked);
  const occupants = layout.starts.map(([x, y]) => ({ cell: y * layout.columns + x, arrival: null }));
  return { layout, occupants, blocked, next: routesFromExits(blocked, layout), tick: 0 };
}

export function setExitBlocked(sim, name, blocked) {
  if (blocked) sim.blocked.add(name);
  else sim.blocked.delete(name);
  sim.next = routesFromExits(sim.blocked, sim.layout);
}

export function advance(sim) {
  if (sim.occupants.every(person => person.arrival !== null || !sim.next.has(person.cell))) return false;
  sim.tick++;
  for (const person of sim.occupants) {
    if (person.arrival !== null || !sim.next.has(person.cell)) continue;
    person.cell = sim.next.get(person.cell);
    if (sim.next.get(person.cell) === person.cell) person.arrival = sim.tick * stepSeconds;
  }
  return true;
}

export function metrics(sim) {
  const arrivals = sim.occupants.map(person => person.arrival).filter(time => time !== null);
  return {
    evacuated: arrivals.length,
    waiting: sim.occupants.filter(person => person.arrival === null && !sim.next.has(person.cell)).length,
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
  const floor = grid.map(row => row.map(tile => tile === 'P' ? '.' : tile).join(''));
  const columns = floor[0].length;
  const exits = {};
  const starts = [];
  grid.forEach((row, y) => row.forEach((tile, x) => {
    if (tile === 'E') exits['Exit ' + (Object.keys(exits).length + 1)] = y * columns + x;
    if (tile === 'P') starts.push([x, y]);
  }));
  return { floor, columns, exits, starts };
}

export function validateLayout(layout) {
  if (!Object.keys(layout.exits).length) return 'Add at least one exit.';
  if (!layout.starts.length) return 'Add at least one occupant.';
  const sim = createSimulation([], layout);
  const waiting = metrics(sim).waiting;
  if (waiting) return waiting + ' occupant(s) have no route to an exit. Open a path or move them.';
  return '';
}
