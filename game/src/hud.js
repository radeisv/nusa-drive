const STATIONS = [
  ['WAVE 88.1', 'Neon Drive', 'Pink Horizon — Lumen Kids'],
  ['PALM FM 92.4', 'Sunset Pop', 'Golden Hour — The Breakers'],
  ['NUSA ROCK 101', 'Drive Rock', 'Midnight Run — Vega'],
];
const UNITS = ['IBIS-43', 'TARPON-10', 'HERON-17', 'KESTREL-31', 'MARLIN-26'];

export function createHud() {
  const el = (id) => document.getElementById(id);
  const healthFill = el('health-fill');
  const healthNum = el('health-num');
  const starsEl = el('stars');
  const respectFill = el('respect-fill');
  const respectNum = el('respect-num');
  const cashEl = el('cash');
  const clockEl = el('clock');
  const mCh = el('m-ch');
  const mTimer = el('m-timer');
  const mObj = el('m-obj');
  const mBar = el('m-bar');
  const mNext = el('m-next');
  const weaponSlots = [...el('weapons').children];
  const policeList = el('police-list');
  const dlg = el('dialogue');
  const dlgFace = el('dlg-face');
  const dlgName = el('dlg-name');
  const dlgText = el('dlg-text');
  const radioStation = el('radio-station');
  const radioTrack = el('radio-track');
  const speedBox = el('speed-box');
  const speedEl = el('speed');
  const gearEl = el('gear');
  const condFill = el('cond-fill');
  const crosshair = el('crosshair');
  const bannerEl = el('banner');
  const toastEl = el('toast');
  const minimap = el('minimap');
  const mapCtx = minimap.getContext('2d');
  const mapOverlay = el('map-overlay');
  const bigmap = el('bigmap');
  const bigCtx = bigmap.getContext('2d');
  const mapJob = el('map-job');
  let cityMapOpen = false;
  const DISTRICTS = [
    ['DOWNTOWN', 0, 0],
    ['OLD TOWN', -170, -180],
    ['NORTHGATE', -60, -240],
    ['WESTSIDE', -170, 120],
    ['MARINA', 0, 285],
    ['AIRPORT', 740, 0],
  ];
  const screens = { title: el('screen-title'), pause: el('screen-pause'), over: el('screen-over') };
  const overTitle = el('over-title');
  const overSub = el('over-sub');

  let bannerTimer = null;
  let toastTimer = null;
  let dlgTimer = null;
  let lastStars = -1;
  let lastCash = -1;
  let lastMissionKey = '';
  let lastPoliceAt = -9;
  let station = 0;

  const MAP = { x0: -340, z0: -340, x1: 940, z1: 340 };
  function drawMap(ctx, S, game) {
    const u = S / 220;
    const sx = S / (MAP.x1 - MAP.x0);
    const sy = S / (MAP.z1 - MAP.z0);
    const X = (x) => (x - MAP.x0) * sx;
    const Y = (z) => (z - MAP.z0) * sy;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#241a3a'; // dusk sea
    ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = '#5a4a6a'; // land
    ctx.fillRect(X(-320), Y(-320), 640 * sx, 640 * sy);
    ctx.fillRect(X(560), Y(-220), 360 * sx, 440 * sy);
    ctx.strokeStyle = '#d8c8a8'; // roads
    ctx.lineWidth = 2;
    for (const seg of game.world.segments) {
      ctx.beginPath();
      ctx.moveTo(X(seg.x1), Y(seg.z1));
      ctx.lineTo(X(seg.x2), Y(seg.z2));
      ctx.stroke();
    }
    ctx.fillStyle = '#2c2f34'; // runway
    ctx.fillRect(X(620), Y(-73), 260 * sx, 26 * sy);
    const wp = game.missions.waypoint();
    if (wp) {
      const pulse = 1 + Math.sin(game.time * 5) * 0.2;
      ctx.fillStyle = '#ffd23e';
      ctx.save();
      ctx.translate(X(wp.x), Y(wp.z));
      ctx.rotate(Math.PI / 4);
      const r = 5 * u * pulse;
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.restore();
    }
    ctx.fillStyle = '#e8e8e8'; // traffic
    for (const car of game.vehicles) {
      if (car.driver === 'police') continue;
      ctx.fillRect(X(car.x) - 1.5 * u, Y(car.z) - 1.5 * u, 3 * u, 3 * u);
    }
    const flash = Math.floor(game.time * 4) % 2 === 0;
    ctx.fillStyle = flash ? '#ff3333' : '#3388ff'; // police, flashing red/blue
    for (const car of game.police.cars) {
      ctx.beginPath();
      ctx.arc(X(car.x), Y(car.z), 3.5 * u, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const cop of game.police.cops) {
      if (cop.health <= 0) continue;
      ctx.beginPath();
      ctx.arc(X(cop.x), Y(cop.z), 2.5 * u, 0, Math.PI * 2);
      ctx.fill();
    }
    const p = game.playerPosition();
    const heading = game.playerInCar && game.playerCar ? game.playerCar.heading : game.player.heading;
    ctx.save();
    ctx.translate(X(p.x), Y(p.z));
    ctx.rotate(Math.atan2(Math.sin(heading), Math.cos(heading)) + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = u;
    ctx.beginPath();
    ctx.moveTo(0, -7 * u);
    ctx.lineTo(5 * u, 6 * u);
    ctx.lineTo(0, 3 * u);
    ctx.lineTo(-5 * u, 6 * u);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText('N', 6, 14);
    if (S > 400) drawDistrictLabels(ctx, X, Y, u);
  }

  function drawDistrictLabels(ctx, X, Y, u) {
    ctx.fillStyle = '#ffd23e';
    ctx.font = `bold ${Math.round(11 * u)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    for (const [name, x, z] of DISTRICTS) ctx.fillText(name, X(x), Y(z));
    ctx.textAlign = 'start';
  }

  function updateMapJob(game) {
    const m2 = game.missions.currentMission();
    const s2 = game.missions.currentStep();
    mapJob.textContent = m2 && game.missions.state === 'active' ? `${m2.name}: ${s2 ? s2.text : ''}` : 'Free roam — take a taxi fare or race the rings.';
  }

  function showBanner(text) {
    bannerEl.textContent = text;
    bannerEl.classList.add('show');
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => bannerEl.classList.remove('show'), 3200);
  }

  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 4200);
  }

  function dialogue(name, text) {
    dlgFace.textContent = name[0];
    dlgName.textContent = `${name.toUpperCase()} · FIXER`;
    dlgText.textContent = text;
    dlg.classList.remove('hidden');
    if (dlgTimer) clearTimeout(dlgTimer);
    dlgTimer = setTimeout(() => dlg.classList.add('hidden'), 6000);
  }

  function nextStation() {
    station = (station + 1) % STATIONS.length;
    radioStation.textContent = `${STATIONS[station][0]} · ${STATIONS[station][1]}`;
    radioTrack.textContent = STATIONS[station][2];
  }

  function fmtClock(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  return {
    showBanner,
    toast,
    dialogue,
    nextStation,
    mapOpen() { return cityMapOpen; },
    toggleMap(game) {
      cityMapOpen = !cityMapOpen;
      mapOverlay.classList.toggle('hidden', !cityMapOpen);
      if (cityMapOpen) {
        drawMap(bigCtx, 520, game);
        updateMapJob(game);
      }
    },
    setScreen(name) {
      for (const [key, node] of Object.entries(screens)) {
        if (node) node.classList.toggle('hidden', key !== name);
      }
    },
    setOver(title, sub) {
      overTitle.textContent = title;
      overSub.textContent = sub;
    },
    update(game, dt) {
      const health = Math.max(0, Math.round(game.player.health));
      healthFill.style.width = `${health}%`;
      healthFill.classList.toggle('low', health <= 30);
      healthNum.textContent = String(health);
      respectFill.style.width = `${(game.missions.completedCount / 4) * 100}%`;
      respectNum.textContent = String(game.missions.completedCount);
      const stars = game.police.stars;
      if (stars !== lastStars) {
        lastStars = stars;
        starsEl.textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars);
        starsEl.classList.toggle('hot', stars > 0);
      }
      const cash = Math.floor(game.cash);
      if (cash !== lastCash) {
        lastCash = cash;
        cashEl.textContent = `$${cash.toLocaleString('en-US')}`;
      }
      const minutes = Math.floor(game.clockMinutes) % (24 * 60);
      const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
      const mm = String(minutes % 60).padStart(2, '0');
      clockEl.textContent = `DAY ${1 + Math.floor(game.clockMinutes / (24 * 60))} · ${hh}:${mm}`;
      const mission = game.missions.currentMission();
      const step = game.missions.currentStep();
      const key = `${game.missions.index}/${game.missions.stepIndex}/${game.missions.state}`;
      if (mission && game.missions.state === 'active') {
        mCh.textContent = `CH ${game.missions.index + 1} · ${mission.name.toUpperCase()}`;
        mTimer.textContent = mission.timeLimit > 0 ? fmtClock(game.missions.timer) : '';
        mObj.textContent = step ? step.text : '';
        if (key !== lastMissionKey) {
          lastMissionKey = key;
          mBar.innerHTML = mission.steps.map((_, i) => `<i class="${i < game.missions.stepIndex ? 'done' : i === game.missions.stepIndex ? 'now' : ''}"></i>`).join('');
        }
        const next = mission.steps[game.missions.stepIndex + 1];
        mNext.textContent = next ? `NEXT ${next.text}` : 'NEXT Complete the job';
      } else if (game.missions.storyDone) {
        mCh.textContent = 'STORY COMPLETE';
        mTimer.textContent = '';
        mObj.textContent = 'Drive a taxi for fares, or race the rings on the highway.';
        mNext.textContent = '';
        if (key !== lastMissionKey) { lastMissionKey = key; mBar.innerHTML = ''; }
      } else {
        mCh.textContent = 'NUSA DRIVE';
        mTimer.textContent = '';
        mObj.textContent = 'Next job coming from Mira… explore the island.';
        mNext.textContent = '';
        if (key !== lastMissionKey) { lastMissionKey = key; mBar.innerHTML = ''; }
      }
      if (game.police.stars > 0) {
        policeList.classList.remove('hidden');
        if (game.time - lastPoliceAt > 0.25) {
          lastPoliceAt = game.time;
          const p = game.playerPosition();
          const rows = game.police.cars.slice(0, 4).map((car, i) => {
            const d = Math.round(Math.hypot(car.x - p.x, car.z - p.z));
            const tag = d < 12 ? 'RAMMING' : d < 35 ? 'PURSUIT' : 'ROADBLOCK';
            return `<div class="pl-row"><b>${UNITS[i % UNITS.length]}</b><span>${d} m</span><em>${tag}</em></div>`;
          }).join('');
          policeList.innerHTML = `<div class="pl-head">NUSA PD RESPONSE · ${game.police.cars.length} UNITS</div>${rows}`;
        }
      } else {
        policeList.classList.add('hidden');
      }
      weaponSlots[0].classList.toggle('armed', game.player.armed === 'fists');
      weaponSlots[1].classList.toggle('armed', game.player.armed === 'pistol');
      if (game.playerInCar && game.playerCar) {
        speedBox.classList.remove('hidden');
        const kmh = Math.abs(game.playerCar.speed) * 3.6;
        speedEl.textContent = String(Math.round(kmh));
        gearEl.textContent = `G${1 + Math.min(3, Math.floor(kmh / 45))}`;
        condFill.style.width = `${Math.max(0, Math.round(game.playerCar.health))}%`;
      } else {
        speedBox.classList.add('hidden');
      }
      crosshair.classList.toggle('hidden', game.player.armed !== 'pistol' || game.playerInCar);
      drawMap(mapCtx, 220, game);
      if (cityMapOpen) {
        drawMap(bigCtx, 520, game);
        updateMapJob(game);
      }
    },
  };
}
