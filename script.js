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

const hideToolsButton =
  document.getElementById("hideToolsButton");

const showToolsButton =
  document.getElementById("showToolsButton");

function closeInstructions(e) {
  e.preventDefault();
  e.stopPropagation();

  instructions.classList.add("hidden");
}


/*
  pointerdown is more reliable here because the
  drawing interface itself uses pointer events.
*/

instructionsClose.addEventListener(
  "pointerdown",
  closeInstructions
);


/*
  Keep click as a fallback for keyboard /
  desktop accessibility.
*/

instructionsClose.addEventListener("click", e => {
  e.preventDefault();
  e.stopPropagation();
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

/* ==========================================
   CUSTOM MOBILE COLOUR PICKER
========================================== */

const mobileColorPicker = document.getElementById("mobileColorPicker");
const mobileColorPickerTitle = document.getElementById("mobileColorPickerTitle");
const mobileColorPickerDone = document.getElementById("mobileColorPickerDone");

const colorField = document.getElementById("colorField");
const colorFieldCursor = document.getElementById("colorFieldCursor");
const hueSlider = document.getElementById("hueSlider");

const backgroundControl = backgroundPicker.closest(".color-control");
const auraControl = colorPicker.closest(".color-control");


let activeMobilePicker = null;

let pickerHue = 0;
let pickerSaturation = 1;
let pickerValue = 1;


/* ------------------------------------------
   Detect mobile
------------------------------------------ */

function isMobileColourPicker() {
  return window.innerWidth <= 700;
}


/* ------------------------------------------
   Open picker
------------------------------------------ */

function openMobileColourPicker(type) {

  if (!isMobileColourPicker()) return;

  activeMobilePicker = type;

  if (type === "background") {
    mobileColorPickerTitle.textContent = "Background";
  }

  if (type === "aura") {
    mobileColorPickerTitle.textContent = "Aura";
  }

  mobileColorPicker.classList.remove("hidden");

  updateColourField();
}


/* ------------------------------------------
   Prevent native mobile colour picker
------------------------------------------ */

backgroundControl.addEventListener("click", e => {

  if (!isMobileColourPicker()) return;

  e.preventDefault();

  openMobileColourPicker("background");
});


auraControl.addEventListener("click", e => {

  if (!isMobileColourPicker()) return;

  e.preventDefault();

  openMobileColourPicker("aura");
});


/* ------------------------------------------
   Close picker
------------------------------------------ */

mobileColorPickerDone.addEventListener("click", e => {

  e.preventDefault();
  e.stopPropagation();

  mobileColorPicker.classList.add("hidden");

  activeMobilePicker = null;
});


/* ------------------------------------------
   Hue
------------------------------------------ */

hueSlider.addEventListener("input", () => {

  pickerHue = Number(hueSlider.value);

  updateColourField();

  applyMobileColour();
});


function updateColourField() {

  colorField.style.background = `
    linear-gradient(to top, #000, transparent),
    linear-gradient(to right, #fff, transparent),
    hsl(${pickerHue}, 100%, 50%)
  `;
}


/* ------------------------------------------
   Saturation / brightness field
------------------------------------------ */

function chooseFieldColour(e) {

  const rect = colorField.getBoundingClientRect();

  let x = e.clientX - rect.left;
  let y = e.clientY - rect.top;

  x = Math.max(0, Math.min(rect.width, x));
  y = Math.max(0, Math.min(rect.height, y));


  pickerSaturation = x / rect.width;

  pickerValue = 1 - (y / rect.height);


  colorFieldCursor.style.left =
    `${pickerSaturation * 100}%`;

  colorFieldCursor.style.top =
    `${(1 - pickerValue) * 100}%`;


  applyMobileColour();
}


colorField.addEventListener("pointerdown", e => {

  e.preventDefault();

  colorField.setPointerCapture(e.pointerId);

  chooseFieldColour(e);
});


colorField.addEventListener("pointermove", e => {

  if (!colorField.hasPointerCapture(e.pointerId)) return;

  e.preventDefault();

  chooseFieldColour(e);
});


colorField.addEventListener("pointerup", e => {

  if (colorField.hasPointerCapture(e.pointerId)) {
    colorField.releasePointerCapture(e.pointerId);
  }

});


/* ------------------------------------------
   Apply colour
------------------------------------------ */

function applyMobileColour() {

  if (!activeMobilePicker) return;


  const hex = hsvToHex(
    pickerHue,
    pickerSaturation,
    pickerValue
  );


  /* BACKGROUND */

  if (activeMobilePicker === "background") {

    backgroundPicker.value = hex;

    /*
      Trigger your existing background input
      listener rather than duplicating it.
    */

    backgroundPicker.dispatchEvent(
      new Event("input", {
        bubbles: true
      })
    );
  }


  /* AURA */

  if (activeMobilePicker === "aura") {

    colorPicker.value = hex;

    /*
      Trigger your existing aura input listener.
    */

    colorPicker.dispatchEvent(
      new Event("input", {
        bubbles: true
      })
    );


    /*
      If an aura is currently waiting to be
      placed, update it live too.
    */

    if (placingAura) {

      placingAura.color = hex;

      placingAura.path.setAttribute(
        "fill",
        hex
      );
    }
  }

}


/* ------------------------------------------
   HSV → HEX
------------------------------------------ */

function hsvToHex(h, s, v) {

  const c = v * s;

  const x =
    c *
    (
      1 -
      Math.abs(
        ((h / 60) % 2) - 1
      )
    );

  const m = v - c;


  let r = 0;
  let g = 0;
  let b = 0;


  if (h >= 0 && h < 60) {

    r = c;
    g = x;
    b = 0;

  } else if (h >= 60 && h < 120) {

    r = x;
    g = c;
    b = 0;

  } else if (h >= 120 && h < 180) {

    r = 0;
    g = c;
    b = x;

  } else if (h >= 180 && h < 240) {

    r = 0;
    g = x;
    b = c;

  } else if (h >= 240 && h < 300) {

    r = x;
    g = 0;
    b = c;

  } else {

    r = c;
    g = 0;
    b = x;
  }


  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);


  return "#" +
    componentToHex(r) +
    componentToHex(g) +
    componentToHex(b);
}


function componentToHex(value) {

  return value
    .toString(16)
    .padStart(2, "0");
}

/* ==========================================
   HIDE / SHOW TOOLS
========================================== */

hideToolsButton.addEventListener("click", e => {

  e.preventDefault();
  e.stopPropagation();


  /*
    Close the colour picker if it happens to
    be open when tools are hidden.
  */

  if (typeof mobileColorPicker !== "undefined") {
    mobileColorPicker.classList.add("hidden");
  }


  document.body.classList.add("tools-hidden");

});


showToolsButton.addEventListener("click", e => {

  e.preventDefault();
  e.stopPropagation();

  document.body.classList.remove("tools-hidden");

});