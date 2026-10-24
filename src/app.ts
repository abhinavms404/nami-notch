import { Ease } from "./core/anim";
import { BotEngine, hexToRGB, type PetKind } from "./nami/engine";
import {
  OUTFIT_LABELS,
  OUTFIT_SELECTIONS,
  parseOutfit,
  resolveOutfit,
  type OutfitSelection,
} from "./nami/wardrobe";

declare global {
  interface Window {
    setVitals: (v: Vitals) => void;
    setHover: (on: boolean) => void;
    webkit?: {
      messageHandlers?: {
        nami?: { postMessage: (message: unknown) => void };
      };
    };
  }
}

interface Vitals {
  cpu: number | null;
  ram: string;
  ramPct: number | null;
  temp: number | null;
  battery: number | null;
  charging: boolean;
  plugged: boolean;
}

interface Model {
  id: string;
  name: string;
  color: string | null;
  kind: PetKind;
}

type MoveName = "smile" | "dance" | "run" | "cry" | "drain" | "angry";
type CompactMode = "stats" | "clock";

const PET_NAME = "Nami";
const MOVES: MoveName[] = ["smile", "dance", "run", "cry", "drain", "angry"];

const MODELS: Model[] = [
  { id: "nami", name: "Nami", color: null, kind: "nami" },
  { id: "matcha", name: "Matcha", color: "#BFE6C9", kind: "nami" },
  { id: "sakura", name: "Sakura", color: "#F7C6D9", kind: "nami" },
  { id: "sky", name: "Sky", color: "#BFD9FF", kind: "nami" },
  { id: "lemon", name: "Lemon", color: "#F7E7A6", kind: "nami" },
  { id: "lavender", name: "Lavender", color: "#D9C8FF", kind: "nami" },
  { id: "puppy", name: "Puppy", color: "#F0C18A", kind: "puppy" },
  { id: "kitty", name: "Kitty", color: "#C9C9D6", kind: "kitty" },
  { id: "panda", name: "Panda", color: "#F2F2F5", kind: "panda" },
  { id: "fox", name: "Fox", color: "#F09A5B", kind: "fox" },
  { id: "penguin", name: "Penguin", color: "#AFC9D9", kind: "penguin" },
  { id: "spider", name: "Spider", color: "#E84B4B", kind: "spider" },
  { id: "robo", name: "Robo", color: "#9FE8E2", kind: "robo" },
];

const params = new URLSearchParams(location.search);
const stored = (() => {
  try {
    return JSON.parse(localStorage.getItem("nami-notch") || "{}") as {
      model?: string;
      outfit?: string;
      compact?: string;
      pinned?: boolean;
    };
  } catch {
    return {};
  }
})();

let modelId = MODELS.some((m) => m.id === params.get("model"))
  ? (params.get("model") as string)
  : MODELS.some((m) => m.id === stored.model)
    ? (stored.model as string)
    : "nami";
let outfitSelection = parseOutfit(params.get("outfit") ?? stored.outfit);
const compactParam = params.get("compact");
let compactMode: CompactMode =
  compactParam === "clock" || compactParam === "stats"
    ? compactParam
    : stored.compact === "clock"
      ? "clock"
      : "stats";
let pinned = params.has("pinned") ? params.get("pinned") === "1" : stored.pinned === true;
let vitals: Vitals = { cpu: null, ram: "--G", ramPct: null, temp: null, battery: null, charging: false, plugged: false };
let expanded = false;
let visible = false;
let hovered = false;
let forcedOpen = false;
let forceTimer: number | null = null;
let disconnectUntil = 0;
const TRIGGER_W = 300;
const TRIGGER_H = 30;
let wasLow = false;
let wasCharging = false;
let wasPlugged = false;
let sawVitals = false;
let petSize = 0;
let currentMove: MoveName | null = null;
let moveUntil = 0;
let nextIdleMove = 0;
let runFxUntil = 0;
let moveIndex = -1;

const notch = document.getElementById("notch") as HTMLElement;
const pet = document.getElementById("pet") as HTMLCanvasElement;
const bigPetSlot = document.getElementById("pet-big") as HTMLElement;
const clock = document.getElementById("clock") as HTMLElement;
const dateEl = document.getElementById("date") as HTMLElement;
const cpuEl = document.getElementById("cpu") as HTMLElement;
const ramEl = document.getElementById("ram") as HTMLElement;
const tempEl = document.getElementById("temp") as HTMLElement;
const batEl = document.getElementById("bat") as HTMLElement;
const bigCpu = document.getElementById("big-cpu") as HTMLElement;
const bigRam = document.getElementById("big-ram") as HTMLElement;
const bigTemp = document.getElementById("big-temp") as HTMLElement;
const bigBat = document.getElementById("big-bat") as HTMLElement;
const statusEl = document.getElementById("status") as HTMLElement;
const modelRow = document.getElementById("models") as HTMLElement;
const modelLabel = document.getElementById("model-label") as HTMLElement;
const outfitLabel = document.getElementById("outfit-label") as HTMLElement;
const outfitPrev = document.getElementById("outfit-prev") as HTMLButtonElement;
const outfitNext = document.getElementById("outfit-next") as HTMLButtonElement;
const bolt = document.getElementById("bolt") as HTMLElement;
const timeToggle = document.getElementById("time-toggle") as HTMLButtonElement;
const pinToggle = document.getElementById("pin-toggle") as HTMLButtonElement;

const ctx = pet.getContext("2d") as CanvasRenderingContext2D;
const engine = new BotEngine();
engine.isMini = false;
engine.particleOverhang = 0;

function currentModel(): Model {
  return MODELS.find((m) => m.id === modelId) ?? MODELS[0];
}

function applyModel(): void {
  const model = currentModel();
  engine.bodyColor = model.color ? hexToRGB(model.color) : null;
  engine.petKind = model.kind;
  modelLabel.textContent = model.id === "nami" ? PET_NAME : `${PET_NAME} · ${model.name}`;
  for (const button of modelRow.querySelectorAll<HTMLButtonElement>(".model")) {
    button.classList.toggle("on", button.dataset.model === model.id);
  }
}

function applyOutfit(animated = true): void {
  const outfit = resolveOutfit(outfitSelection, new Date());
  engine.setOutfit(outfit, animated);
  outfitLabel.textContent =
    outfitSelection === "auto" ? `Auto: ${OUTFIT_LABELS[outfit]}` : OUTFIT_LABELS[outfitSelection];
}

function syncNotchWidth(): void {
  const next =
    compactMode === "clock" && !expanded ? `${Math.max(88, Math.ceil(clock.scrollWidth + 24))}px` : "";
  if (notch.style.width === next) return;
  notch.style.width = next;
  publishRegion();
  if (visible) window.setTimeout(publishRegion, 300);
}

function applyCompactMode(): void {
  const clockOnly = compactMode === "clock";
  notch.classList.toggle("clock-only", clockOnly);
  syncNotchWidth();
  timeToggle.setAttribute("aria-pressed", String(clockOnly));
  timeToggle.setAttribute(
    "aria-label",
    clockOnly ? "Switch compact notch to stats" : "Switch compact notch to time only",
  );
  timeToggle.title = clockOnly ? "Compact notch: time only" : "Compact notch: stats";
}

function applyPin(): void {
  notch.classList.toggle("pinned", pinned);
  pinToggle.setAttribute("aria-pressed", String(pinned));
  pinToggle.setAttribute("aria-label", pinned ? "Allow notch to auto-hide" : "Keep notch visible");
  pinToggle.title = pinned ? "Notch stays visible" : "Notch auto-hides";
}

function save(): void {
  const data = { model: modelId, outfit: outfitSelection, compact: compactMode, pinned };
  try {
    localStorage.setItem("nami-notch", JSON.stringify(data));
  } catch {
    /* file:// storage may be unavailable */
  }
  window.webkit?.messageHandlers?.nami?.postMessage(JSON.stringify({ type: "settings", ...data }));
}

function isLow(): boolean {
  return vitals.battery !== null && vitals.battery <= 8 && !vitals.charging;
}

function cancelMove(): void {
  currentMove = null;
  moveUntil = 0;
  runFxUntil = 0;
  engine.setDancing(false);
  engine.setAngry(false);
  if (!isLow() && !vitals.charging) engine.setState("idle");
}

function playMove(name: MoveName): void {
  if (isLow() || vitals.charging) return;
  cancelMove();
  currentMove = name;
  const started = performance.now();
  let duration = 2400;

  switch (name) {
    case "smile":
      engine.triggerEmote("happy", 2.4);
      engine.emit("heart", 1);
      engine.squash();
      break;
    case "dance":
      engine.setDancing(true);
      engine.triggerEmote("happy", 3.0);
      engine.emit("star", 2);
      duration = 3000;
      break;
    case "run":
      engine.triggerEmote("surprised", 2.0);
      engine.squash();
      runFxUntil = started + 2000;
      duration = 2200;
      break;
    case "cry":
      engine.triggerEmote("cry", 2.8);
      engine.emit("sweat", 2);
      duration = 2800;
      break;
    case "drain":
      engine.setState("sleeping");
      engine.triggerEmote("yawn", 2.4);
      engine.emit("z", 2);
      duration = 3000;
      break;
    case "angry":
      engine.setState("idle");
      engine.setAngry(true);
      engine.emit("anger", 3);
      duration = 2400;
      break;
  }

  moveUntil = started + duration;
  nextIdleMove = started + duration + 6000 + Math.random() * 5000;
}

function setStateForBattery(): void {
  const low = isLow();
  if (vitals.charging) {
    engine.setDancing(false);
    engine.setAngry(false);
    engine.setPermanentEmote("love");
    engine.setState("idle");
    return;
  }
  if (disconnectUntil > performance.now()) {
    engine.setDancing(false);
    engine.setPermanentEmote(null);
    engine.setState("idle");
    engine.setAngry(true);
    return;
  }
  if (low) {
    engine.setDancing(false);
    if (!engine.angry) {
      engine.setPermanentEmote(null);
      engine.setState("idle");
      engine.setAngry(true);
    }
    return;
  }
  if (currentMove === "angry") {
    engine.setState("idle");
    return;
  }
  engine.setPermanentEmote(null);
  engine.setAngry(false);
  if (currentMove === "drain") {
    engine.setState("sleeping");
    return;
  }
  engine.setState("idle");
}

function applyVitals(): void {
  const cpu = vitals.cpu === null ? "---%" : `${Math.round(vitals.cpu)}%`;
  const temp = vitals.temp === null ? "--°C" : `${Math.round(vitals.temp)}°C`;
  const bat = vitals.battery === null ? "--%" : `${vitals.battery}%`;
  const ram = vitals.ram || "--G";

  cpuEl.textContent = cpu;
  ramEl.textContent = ram;
  tempEl.textContent = temp;
  batEl.textContent = bat;
  bigCpu.textContent = cpu;
  bigRam.textContent = ram;
  bigTemp.textContent = temp;
  bigBat.textContent = bat;

  cpuEl.classList.toggle("warn", vitals.cpu !== null && vitals.cpu >= 80);
  cpuEl.classList.toggle("crit", vitals.cpu !== null && vitals.cpu >= 95);
  bigCpu.classList.toggle("warn", vitals.cpu !== null && vitals.cpu >= 80);
  bigCpu.classList.toggle("crit", vitals.cpu !== null && vitals.cpu >= 95);
  ramEl.classList.toggle("warn", vitals.ramPct !== null && vitals.ramPct >= 80);
  ramEl.classList.toggle("crit", vitals.ramPct !== null && vitals.ramPct >= 92);
  bigRam.classList.toggle("warn", vitals.ramPct !== null && vitals.ramPct >= 80);
  bigRam.classList.toggle("crit", vitals.ramPct !== null && vitals.ramPct >= 92);
  tempEl.classList.toggle("warn", vitals.temp !== null && vitals.temp >= 80);
  tempEl.classList.toggle("crit", vitals.temp !== null && vitals.temp >= 90);
  bigTemp.classList.toggle("warn", vitals.temp !== null && vitals.temp >= 80);
  bigTemp.classList.toggle("crit", vitals.temp !== null && vitals.temp >= 90);
  batEl.classList.toggle("warn", vitals.battery !== null && vitals.battery <= 20);
  batEl.classList.toggle("crit", vitals.battery !== null && vitals.battery <= 8);
  bigBat.classList.toggle("warn", vitals.battery !== null && vitals.battery <= 20);
  bigBat.classList.toggle("crit", vitals.battery !== null && vitals.battery <= 8);
  const plugged = vitals.charging || vitals.plugged;
  const low = isLow();
  notch.classList.toggle("charging", plugged && !low);
  bolt.classList.toggle("on", plugged);

  const justCharging = vitals.charging && !wasCharging;
  const justPlugged = sawVitals && plugged && !wasPlugged;
  const justDisconnected = !plugged && wasPlugged;

  if (justCharging) {
    disconnectUntil = 0;
    cancelMove();
    forcedOpen = true;
    if (forceTimer !== null) window.clearTimeout(forceTimer);
    forceTimer = window.setTimeout(() => {
      forceTimer = null;
      forcedOpen = false;
      collapseOrHide();
    }, 3000);
    setVisible(true);
    engine.triggerEmote("love", 1.2);
  } else if (justPlugged) {
    disconnectUntil = 0;
    cancelMove();
    forcedOpen = true;
    if (forceTimer !== null) window.clearTimeout(forceTimer);
    forceTimer = window.setTimeout(() => {
      forceTimer = null;
      forcedOpen = false;
      collapseOrHide();
    }, 3000);
    setVisible(true);
    engine.triggerEmote("happy", 1.2);
  }
  if (justDisconnected) triggerDisconnectAlert();
  if (low && !wasLow && !justDisconnected) triggerLowAlert();

  wasLow = low;
  wasCharging = vitals.charging;
  wasPlugged = plugged;
  sawVitals = true;
  notch.classList.toggle("low", low || disconnectUntil > performance.now());
  updateStatus();
  setStateForBattery();
}

function updateStatus(): void {
  if (disconnectUntil > performance.now()) {
    statusEl.textContent = "Charger disconnected!";
    statusEl.className = "status low";
    return;
  }
  if (vitals.charging) {
    statusEl.textContent = "Charging — keep me plugged in";
    statusEl.className = "status charging";
  } else if (isLow()) {
    statusEl.textContent = "Charge it now";
    statusEl.className = "status low";
  } else if (vitals.plugged) {
    statusEl.textContent = "Plugged in";
    statusEl.className = "status charging";
  } else {
    statusEl.textContent = "";
    statusEl.className = "status";
  }
}

function triggerDisconnectAlert(): void {
  cancelMove();
  if (forceTimer !== null) {
    window.clearTimeout(forceTimer);
    forceTimer = null;
  }
  disconnectUntil = performance.now() + 3000;
  forcedOpen = true;
  setVisible(true);
  engine.interruptGreet();
  engine.setPermanentEmote(null);
  engine.setState("idle");
  engine.setAngry(true);
  engine.emit("anger", 3);
  forceTimer = window.setTimeout(() => {
    forceTimer = null;
    forcedOpen = false;
    disconnectUntil = 0;
    if (isLow()) {
      triggerLowAlert();
    } else {
      notch.classList.remove("low");
      collapseOrHide();
      setStateForBattery();
      updateStatus();
    }
  }, 3000);
}

function triggerLowAlert(): void {
  cancelMove();
  disconnectUntil = 0;
  forcedOpen = true;
  if (forceTimer !== null) {
    window.clearTimeout(forceTimer);
    forceTimer = null;
  }
  setVisible(true);
  engine.setPermanentEmote(null);
  engine.setState("idle");
  engine.setAngry(true);
  engine.emit("anger", 2);
  notch.classList.add("low");
  updateStatus();
}

function collapseOrHide(): void {
  if (pinned) {
    setExpanded(false);
    updateStatus();
  } else {
    setVisible(false);
  }
}

function setVisible(on: boolean, expand = true): void {
  visible = on;
  notch.classList.toggle("visible", on);
  if (on) {
    if (expand) setExpanded(true);
    else setExpanded(false);
  } else {
    hovered = false;
    engine.lookX = 0;
    engine.lookY = 0;
    setExpanded(false);
  }
  publishRegion();
  if (on && !expand) window.setTimeout(publishRegion, 300);
}

function setHoverState(on: boolean): void {
  hovered = on;
  if (on) {
    if (pinned && compactMode === "clock") {
      if (!visible) {
        setVisible(true, true);
      } else {
        setExpanded(true);
      }
    } else if (!visible) {
      setVisible(true, false);
    }
  } else if (!forcedOpen) {
    if (pinned) {
      setExpanded(false);
    } else {
      setVisible(false);
    }
  }
}

function setExpanded(on: boolean): void {
  if (expanded === on) return;
  expanded = on;
  notch.classList.toggle("expanded", on);
  syncNotchWidth();
  const size = 88;
  if (petSize !== size) {
    petSize = size;
    bigPetSlot.appendChild(pet);
    pet.style.width = `${size}px`;
    pet.style.height = `${size}px`;
    pet.width = Math.round(size * Math.min(2, window.devicePixelRatio || 1));
    pet.height = Math.round(size * Math.min(2, window.devicePixelRatio || 1));
  }
  if (on) {
    if (!vitals.charging && !isLow()) engine.greet();
    nextIdleMove = performance.now() + 7000 + Math.random() * 5000;
    startPet();
  } else {
    cancelMove();
    stopPet();
  }
  publishRegion();
  window.setTimeout(publishRegion, 300);
}

function publishRegion(): void {
  const r = visible
    ? notch.getBoundingClientRect()
    : { left: (window.innerWidth - TRIGGER_W) / 2, top: 0, width: TRIGGER_W, height: TRIGGER_H };
  window.webkit?.messageHandlers?.nami?.postMessage(
    JSON.stringify({
      type: "region",
      x: Math.round(r.left),
      y: Math.round(r.top),
      w: Math.round(r.width),
      h: Math.round(r.height),
    }),
  );
}

function modelButtons(): void {
  for (const model of MODELS) {
    const button = document.createElement("button");
    button.className = "model";
    button.dataset.model = model.id;
    button.title = model.name;
    button.setAttribute("aria-label", model.name);
    button.style.setProperty("--swatch", model.color ?? "linear-gradient(135deg,#f4f4f6,#b9bbc2)");
    button.addEventListener("click", () => {
      modelId = model.id;
      applyModel();
      engine.squash();
      engine.triggerEmote("proud", 1.1);
      save();
    });
    modelRow.appendChild(button);
  }
}

function cycleOutfit(direction: number): void {
  const index = OUTFIT_SELECTIONS.indexOf(outfitSelection as OutfitSelection);
  const next = (index + direction + OUTFIT_SELECTIONS.length) % OUTFIT_SELECTIONS.length;
  outfitSelection = OUTFIT_SELECTIONS[next];
  applyOutfit(true);
  engine.triggerEmote("proud", 0.9);
  save();
}

function tickClock(): void {
  const now = new Date();
  const hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const time = `${hours % 12 || 12}:${minutes} ${hours >= 12 ? "PM" : "AM"}`;
  const date = now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  clock.textContent = time;
  dateEl.textContent = `${date} · ${time}`;
  syncNotchWidth();
  window.setTimeout(tickClock, 1000);
}

let lastFrame = performance.now();
let running = false;

function drawRunFx(ts: number, size: number): void {
  if (ts >= runFxUntil) return;
  const life = Ease.out(Math.min(1, (runFxUntil - ts) / 800));
  ctx.save();
  ctx.globalAlpha = 0.18 + 0.4 * life;
  ctx.strokeStyle = "#d7e9ff";
  ctx.lineWidth = 1.4;
  ctx.lineCap = "round";
  for (let i = 0; i < 5; i++) {
    const y = size * 0.46 + i * 7 + Math.sin(ts * 0.025 + i) * 1.5;
    const x = size * 0.06 + ((ts * 0.09 + i * 9) % 12);
    const len = 7 + (i % 3) * 4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y);
    ctx.stroke();
  }
  ctx.restore();
}

function frame(): void {
  if (!expanded) {
    running = false;
    return;
  }
  const ts = performance.now();
  const dt = Math.min(0.08, Math.max(0, (ts - lastFrame) / 1000));
  lastFrame = ts;

  if (currentMove !== null && ts >= moveUntil) {
    cancelMove();
    setStateForBattery();
  }
  if (
    currentMove === null &&
    !isLow() &&
    !vitals.charging &&
    ts >= nextIdleMove
  ) {
    const idleMoves: MoveName[] = ["smile", "dance", "run"];
    playMove(idleMoves[Math.floor(Math.random() * idleMoves.length)]);
  }

  engine.update(dt);
  const size = petSize || 88;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  drawRunFx(ts, size);
  engine.applyDance(ctx, size, size);
  engine.draw(ctx, size, size);
  ctx.restore();
  window.setTimeout(frame, isLow() ? 120 : 50);
}

function startPet(): void {
  if (running) return;
  running = true;
  lastFrame = performance.now();
  frame();
}

function stopPet(): void {
  running = false;
}

notch.addEventListener("mouseenter", () => {
  setHoverState(true);
});
notch.addEventListener("mouseleave", () => {
  setHoverState(false);
  engine.lookX = 0;
  engine.lookY = 0;
});
notch.addEventListener("dblclick", (event) => {
  event.stopPropagation();
  if (!visible) {
    setVisible(true, true);
  } else if (!expanded) {
    setExpanded(true);
  }
});
outfitPrev.addEventListener("click", (event) => {
  event.stopPropagation();
  cycleOutfit(-1);
});
outfitNext.addEventListener("click", (event) => {
  event.stopPropagation();
  cycleOutfit(1);
});
timeToggle.addEventListener("click", (event) => {
  event.stopPropagation();
  compactMode = compactMode === "clock" ? "stats" : "clock";
  applyCompactMode();
  save();
  engine.squash();
});
pinToggle.addEventListener("click", (event) => {
  event.stopPropagation();
  pinned = !pinned;
  applyPin();
  save();
  if (!pinned && !hovered && !forcedOpen) setVisible(false);
  engine.squash();
});
pet.title = "Click Nami for a move — move your cursor to make her follow it";
pet.addEventListener("click", (event) => {
  event.stopPropagation();
  if (isLow() || vitals.charging) return;
  moveIndex = (moveIndex + 1) % MOVES.length;
  playMove(MOVES[moveIndex]);
});
notch.addEventListener("mousemove", (event) => {
  const r = notch.getBoundingClientRect();
  engine.lookX = Math.max(-1, Math.min(1, ((event.clientX - r.left) / r.width - 0.5) * 2));
  engine.lookY = -Math.max(-1, Math.min(1, ((event.clientY - r.top) / r.height - 0.5) * 2));
});

window.setVitals = (next: Vitals) => {
  vitals = next;
  applyVitals();
};

window.setHover = (on: boolean) => {
  setHoverState(on);
};

modelButtons();
applyModel();
applyOutfit(false);
applyCompactMode();
applyPin();
setStateForBattery();
petSize = 88;
pet.style.width = "88px";
pet.style.height = "88px";
pet.width = Math.round(88 * Math.min(2, window.devicePixelRatio || 1));
pet.height = Math.round(88 * Math.min(2, window.devicePixelRatio || 1));
bigPetSlot.appendChild(pet);
tickClock();
if (pinned) setVisible(true, false);
publishRegion();

window.setInterval(() => {
  if (expanded && wasCharging) {
    engine.triggerEmote("love", 1.2);
  }
}, 1600);
