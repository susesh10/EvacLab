import { advance, columns, compare, createSimulation, defaultLayout, layoutFromGrid, validateLayout, metrics, setExitBlocked, stepSeconds } from './simulation.js';

const element = id => document.getElementById(id);
const canvas = element('map');
const ctx = canvas.getContext('2d');
const play = element('play');
let layout = defaultLayout;
let editing = false;
let draft = [];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const tile = 36;
const seconds = value => value === null ? '—' : `${value.toFixed(1)} s`;
canvas.width = columns * tile;
canvas.height = defaultLayout.floor.length * tile;

let sim = createSimulation();
let running = false;
let started = false;
let lastStep = 0;

function center(cell) {
  return [(cell % columns + 0.5) * tile, (Math.floor(cell / columns) + 0.5) * tile];
}

function draw(progress) {
  layout.floor.forEach((row, y) => [...row].forEach((symbol, x) => {
    const name = Object.keys(layout.exits).find(name => layout.exits[name] === y * columns + x);
    ctx.fillStyle = symbol === '#' ? '#344c67' : symbol === '.'
      ? (y === 5 || y === 6 ? '#1d3348' : '#14273a')
      : sim.blocked.has(name) ? '#ef6c69' : '#3dcda6';
    ctx.fillRect(x * tile, y * tile, tile, tile);
    if (name) {
      ctx.fillStyle = '#0c2921';
      ctx.font = 'bold 11px system-ui';
      ctx.fillText(name === 'West' ? 'W' : name === 'East' ? 'E' : name.replace('Exit ', ''), x * tile + 10, y * tile + 23);
    }
    if (symbol === '.') {
      ctx.strokeStyle = '#294058';
      ctx.strokeRect(x * tile + 0.5, y * tile + 0.5, tile - 1, tile - 1);
    }
  }));

  for (const cell of sim.fire) {
    const [x, y] = center(cell);
    ctx.fillStyle = '#eb6028';
    ctx.fillRect(x - tile / 2, y - tile / 2, tile, tile);
    ctx.fillStyle = '#fff0a0';
    ctx.font = 'bold 20px system-ui';
    ctx.fillText('♨', x - 9, y + 7);
  }

  ctx.strokeStyle = '#65e4d57a';
  ctx.lineWidth = 2;
  for (const person of sim.occupants) {
    if (person.affected || person.arrival !== null || !sim.next.has(person.cell)) continue;
    let cell = person.cell;
    ctx.beginPath();
    ctx.moveTo(...center(cell));
    while (sim.next.get(cell) !== cell) {
      cell = sim.next.get(cell);
      ctx.lineTo(...center(cell));
    }
    ctx.stroke();
  }

  sim.occupants.forEach((person, index) => {
    if (person.affected || person.arrival !== null) return;
    const [fromX, fromY] = center(person.cell);
    const [x, y] = center(sim.next.get(person.cell) ?? person.cell);
    const angle = index * 2.4;
    ctx.beginPath();
    ctx.arc(fromX + (x - fromX) * progress + 4 * Math.cos(angle),
      fromY + (y - fromY) * progress + 4 * Math.sin(angle), 6, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffcf74';
    ctx.fill();
    ctx.strokeStyle = '#102238';
    ctx.stroke();
  });
}

function update() {
  const result = metrics(sim);
  element('clock').textContent = result.elapsed.toFixed(1);
  element('evacuated').textContent = `${result.evacuated} / ${sim.occupants.length}`;
  element('progress').style.width = (100 * result.evacuated / sim.occupants.length) + '%';
  element('hazards').textContent = result.waiting + ' trapped · ' + result.affected + ' affected · ' + result.burning + ' burning cells';
  const complete = result.evacuated + result.affected === sim.occupants.length;
  play.disabled = complete || editing;
  element('reset').disabled = editing;
  element('closures').disabled = editing;
  element('restore').disabled = editing;
  play.textContent = complete ? 'Done' : running ? 'Pause' : started ? 'Resume' : 'Start simulation';
  const status = editing ? 'Editing floor plan · simulation paused' : complete ? (result.affected ? 'Finished · ' + result.affected + ' affected by fire' : `Complete in ${seconds(result.total)}`)
    : result.waiting ? `${result.waiting} trapped without an open route`
    : running ? 'Evacuation in progress' : started ? 'Paused' : 'Ready';
  if (element('status').textContent !== status) element('status').textContent = status;
}

function frame(now) {
  const interval = stepSeconds * 1000;
  if (running && now - lastStep >= interval) {
    advance(sim);
    const result = metrics(sim);
    if (result.evacuated + result.affected === sim.occupants.length) running = false;
    lastStep = now;
    update();
  }
  if (!editing) draw(running && !reducedMotion.matches ? Math.min(1, (now - lastStep) / interval) : 0);
  requestAnimationFrame(frame);
}

play.addEventListener('click', () => {
  running = !running;
  if (running) lastStep = performance.now();
  started = true;
  update();
});


function resetSimulation() {
  sim = createSimulation([], layout);
  running = false;
  started = false;
  element('exit-toggles').replaceChildren();
  for (const name of Object.keys(layout.exits)) {
    const label = document.createElement('label');
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    label.append(toggle, 'Block ' + name);
    toggle.addEventListener('change', () => {
      setExitBlocked(sim, name, toggle.checked);
      lastStep = performance.now();
      update();
    });
    element('exit-toggles').append(label);
  }
  update();
}

function updateComparison() {
  const closedExit = element('comparison-exit').value;
  const [baseline, blocked] = compare(layout, closedExit);
  const scenarios = [['All exits open', baseline], [closedExit + ' blocked', blocked]];
  if (layout.fires?.length) {
    scenarios.unshift(['No fire · all exits open', compare({ ...layout, fires: [] }, closedExit)[0]]);
  }
  element('results').replaceChildren();
  for (const [label, result] of scenarios) {
    const row = element('results').insertRow();
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.textContent = label;
    row.append(heading);
    for (const value of [result.total === null ? 'Incomplete' : seconds(result.total),
      seconds(result.mean), result.evacuated + ' / ' + layout.starts.length, result.waiting, result.affected]) {
      row.insertCell().textContent = value;
    }
  }
  element('difference').textContent = baseline.total === null || blocked.total === null
    ? 'An incomplete scenario has occupants trapped or affected by fire. See the outcome counts above.'
    : 'Closing ' + closedExit + ' adds ' + seconds(blocked.total - baseline.total) + ' to the last occupant’s exit time.';
}

function loadLayout(nextLayout) {
  layout = nextLayout;
  element('plan-title').textContent = layout === defaultLayout ? 'Four-room building' : 'Your custom floor plan';
  element('comparison-exit').replaceChildren();
  for (const name of Object.keys(layout.exits)) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    element('comparison-exit').append(option);
  }
  resetSimulation();
  updateComparison();
}

const tileNames = { '#': 'wall', '.': 'floor', E: 'exit', P: 'occupant', F: 'fire' };

function refreshCell(button, x, y) {
  const symbol = draft[y][x];
  button.className = 'cell ' + tileNames[symbol];
  button.textContent = symbol === 'P' ? '●' : symbol === 'E' ? 'E' : symbol === 'F' ? '♨' : '';
  button.setAttribute('aria-label', 'Row ' + (y + 1) + ', column ' + (x + 1) + ', ' + tileNames[symbol]);
}

function paint(button, x, y) {
  draft[y][x] = document.querySelector('input[name="brush"]:checked').value;
  refreshCell(button, x, y);
  element('editor-message').textContent = '';
}

function renderEditor() {
  const grid = element('grid');
  grid.replaceChildren();
  draft.forEach((row, y) => {
    const rowElement = document.createElement('div');
    rowElement.className = 'grid-row';
    rowElement.setAttribute('role', 'row');
    row.forEach((symbol, x) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('role', 'gridcell');
      button.tabIndex = x === 0 && y === 0 ? 0 : -1;
      refreshCell(button, x, y);
      button.addEventListener('focus', () => {
        grid.querySelectorAll('[tabindex="0"]').forEach(cell => { cell.tabIndex = -1; });
        button.tabIndex = 0;
      });
      button.addEventListener('click', () => paint(button, x, y));
      button.addEventListener('keydown', event => {
        const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
        if (!directions[event.key]) return;
        event.preventDefault();
        const [dx, dy] = directions[event.key];
        const nextX = Math.max(0, Math.min(columns - 1, x + dx));
        const nextY = Math.max(0, Math.min(draft.length - 1, y + dy));
        grid.children[nextY].children[nextX].focus();
      });
      rowElement.append(button);
    });
    grid.append(rowElement);
  });
}

function closeEditor() {
  editing = false;
  element('editor').hidden = true;
  element('simulation-view').hidden = false;
  element('edit').hidden = false;
  update();
  element('edit').focus();
}

element('edit').addEventListener('click', () => {
  running = false;
  editing = true;
  draft = layout.floor.map(row => [...row].map(symbol => symbol === '#' ? '#' : '.'));
  for (const cell of Object.values(layout.exits)) draft[Math.floor(cell / columns)][cell % columns] = 'E';
  for (const cell of layout.fires ?? []) draft[Math.floor(cell / columns)][cell % columns] = 'F';
  for (const [x, y] of layout.starts) draft[y][x] = 'P';
  element('editor-message').textContent = '';
  renderEditor();
  element('editor').hidden = false;
  element('simulation-view').hidden = true;
  element('edit').hidden = true;
  update();
  element('grid').querySelector('button').focus();
});
element('apply').addEventListener('click', () => {
  const nextLayout = layoutFromGrid(draft);
  const error = validateLayout(nextLayout);
  if (error) {
    element('editor-message').textContent = error;
    return;
  }
  closeEditor();
  loadLayout(nextLayout);
});
element('cancel').addEventListener('click', closeEditor);
element('clear').addEventListener('click', () => {
  draft = draft.map(row => row.map(() => '.'));
  renderEditor();
  element('editor-message').textContent = 'Grid cleared. Add exits, occupants and walls.';
});
element('restore').addEventListener('click', () => loadLayout(defaultLayout));
element('reset').addEventListener('click', resetSimulation);
element('comparison-exit').addEventListener('change', updateComparison);
loadLayout(defaultLayout);
requestAnimationFrame(frame);
