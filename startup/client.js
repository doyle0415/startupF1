const sprite = document.querySelector('.lights-sprite');
const time = document.querySelector('.time');
const best = document.querySelector('.best span');
let bestTime = Number(localStorage.getItem('best')) || Infinity;
let started = false;
let lightsOutTime = 0;
let raf;
let timeout;
const FRAMES = 6; // 0(off), 1..5 progressively on
const LIGHT_STEP_MS = 600; // each red light interval (was 1000ms)

function setFrame(n) {
  if (!sprite) return;
  const clamped = Math.max(0, Math.min(FRAMES - 1, n));
  sprite.style.setProperty('--frame', clamped);
}

function formatDateTime(timestamp) {
  const d = new Date(timestamp);
  return d.toLocaleString();
}

// ranking storage
const LS_ALL_KEY = 'records_all_v1';
const LS_TOP_KEY = 'records_top_v1';
const LS_ANON_COUNTER_KEY = 'records_anon_counter_v1';

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function loadRecords() {
  const all = loadJson(LS_ALL_KEY, []);
  const top = loadJson(LS_TOP_KEY, []);
  return { all, top };
}

function saveRecords(all, top) {
  saveJson(LS_ALL_KEY, all);
  saveJson(LS_TOP_KEY, top);
}

function nextAnonymousName() {
  let counter = Number(localStorage.getItem(LS_ANON_COUNTER_KEY)) || 0;
  if (!counter) {
    const { all } = loadRecords();
    let max = 0;
    for (const r of all) {
      const m = /^\s*익명(\d+)\s*$/.exec(r.name || '');
      if (m) max = Math.max(max, Number(m[1]));
    }
    counter = max;
  }
  counter += 1;
  localStorage.setItem(LS_ANON_COUNTER_KEY, String(counter));
  return `익명${counter}`;
}

function insertRecord(ms, name, wasPrompted = false) {
  const { all } = loadRecords();
  let finalName = (name || '').trim();
  if (!finalName && wasPrompted) finalName = nextAnonymousName();
  const record = { ms, name: finalName , at: Date.now(), prompted: !!wasPrompted };
  all.push(record);
  const newTop = buildTop10(all);
  saveRecords(all, newTop);
  return { all, top: newTop };
}

function maybeQualifyTop10(ms) {
  const { top } = loadRecords();
  if (top.length < 10) return true;
  const worst = top[top.length - 1];
  return ms < worst.ms;
}

function computeNextRank(ms) {
  const { top } = loadRecords();
  const fasterCount = top.filter(r => r.ms < ms).length;
  const rank = fasterCount + 1;
  return Math.min(rank, 10);
}

// render helpers
const allList = document.querySelector('.all-list');
const topList = document.querySelector('.top-list');

function renderLists() {
  if (!allList || !topList) return;
  const { all, top } = loadRecords();
  const sortedAll = [...all].sort((a,b) => b.at - a.at); // latest first
  allList.innerHTML = sortedAll
    .map((r) => {
      const nm = r.name && r.name.trim().length > 0 ? r.name : 'N/A';
      return `<li>${formatTime(r.ms)} - ${formatDateTime(r.at)} - ${nm}</li>`;
    })
    .join('');
  topList.innerHTML = top
    .map((r, i) => `<li>${i+1}등 - ${r.name}(${formatTime(r.ms)})</li>`)
    .join('');
}

function buildTop10(all) {
  return [...all]
    .filter(r => r.name && r.name.trim().length > 0)
    .sort((a,b) => a.ms - b.ms)
    .reduce((acc, r) => {
      const exists = acc.find(x => (x.name || '').toLowerCase() === (r.name || '').toLowerCase());
      if (!exists) acc.push(r);
      return acc;
    }, [])
    .slice(0, 10);
}

function upsertTopWithName(name, ms) {
  name = (name || '').trim();
  if (!name) return { updated: false };
  const { all, top } = loadRecords();
  // find best existing by this name
  const existing = top.find(r => r.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    if (ms < existing.ms) {
      existing.ms = ms;
      existing.at = Date.now();
      const rebuilt = buildTop10(all.map(r => r.name.toLowerCase() === name.toLowerCase() ? { ...r, ms: Math.min(r.ms, ms), at: Date.now() } : r));
      saveRecords(all, rebuilt);
      alert('기록이 갱신되었습니다.');
      return { updated: true };
    } else {
      // slower than existing - do not update rank
      saveRecords(all, buildTop10(all));
      return { updated: false };
    }
  } else {
    // not in top yet: try insert if qualifies
    const candidate = { ms, name, at: Date.now() };
    const newTop = buildTop10(all.concat(candidate));
    saveRecords(all, newTop);
    return { updated: true };
  }
}

renderLists();


function formatTime(time) {
  time = Math.round(time);
  let outputTime = time / 1000;
  if (time < 10000) {
    outputTime = '0' + outputTime;
  }
  while (outputTime.length < 6) {
    outputTime += '0';
  }
  return outputTime;
}

if (bestTime != Infinity) {
  best.textContent = formatTime(bestTime);
}

function start() {
  setFrame(0);

  time.textContent = "00.000";
  time.classList.remove("anim");

  lightsOutTime = 0;
  const lightsStart = performance.now();

  function tick(now) {
    const toLight = Math.floor((now - lightsStart) / LIGHT_STEP_MS) + 1; // 1..5
    if (toLight < 5) {
      setFrame(toLight);
      raf = requestAnimationFrame(tick);
    } else {
      setFrame(5);
      const delay = Math.random() * 4000 + 1000;
      timeout = setTimeout(() => {
        setFrame(0);
        lightsOutTime = performance.now();
      }, delay);
    }
  }

  raf = requestAnimationFrame(tick);
}

function end(timeStamp) {
  cancelAnimationFrame(raf);
  clearTimeout(timeout);

  if (!lightsOutTime) {
    time.textContent = "부정 출발!";
    time.classList.add("anim");
    return;
  } else {
    const thisTime = timeStamp - lightsOutTime;
    time.textContent = formatTime(thisTime);

    if (thisTime < bestTime) {
      bestTime = thisTime;
      best.textContent = time.textContent;
      localStorage.setItem("best", thisTime);
    }

    time.classList.add("anim");

    // ranking: record handling
    let name = '';
    const wasPrompted = maybeQualifyTop10(thisTime);
    if (wasPrompted) {
      const rank = computeNextRank(thisTime);
      name = prompt(`${formatTime(thisTime)}으로 ${rank}등 진입! 닉네임을 입력하세요 (최대 20자):`) || '';
      name = name.trim().slice(0, 20);
      if (name) {
        upsertTopWithName(name, thisTime);
      }
    }
    insertRecord(thisTime, name, wasPrompted);
    renderLists();
  }
}

// reset button handler
const resetBtn = document.querySelector('.reset-btn');
if (resetBtn) {
  resetBtn.addEventListener('click', () => {
    const pw = prompt('기록을 초기화하려면 비밀번호를 입력하세요:');
    if (pw === '0415') {
      localStorage.removeItem(LS_ALL_KEY);
      localStorage.removeItem(LS_TOP_KEY);
      localStorage.removeItem('best');
      localStorage.removeItem(LS_ANON_COUNTER_KEY);
      bestTime = Infinity;
      if (best) best.textContent = '00.000';
      renderLists();
      alert('기록이 초기화되었습니다.');
    } else if (pw !== null) {
      alert('비밀번호가 올바르지 않습니다.');
    }
  });
}

function tap(event) {
  let timeStamp = performance.now();

  if (
    !started &&
    event.target &&
    event.target.closest &&
    event.target.closest("a")
  )
    return;
  event.preventDefault();

  if (started) {
    end(timeStamp);
    started = false;
  } else {
    start();
    started = true;
  }
}

addEventListener("touchstart", tap, { passive: false });

addEventListener(
  "mousedown",
  (event) => {
    if (event.button === 0) tap(event);
  },
  { passive: false }
);

addEventListener(
  "keydown",
  (event) => {
    if (event.key == " ") tap(event);
  },
  { passive: false }
);
