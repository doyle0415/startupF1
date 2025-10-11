const sprite = document.querySelector('.lights-sprite');
const time = document.querySelector('.time');
const best = document.querySelector('.best span');
let bestTime = Number(localStorage.getItem('best')) || Infinity;
let started = false;
let lightsOutTime = 0;
let raf;
let timeout;
const FRAMES = 6; // 0(off), 1..5 progressively on

function setFrame(n) {
  if (!sprite) return;
  const clamped = Math.max(0, Math.min(FRAMES - 1, n));
  sprite.style.setProperty('--frame', clamped);
}


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
    const toLight = Math.floor((now - lightsStart) / 1000) + 1; // 1..5
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
  }
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
