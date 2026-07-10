const canvas = document.getElementById("canvas");
const svg = document.getElementById("auraSvg");

const colorPicker = document.getElementById("colorPicker");
const backgroundPicker = document.getElementById("backgroundPicker");

const addAuraButton = document.getElementById("addAuraButton");
const undoButton = document.getElementById("undoButton");
const redoButton = document.getElementById("redoButton");
const clearButton = document.getElementById("clearButton");
const textureLayer = document.getElementById("textureLayer");
const textureButton = document.getElementById("textureButton");
const downloadButton = document.getElementById("downloadButton");
const sizePopover = document.getElementById("sizePopover");
const sizeSlider = document.getElementById("sizeSlider");

const backgroundDot = document.getElementById("backgroundDot");
const auraDot = document.getElementById("auraDot");

const instructions = document.getElementById("instructions");
const instructionsClose = document.getElementById("instructionsClose");

instructionsClose.addEventListener("click", () => {
  instructions.classList.add("hidden");
});

let auras = [];
let history = [];
let redoHistory = [];
let placingAura = null;

backgroundPicker.addEventListener("input", () => {
  canvas.style.backgroundColor = backgroundPicker.value;
  backgroundDot.style.backgroundColor = backgroundPicker.value;
});

colorPicker.addEventListener("input", () => {
  auraDot.style.backgroundColor = colorPicker.value;
});

addAuraButton.addEventListener("click", startPlacingAura);
undoButton.addEventListener("click", undo);
redoButton.addEventListener("click", redo);
clearButton.addEventListener("click", clearAuras);
textureButton.addEventListener("click", toggleTexture);
downloadButton.addEventListener("click", downloadAura);
sizeSlider.addEventListener("input", () => {
  if (!placingAura) return;

  placingAura.radius = Number(sizeSlider.value);
  resetPoints(placingAura);
  drawAura(placingAura);
});


function startPlacingAura() {
  if (placingAura) {
    placingAura.path.remove();
  }

  sizePopover.classList.remove("hidden");

  const size = Number(sizeSlider.value);

  placingAura = createAura(
    colorPicker.value,
    window.innerWidth / 2,
    window.innerHeight / 2,
    size
  );

  placingAura.path.style.pointerEvents = "none";
}

svg.addEventListener("pointermove", e => {
  if (!placingAura) return;

  placingAura.cx = e.clientX;
  placingAura.cy = e.clientY;

  resetPoints(placingAura);
  drawAura(placingAura);
});

svg.addEventListener("pointerdown", e => {
  if (!placingAura) return;

  placingAura.cx = e.clientX;
  placingAura.cy = e.clientY;

  resetPoints(placingAura);
  drawAura(placingAura);

  placingAura.path.style.pointerEvents = "auto";

  auras.push(placingAura);
  history.push({ type: "add", aura: placingAura });
  redoHistory = [];

  makeAuraInteractive(placingAura);
  placingAura = null;
});

svg.addEventListener("wheel", e => {
  if (!placingAura) return;

  e.preventDefault();

  placingAura.radius += e.deltaY > 0 ? -12 : 12;
  placingAura.radius = Math.max(60, Math.min(400, placingAura.radius));

  resetPoints(placingAura);
  drawAura(placingAura);
}, { passive: false });

function createAura(color, cx, cy, radius) {
  const aura = {
    color,
    cx,
    cy,
    radius,
    blur: 18,
    points: [],
    path: document.createElementNS("http://www.w3.org/2000/svg", "path")
  };

  aura.path.classList.add("aura-shape");
  aura.path.style.setProperty("--blur", `${aura.blur}px`);
  aura.path.setAttribute("fill", color);

  svg.appendChild(aura.path);

  resetPoints(aura);
  makeAuraInteractive(aura);

  return aura;
}

function resetPoints(aura) {
  aura.points = [];

  const total = 80;

  for (let i = 0; i < total; i++) {
    const angle = (Math.PI * 2 * i) / total;

    aura.points.push({
      angle,
      x: aura.cx + Math.cos(angle) * aura.radius,
      y: aura.cy + Math.sin(angle) * aura.radius
    });
  }
}

function drawAura(aura) {
  const points = aura.points;

  const d = points.map((p, i) => {
    const next = points[(i + 1) % points.length];
    const midX = (p.x + next.x) / 2;
    const midY = (p.y + next.y) / 2;

    return i === 0
      ? `M ${midX} ${midY}`
      : `Q ${p.x} ${p.y} ${midX} ${midY}`;
  }).join(" ") + " Z";

  aura.path.setAttribute("d", d);
  aura.path.style.setProperty("--blur", `${aura.blur}px`);
}

function makeAuraInteractive(aura) {
  let pressing = false;
  let moved = false;
  let previousState = null;

  aura.path.onpointerdown = e => {
  if (placingAura) return;

  e.preventDefault();

  pressing = true;
  moved = false;
  previousState = copyAuraState(aura);

  aura.path.setPointerCapture(e.pointerId);
};

  aura.path.onpointermove = e => {
  if (!pressing) return;

  if (Math.abs(e.movementX) > 3 || Math.abs(e.movementY) > 3) {
    moved = true;
  }

  deformAura(aura, e.clientX, e.clientY, e.movementX, e.movementY);
  drawAura(aura);
};

  aura.path.onpointerup = () => {
    pressing = false;

    if (moved) {
      history.push({
        type: "change",
        aura,
        before: previousState,
        after: copyAuraState(aura)
      });
      redoHistory = [];
    } else {
      softenAura(aura);
    }
  };
}

function deformAura(aura, x, y, dx, dy) {
  const isMobile = window.innerWidth <= 700;

  const radius = isMobile ? 520 : 460;
  const strength = isMobile ? 1.15 : 1.05;

  aura.points.forEach(point => {
    const distance = Math.hypot(point.x - x, point.y - y);
    const influence = Math.max(0, 1 - distance / radius);

    point.x += dx * influence * strength;
    point.y += dy * influence * strength;
  });
}

function softenAura(aura) {
  const before = copyAuraState(aura);

  aura.blur += 10;
  if (aura.blur > 80) aura.blur = 18;

  drawAura(aura);

  history.push({
    type: "change",
    aura,
    before,
    after: copyAuraState(aura)
  });

  redoHistory = [];
}

function copyAuraState(aura) {
  return {
    blur: aura.blur,
    points: aura.points.map(p => ({ ...p }))
  };
}

function restoreAuraState(aura, state) {
  aura.blur = state.blur;
  aura.points = state.points.map(p => ({ ...p }));
  drawAura(aura);
}

function undo() {
  const action = history.pop();
  if (!action) return;

  if (action.type === "add") {
    action.aura.path.remove();
    auras = auras.filter(a => a !== action.aura);
  }

  if (action.type === "change") {
    restoreAuraState(action.aura, action.before);
  }

  redoHistory.push(action);
}

function redo() {
  const action = redoHistory.pop();
  if (!action) return;

  if (action.type === "add") {
    svg.appendChild(action.aura.path);
    auras.push(action.aura);
  }

  if (action.type === "change") {
    restoreAuraState(action.aura, action.after);
  }

  history.push(action);
}

function clearAuras() {
  auras.forEach(aura => aura.path.remove());
  auras = [];
  history = [];
  redoHistory = [];

  if (placingAura) {
    placingAura.path.remove();
    sizePopover.classList.add("hidden");
    placingAura = null;
  }
}

function toggleTexture() {
  textureLayer.classList.toggle("active");
}

function downloadAura() {
  const controls = document.querySelector(".controls");
  const instructions = document.querySelector(".instructions");
  const sizePopover = document.getElementById("sizePopover");

  controls.style.display = "none";
  instructions.style.display = "none";

  if (instructions) instructions.style.display = "none";

  if (sizePopover) {
    sizePopover.style.display = "none";
  }

  html2canvas(canvas, {
    scale: 2,
    backgroundColor: null
  }).then(canvasImage => {
    controls.style.display = "flex";
    instructions.style.display = "block";

    if (sizePopover && !sizePopover.classList.contains("hidden")) {
      sizePopover.style.display = "flex";
    }

    const link = document.createElement("a");
    link.download = "aura.png";
    link.href = canvasImage.toDataURL("image/png");
    link.click();
  });
}

document.addEventListener("keydown", e => {
  const isUndo = (e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "z";
  const isRedo = (e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "z";

  if (isUndo) {
    e.preventDefault();
    undo();
  }

  if (isRedo) {
    e.preventDefault();
    redo();
  }
});

function toggleTexture() {
  textureLayer.classList.toggle("active");
}

window.addEventListener("load", () => {
  startPlacingAura();
});