# EvacLab

Our prototype for HackWithAditya Level 1.

The idea is simple. People need a way out of a building, but what happens if one exit gets blocked? EvacLab simulates this on a 2D floor plan. You can block an exit while people are moving and see them take another route.

## What it does

- Starts with a four-room building and 12 occupants.
- Finds the shortest route to an open exit.
- Updates routes when an exit is blocked or reopened.
- Lets you make your own layout with walls, floors, exits and occupants.
- Compares evacuation times with all exits open and one exit blocked.

## How to run it

You need Python 3 and a modern browser.

Open a terminal in this folder and run

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

On Windows, you can use

```sh
py -m http.server 8765 --bind 127.0.0.1
```

Then open [EvacLab](http://127.0.0.1:8765/) in your browser. Keep the terminal running. Press Ctrl+C when you want to stop the server.

No packages need to be installed. Use the local server to open the app so the JavaScript modules load properly.

## Using the app

Click **Start simulation** to begin. Tick an exit checkbox to block it. People still inside will use another available route. If all exits are blocked, they wait until an exit opens.

**Reset** restarts the current layout. **Restore example building** brings back the original building.

To create a map, click **Edit floor plan**. Pick Wall, Floor, Exit or Occupant and click a cell to place it. Use Floor to erase an item. You can also move with the arrow keys and use Enter or Space to place an item.

Click **Use this floor plan** when you are done. Each occupant needs a route to an exit before the map can be used. **Cancel** discards your edits.

The comparison uses the same map and starting positions for both runs. Choose an exit under **Close in comparison** to block it from the beginning of the second run. This comparison is separate from the live run.

## How routing works

The app uses breadth-first search from all open exits. Since every step has the same cost, this gives the same shortest distances as Dijkstra on this grid. Each occupant moves one cell every 0.5 simulated seconds.

## Current limits

- The editor has a fixed 23 × 12 grid.
- Custom maps are lost when the page is refreshed.
- Maps have to be drawn manually. Image and PDF uploads are not supported.
- People move at the same speed and can overlap.
- Crowd congestion, exit capacity, smoke and reaction delays are not included.
- The simulation clock pauses when everyone still inside has no available route.
- An incomplete comparison means some people could not get out. The average time only includes people who reached an exit.

This is an educational prototype. Its times should not be used for real evacuation planning.

## Built with

HTML, CSS and JavaScript, with Canvas for the simulation. Python serves the files locally.

## Tests

With Node.js 20 or newer installed, run

```sh
npm test
```

The tests check routing, exit closures, evacuation times and custom maps.
