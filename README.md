# Nusa Drive

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/radeisv/nusa-drive/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/radeisv/nusa-drive/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Nusa Drive is a 3D open-world crime game set on a fictional tropical island that the game invents from scratch: a downtown of towers, a marina, a beach, a highway ring, and a long bridge out to a second island with an airport — runway, terminal, control tower, hangar, and parked planes. You play Raka, a young courier trying to make rent, taking jobs from the fixer Mira. Every street, name, face and sound in the game is original; nothing is borrowed from any commercial game.

## The story

Four jobs, in order, each paying cash and unlocking the next:

1. **First Run** — a timed courier delivery across the bridge to the airport cargo bay (180 seconds on the clock).
2. **Cab Call** — pick up a client at the marina and drive them to the downtown hotel; a taxi keeps it quiet.
3. **Borrowed Beauty** — lift the red sports car from the marina showroom and deliver it to the marina garage.
4. **The Big One** — the airport heist, ending in a full police escape.

Finishing the cab job also unlocks repeatable taxi fares, and the highway hides a checkpoint time trial for extra cash.

## How it plays

- **On foot** — third-person, WASD to move, mouse to look (click to lock the pointer), Shift to run, Space to jump, E to interact, 1 for fists, 2 for the pistol, click to punch or shoot.
- **Behind the wheel** — walk up to any traffic car and press F to steal it. Five car types share the road: sedan, taxi, pickup, sports, and police cruisers, each with its own speed and grip.
- **Wanted level** — stealing, crashing into people and cars, and shooting raise your stars from 0 to 5. Police cars and foot cops chase, ram, and try to bust you; break line of sight and stay clean to cool down.
- **The city lives** — traffic follows the road graph, pedestrians walk the sidewalks and flee from trouble, and the golden-hour sun, gradient sky, sea, and procedural building facades keep the island sun-soaked.
- **HUD** — health, cash, wanted stars, clock, mission objective, speedometer while driving, and a live minimap showing roads, your position, police, and the mission waypoint.
- **Save** — progress, cash, mission, and position save to localStorage; Continue on the title screen picks up where you left off. Pause with Esc.

## Run it

```sh
node serve.ts
```

Then open <http://localhost:8080> in desktop Chrome. There is no build step and no network request: the game is static files under `game/`, with three.js vendored under `game/vendor/`.

## Structure

- `main.ts` — the entrypoint: copies `game/` and `screenshots/` to the output and writes the dossier.
- `game/index.html` — the page, HUD, and title / pause / game-over screens.
- `game/src/main.js` — boot, the fixed-step loop, screens, save/load, and screenshot mode.
- `game/src/world.js` — the island itself: city, bridge, airport, road graph, and collision.
- `game/src/textures.js` — procedural canvas textures for facades, grass, sky, and effects.
- `game/src/vehicles.js` — cars and pedestrians: traffic AI, stealing, collisions.
- `game/src/player.js` — Raka on foot: movement, punching, shooting, damage.
- `game/src/police.js` — the wanted system and police pursuit.
- `game/src/missions.js` — the four story jobs plus taxi fares and the time trial.
- `game/src/hud.js` — health, cash, stars, objective, minimap, banners, and toasts.
- `game/src/render.js` — the Three.js renderer, golden-hour light, sky, and follow camera.
- `game/src/audio.js` — synthesized WebAudio sound: engine, sirens, impacts, and music.
- `game/src/input.js` — keyboard and mouse, pointer lock, and pause.
- `game/src/shots.js` — the four staged screenshot poses behind `?shot=`.
- `game/src/config.js` — tuning, car types, and story constants.
- `game/src/random.js` — the seeded random generator that makes the city reproducible.
- `game/src/merge.js` — helpers shared by the world and vehicle builders.
- `game/vendor/three.module.min.js` — vendored three.js.
- `screenshots/` — four renders of the game itself (see `shots.json` for the poses).

---

<sub>Entered on [make.fun](https://make.fun/?ref=f62prjm7&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
