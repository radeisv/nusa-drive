import { TUNING } from './config.js';
import { dist2D } from './world.js';

export const MISSIONS = [
  {
    id: 'm1',
    name: 'First Run',
    giver: 'Mira',
    reward: 300,
    timeLimit: TUNING.mission1TimeSec,
    briefing: 'Mira: Raka, first job. Pick up the package at the plaza fountain, then run it across the bridge to the airport cargo bay. 200 seconds. Don\'t dawdle.',
    steps: [
      { text: 'Pick up the package at the plaza fountain', target: 'plazaPickup', radius: 10 },
      { text: 'Deliver the package to the airport cargo bay', target: 'airportCargo', radius: 12 },
    ],
  },
  {
    id: 'm2',
    name: 'Cab Call',
    giver: 'Mira',
    reward: 250,
    timeLimit: 0,
    briefing: 'Mira: A client needs a ride from the marina to the downtown hotel. Any car will do, but a taxi keeps it quiet. Pick them up.',
    steps: [
      { text: 'Pick up the passenger at the marina', target: 'marinaPickup', radius: 10 },
      { text: 'Drop the passenger at the downtown hotel', target: 'hotelDropoff', radius: 10 },
    ],
  },
  {
    id: 'm3',
    name: 'Borrowed Beauty',
    giver: 'Mira',
    reward: 500,
    timeLimit: 0,
    briefing: 'Mira: A pink sports car is sitting at the marina showroom. Borrow it — permanently — and bring it to the marina garage. The owner will not miss it. Much.',
    steps: [
      { text: 'Steal the pink sports car at the marina showroom', target: 'showroomCar', radius: 8, needCar: 'sports' },
      { text: 'Deliver the sports car to the marina garage', target: 'marinaGarage', radius: 12, needCar: 'sports' },
    ],
  },
  {
    id: 'm4',
    name: 'The Big One',
    giver: 'Mira',
    reward: 1500,
    timeLimit: 0,
    briefing: 'Mira: Last job, Raka. Cargo is waiting at the airport terminal. Grab it and the whole island will be after you — get it to Garage 7 and we are done.',
    steps: [
      { text: 'Grab the cargo at the airport terminal (press E)', target: 'terminalCargo', radius: 8, interact: true },
      { text: 'Escape to Garage 7 downtown', target: 'hideout', radius: 12, setWanted: 3 },
    ],
  },
];

export function createMissions(game) {
  const missions = {
    index: 0,
    stepIndex: 0,
    timer: 0,
    state: 'idle', // idle | active | done
    completedCount: 0,
    storyDone: false,
    taxi: { state: 'idle', fare: 0, pickup: null, dropoff: null, cooldown: 0 },
    trial: { ringIndex: -1, timer: 0, active: false },
  };

  const currentMission = () => MISSIONS[missions.index] || null;
  const currentStep = () => {
    const mission = currentMission();
    if (!mission || missions.state !== 'active') return null;
    return mission.steps[missions.stepIndex] || null;
  };
  const targetPosition = (step) => game.world.landmarks[step.target];

  function moveBeacon() {
    const step = currentStep();
    if (step) {
      const pos = targetPosition(step);
      game.world.beacon.position.set(pos.x, 0, pos.z);
      game.world.beacon.visible = true;
    } else if (missions.taxi.state === 'pickup' || missions.taxi.state === 'dropoff') {
      const pos = missions.taxi.state === 'pickup' ? missions.taxi.pickup : missions.taxi.dropoff;
      game.world.beacon.position.set(pos.x, 0, pos.z);
      game.world.beacon.visible = true;
    } else {
      game.world.beacon.visible = false;
    }
  }

  function startMission(index) {
    const mission = MISSIONS[index];
    if (!mission) {
      missions.state = 'done';
      missions.storyDone = true;
      game.hud.showBanner('Story complete — Nusa Drive is yours, Raka.');
      moveBeacon();
      return;
    }
    missions.index = index;
    missions.stepIndex = 0;
    missions.timer = mission.timeLimit;
    missions.state = 'active';
    game.hud.showBanner(`${mission.name} — ${mission.giver}`);
    game.hud.dialogue(mission.giver, mission.briefing.replace(/^Mira: /, ''));
    game.audio.pickup();
    moveBeacon();
  }

  function completeMission() {
    const mission = currentMission();
    missions.completedCount += 1;
    game.addCash(mission.reward);
    game.audio.cash();
    game.hud.showBanner(`Mission complete: ${mission.name} — +$${mission.reward}`);
    game.saveGame();
    missions.state = 'idle';
    moveBeacon();
    setTimeout(() => {
      if (missions.state === 'idle' && !missions.storyDone) startMission(missions.index + 1);
    }, 2500);
  }

  function failMission(reason) {
    const mission = currentMission();
    game.hud.showBanner(`Mission failed: ${reason}`);
    game.hud.toast(`${mission.name} failed. Try again — the job is still waiting.`);
    missions.stepIndex = 0;
    missions.timer = mission.timeLimit;
    moveBeacon();
  }

  function advanceStep() {
    const mission = currentMission();
    game.audio.pickup();
    missions.stepIndex += 1;
    if (missions.stepIndex >= mission.steps.length) {
      completeMission();
      return;
    }
    const next = mission.steps[missions.stepIndex];
    game.hud.toast(next.text);
    if (next.setWanted) {
      game.police.addCrime(next.setWanted * TUNING.wantedPerStar, 'heist');
      game.hud.toast('Three stars! Lose the cops and get to Garage 7.');
    }
    moveBeacon();
  }

  function randomRoadPoint(minDist, maxDist) {
    const p = game.playerPosition();
    let best = null;
    let bestScore = Infinity;
    for (let tries = 0; tries < 30; tries += 1) {
      const seg = game.world.segments[Math.floor(Math.random() * game.world.segments.length)];
      const s = Math.random() * seg.length;
      const t = Math.max(0, Math.min(1, s / seg.length));
      const x = seg.x1 + (seg.x2 - seg.x1) * t;
      const z = seg.z1 + (seg.z2 - seg.z1) * t;
      const d = dist2D(x, z, p.x, p.z);
      const score = Math.abs(d - (minDist + maxDist) / 2);
      if (d >= minDist && d <= maxDist && score < bestScore) {
        bestScore = score;
        best = { x, z };
      }
    }
    return best || { x: p.x + 80, z: p.z };
  }

  function updateTaxi(dt) {
    const taxi = missions.taxi;
    function offerFare() {
      taxi.pickup = randomRoadPoint(60, 160);
      taxi.fare = 80 + Math.floor(Math.random() * 8) * 10;
      taxi.state = 'pickup';
      game.hud.toast(`Fare nearby — pick up the passenger ($${taxi.fare}).`);
      moveBeacon();
    }
    if (taxi.cooldown > 0) taxi.cooldown -= dt;
    const inTaxi = game.playerInCar && game.playerCar && game.playerCar.type === 'taxi';
    if (taxi.state === 'idle') {
      if (missions.completedCount >= 2 && inTaxi && taxi.cooldown <= 0) offerFare();
      return;
    }
    if (!inTaxi) {
      taxi.state = 'idle';
      taxi.cooldown = 8;
      game.hud.toast('Fare cancelled — you left the taxi.');
      moveBeacon();
      return;
    }
    const target = taxi.state === 'pickup' ? taxi.pickup : taxi.dropoff;
    const pos = game.playerPosition();
    if (dist2D(pos.x, pos.z, target.x, target.z) < 10) {
      if (taxi.state === 'pickup') {
        taxi.dropoff = randomRoadPoint(80, 220);
        taxi.state = 'dropoff';
        game.hud.toast('Passenger aboard. Take them to the marker.');
        game.audio.pickup();
        moveBeacon();
      } else {
        game.addCash(taxi.fare);
        game.audio.cash();
        game.hud.toast(`Fare complete: +$${taxi.fare}.`);
        taxi.state = 'idle';
        taxi.cooldown = 10;
        moveBeacon();
      }
    }
  }

  function updateTrial(dt) {
    const trial = missions.trial;
    const pos = game.playerPosition();
    const rings = game.world.rings;
    const showRings = game.playerInCar;
    rings.forEach((ring, i) => {
      const active = trial.active && i === trial.ringIndex;
      const upcoming = !trial.active && i === 0;
      ring.mesh.visible = showRings && (active || upcoming || (trial.active && i > trial.ringIndex));
      ring.mesh.material.color.setHex(active ? 0xffd23e : 0x39d0ff);
      if (ring.mesh.visible) ring.mesh.rotation.y += dt * 0.6;
    });
    if (!game.playerInCar) return;
    if (!trial.active) {
      if (dist2D(pos.x, pos.z, rings[0].x, rings[0].z) < 5) {
        trial.active = true;
        trial.ringIndex = 1;
        trial.timer = TUNING.timeTrialSec;
        game.hud.showBanner('Time trial — hit all 5 rings in 90 seconds!');
        game.audio.pickup();
      }
      return;
    }
    trial.timer -= dt;
    if (trial.timer <= 0) {
      trial.active = false;
      trial.ringIndex = -1;
      game.hud.toast('Time trial failed — out of time. Drive through the first ring to retry.');
      return;
    }
    const ring = rings[trial.ringIndex];
    if (ring && dist2D(pos.x, pos.z, ring.x, ring.z) < 5) {
      game.audio.pickup();
      trial.ringIndex += 1;
      if (trial.ringIndex >= rings.length) {
        trial.active = false;
        trial.ringIndex = -1;
        game.addCash(200);
        game.audio.cash();
        game.hud.showBanner('Time trial complete — +$200');
      } else {
        game.hud.toast(`Ring ${trial.ringIndex} of 5 — keep going!`);
      }
    }
  }

  function update(dt, interactPressed) {
    if (missions.state === 'active') {
      const mission = currentMission();
      if (mission.timeLimit > 0) {
        missions.timer -= dt;
        if (missions.timer <= 0) {
          failMission('Out of time');
          return;
        }
      }
      const step = currentStep();
      if (step) {
        const pos = game.playerPosition();
        const target = targetPosition(step);
        const d = dist2D(pos.x, pos.z, target.x, target.z);
        let done = false;
        if (step.interact) done = d < step.radius && interactPressed;
        else if (step.needCar) done = game.playerInCar && game.playerCar && game.playerCar.type === step.needCar && d < step.radius;
        else done = d < step.radius;
        if (done) advanceStep();
      }
    }
    updateTaxi(dt);
    updateTrial(dt);
  }

  function objectiveText() {
    const step = currentStep();
    if (step) {
      const mission = currentMission();
      let text = `${mission.name}: ${step.text}`;
      if (mission.timeLimit > 0) text += ` — ${Math.max(0, Math.ceil(missions.timer))}s`;
      if (step.interact) {
        const pos = game.playerPosition();
        const target = targetPosition(step);
        if (dist2D(pos.x, pos.z, target.x, target.z) < step.radius) text += ' — press E';
      }
      return text;
    }
    if (missions.taxi.state === 'pickup') return `Taxi fare: pick up the passenger ($${missions.taxi.fare})`;
    if (missions.taxi.state === 'dropoff') return 'Taxi fare: drop the passenger at the marker';
    if (missions.trial.active) return `Time trial: ring ${missions.trial.ringIndex} of 5 — ${Math.ceil(missions.trial.timer)}s left`;
    if (missions.storyDone) return 'Story complete. Drive a taxi for fares, or race the rings on the highway.';
    if (missions.state === 'idle') return 'Next job coming from Mira… explore the island.';
    return '';
  }

  function waypoint() {
    const step = currentStep();
    if (step) return targetPosition(step);
    if (missions.taxi.state === 'pickup') return missions.taxi.pickup;
    if (missions.taxi.state === 'dropoff') return missions.taxi.dropoff;
    if (missions.trial.active) {
      const ring = game.world.rings[missions.trial.ringIndex];
      return ring ? { x: ring.x, z: ring.z } : null;
    }
    return null;
  }

  missions.currentMission = currentMission;
  missions.currentStep = currentStep;
  missions.startMission = startMission;
  missions.update = update;
  missions.objectiveText = objectiveText;
  missions.waypoint = waypoint;
  missions.moveBeacon = moveBeacon;
  return missions;
}
