const presetSelect = document.getElementById("presetSelect");
const modeCollection = document.getElementById("modeCollection");
const modeInteractive = document.getElementById("modeInteractive");
const exprInput = document.getElementById("exprInput");
const domainInput = document.getElementById("domainInput");
const epsInput = document.getElementById("epsInput");
const methodSelect = document.getElementById("methodSelect");
const nodeTypeSelect = document.getElementById("nodeTypeSelect");
const nInput = document.getElementById("nInput");
const runBtn = document.getElementById("runBtn");
const statusEl = document.getElementById("status");
const valuesBody = document.getElementById("valuesBody");
const plot = document.getElementById("plot");

const PRESETS = [
  {
    key: "a",
    label: "a) x*e^(2sin(x))",
    a: -2,
    b: 2,
    expr: "x*exp(2*sin(x))",
  },
  {
    key: "b",
    label: "b) sin(x)+cos(x)",
    a: -6,
    b: 6,
    expr: "sin(x)+cos(x)",
  },
  {
    key: "c",
    label: "c) sin(pi*x/6)-cos(x-1)",
    a: -7,
    b: 8,
    expr: "sin(pi*x/6)-cos(x-1)",
  },
  {
    key: "d",
    label: "d) e^(-x)-x^3+8cos(4x)",
    a: -3,
    b: 3,
    expr: "exp(-x)-x**3+8*cos(4*x)",
  },
  {
    key: "e",
    label: "e) x^3-5arctg(x)",
    a: -3,
    b: 3,
    expr: "x**3-5*atan(x)",
  },
];

function isFiniteNumber(value) {
  return Number.isFinite(value) && !Number.isNaN(value);
}

function setStatus(text, cls = "") {
  statusEl.className = "hint " + cls;
  statusEl.textContent = text;
}

function clearTables() {
  valuesBody.innerHTML = "";
}

function parseDomain(rawDomain) {
  const text = String(rawDomain).trim();
  const matches = text.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi);

  if (!matches || matches.length < 2) {
    throw new Error("Domeniul trebuie scris ca [a, b], de exemplu [-3, 3].");
  }

  const a = Number(matches[0]);
  const b = Number(matches[1]);

  if (!isFiniteNumber(a) || !isFiniteNumber(b)) {
    throw new Error("Valorile pentru domeniu sunt invalide.");
  }

  return { a, b };
}

function validateData(a, b, nodeCount, eps) {
  if (!isFiniteNumber(a) || !isFiniteNumber(b)) return "Valorile domeniului sunt invalide.";
  if (a >= b) return "Trebuie sa avem a < b in domeniul [a, b].";
  if (!Number.isInteger(nodeCount) || nodeCount < 2) return "Nr. noduri trebuie sa fie intreg si >= 2.";
  if (!isFiniteNumber(eps) || eps < 0) return "Eroarea trebuie sa fie un numar >= 0.";
  return "";
}

function makeFunctionFromExpr(expr) {
  const safe = String(expr).trim();
  if (!safe) throw new Error("Expresia functiei este goala.");

  return new Function(
    "x",
    `
      "use strict";
      const {sin, cos, tan, asin, acos, atan, exp, log, sqrt, abs, PI} = Math;
      const pi = PI;
      return (${safe});
    `
  );
}

function getSelectedFunction() {
  if (modeCollection.checked) {
    if (!presetSelect.value) {
      throw new Error("Selecteaza o functie din colectie.");
    }

    const preset = PRESETS.find((item) => item.key === presetSelect.value);
    if (!preset) {
      throw new Error("Functia presetata nu a fost gasita.");
    }

    return {
      expr: preset.expr,
      f: makeFunctionFromExpr(preset.expr),
    };
  }

  return {
    expr: exprInput.value.trim(),
    f: makeFunctionFromExpr(exprInput.value),
  };
}

function fillPresets() {
  presetSelect.innerHTML = "";

  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "— alege preset —";
  presetSelect.appendChild(empty);

  for (const preset of PRESETS) {
    const option = document.createElement("option");
    option.value = preset.key;
    option.textContent = preset.label;
    presetSelect.appendChild(option);
  }
}

function applyPreset() {
  const preset = PRESETS.find((item) => item.key === presetSelect.value);
  if (!preset) return;

  exprInput.value = preset.expr;
  domainInput.value = `[${preset.a}, ${preset.b}]`;
}

function syncFunctionMode() {
  const isCollectionMode = modeCollection.checked;
  presetSelect.disabled = !isCollectionMode;
  exprInput.disabled = isCollectionMode;

  if (isCollectionMode) {
    applyPreset();
  }
}

function buildNodes(a, b, nodeCount, type) {
  const total = nodeCount;

  if (type === "equidistant") {
    const nodes = [];
    for (let i = 0; i < total; i++) {
      nodes.push(a + ((b - a) * i) / (total - 1));
    }
    return nodes;
  }

  if (type === "chebyshev") {
    const nodes = [];
    for (let i = 0; i < total; i++) {
      const t = Math.cos(((2 * i + 1) * Math.PI) / (2 * total));
      nodes.push((a + b) / 2 + ((b - a) / 2) * t);
    }
    nodes.sort((x1, x2) => x1 - x2);
    return nodes;
  }

  if (type === "random") {
    const nodes = [a, b];
    for (let i = 0; i < total - 2; i++) {
      nodes.push(a + Math.random() * (b - a));
    }
    nodes.sort((x1, x2) => x1 - x2);
    return nodes;
  }

  return [];
}

function buildNodeValues(f, xs) {
  return xs.map((x) => ({ x, y: f(x) }));
}

function lagrangeValue(nodeData, x) {
  let result = 0;
  const n = nodeData.length;

  for (let i = 0; i < n; i++) {
    let term = nodeData[i].y;

    for (let j = 0; j < n; j++) {
      if (i !== j) {
        term *= (x - nodeData[j].x) / (nodeData[i].x - nodeData[j].x);
      }
    }

    result += term;
  }

  return result;
}

function piecewiseLagrangeValue(nodeData, x) {
  const last = nodeData.length - 1;

  if (x <= nodeData[0].x) {
    return lagrangeValue([nodeData[0], nodeData[1]], x);
  }

  if (x >= nodeData[last].x) {
    return lagrangeValue([nodeData[last - 1], nodeData[last]], x);
  }

  for (let i = 0; i < last; i++) {
    const left = nodeData[i];
    const right = nodeData[i + 1];

    if (x >= left.x && x <= right.x) {
      return lagrangeValue([left, right], x);
    }
  }

  return NaN;
}

function buildNaturalSpline(nodeData) {
  const n = nodeData.length - 1;
  const xs = nodeData.map((p) => p.x);
  const ys = nodeData.map((p) => p.y);
  const h = [];

  for (let i = 0; i < n; i++) {
    h[i] = xs[i + 1] - xs[i];
  }

  const alpha = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    alpha[i] = (3 / h[i]) * (ys[i + 1] - ys[i]) - (3 / h[i - 1]) * (ys[i] - ys[i - 1]);
  }

  const l = new Array(n + 1).fill(0);
  const mu = new Array(n + 1).fill(0);
  const z = new Array(n + 1).fill(0);
  const c = new Array(n + 1).fill(0);
  const b = new Array(n).fill(0);
  const d = new Array(n).fill(0);
  const a = ys.slice();

  l[0] = 1;
  mu[0] = 0;
  z[0] = 0;

  for (let i = 1; i < n; i++) {
    l[i] = 2 * (xs[i + 1] - xs[i - 1]) - h[i - 1] * mu[i - 1];
    mu[i] = h[i] / l[i];
    z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
  }

  l[n] = 1;
  z[n] = 0;
  c[n] = 0;

  for (let j = n - 1; j >= 0; j--) {
    c[j] = z[j] - mu[j] * c[j + 1];
    b[j] = (a[j + 1] - a[j]) / h[j] - (h[j] * (c[j + 1] + 2 * c[j])) / 3;
    d[j] = (c[j + 1] - c[j]) / (3 * h[j]);
  }

  return function splineValue(x) {
    let i = n - 1;

    if (x <= xs[0]) {
      i = 0;
    } else if (x >= xs[n]) {
      i = n - 1;
    } else {
      for (let j = 0; j < n; j++) {
        if (x >= xs[j] && x <= xs[j + 1]) {
          i = j;
          break;
        }
      }
    }

    const dx = x - xs[i];
    return a[i] + b[i] * dx + c[i] * dx * dx + d[i] * dx * dx * dx;
  };
}

function buildApproximation(nodeData, method) {
  if (method === "lagrange") {
    return (x) => lagrangeValue(nodeData, x);
  }

  if (method === "piecewise") {
    return (x) => piecewiseLagrangeValue(nodeData, x);
  }

  if (method === "spline") {
    return buildNaturalSpline(nodeData);
  }

  return () => NaN;
}

function buildEvaluationPoints(a, b, count) {
  const points = [];
  const total = Math.max(2, Math.floor(count));
  for (let i = 0; i < total; i++) {
    points.push(a + ((b - a) * i) / (total - 1));
  }
  return points;
}

function fillValuesTable(f, approx, evalPoints) {
  valuesBody.innerHTML = "";
  let maxError = 0;

  for (const x of evalPoints) {
    const fx = f(x);
    const px = approx(x);
    const error = Math.abs(fx - px);
    maxError = Math.max(maxError, error);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="mono">${x.toFixed(6)}</td>
      <td class="mono">${fx.toExponential(6)}</td>
      <td class="mono">${px.toExponential(6)}</td>
      <td class="mono">${error.toExponential(6)}</td>
    `;
    valuesBody.appendChild(tr);
  }

  return maxError;
}

function sampleFunction(fn, a, b, count = 700) {
  const xs = [];
  const ys = [];

  for (let i = 0; i <= count; i++) {
    const x = a + ((b - a) * i) / count;
    let y = NaN;

    try {
      y = fn(x);
    } catch {
      y = NaN;
    }

    xs.push(x);
    ys.push(y);
  }

  return { xs, ys };
}

function drawPlot(canvas, original, approx, errorSample, nodeData, a, b) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  const allY = [];
  for (const y of original.ys) if (isFiniteNumber(y)) allY.push(y);
  for (const y of approx.ys) if (isFiniteNumber(y)) allY.push(y);
  for (const y of errorSample.ys) if (isFiniteNumber(y)) allY.push(y);

  let yMin = -1;
  let yMax = 1;

  if (allY.length > 0) {
    yMin = Math.min(...allY);
    yMax = Math.max(...allY);
    yMin = Math.min(yMin, 0);
    if (Math.abs(yMax - yMin) < 1e-12) {
      yMin -= 1;
      yMax += 1;
    }
  }

  const padL = 52;
  const padR = 20;
  const padT = 20;
  const padB = 35;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const xToPx = (x) => padL + ((x - a) * plotW) / (b - a);
  const yToPy = (y) => padT + ((yMax - y) * plotH) / (yMax - yMin);

  ctx.strokeStyle = "#cfcfcf";
  ctx.strokeRect(padL, padT, plotW, plotH);

  if (0 >= yMin && 0 <= yMax) {
    ctx.strokeStyle = "#bdbdbd";
    ctx.beginPath();
    ctx.moveTo(padL, yToPy(0));
    ctx.lineTo(W - padR, yToPy(0));
    ctx.stroke();
  }

  if (0 >= a && 0 <= b) {
    ctx.strokeStyle = "#bdbdbd";
    ctx.beginPath();
    ctx.moveTo(xToPx(0), padT);
    ctx.lineTo(xToPx(0), H - padB);
    ctx.stroke();
  }

  function drawLine(sample, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    let started = false;
    for (let i = 0; i < sample.xs.length; i++) {
      const x = sample.xs[i];
      const y = sample.ys[i];

      if (!isFiniteNumber(y)) {
        started = false;
        continue;
      }

      const px = xToPx(x);
      const py = yToPy(y);
      if (!started) {
        ctx.moveTo(px, py);
        started = true;
      } else {
        ctx.lineTo(px, py);
      }
    }

    ctx.stroke();
  }

  drawLine(original, "#2b6cb0");
  drawLine(approx, "#c53030");
  drawLine(errorSample, "#2f855a");

  ctx.fillStyle = "#111111";
  for (const point of nodeData) {
    ctx.beginPath();
    ctx.arc(xToPx(point.x), yToPy(point.y), 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#333333";
  ctx.font = "12px Arial";
  ctx.fillText("albastru = f(x)", padL, 14);
  ctx.fillText("rosu = P(x)", padL + 105, 14);
  ctx.fillText("verde = E(x)", padL + 190, 14);
  ctx.fillText(`domeniu [${a}, ${b}]`, padL, H - 10);
}

runBtn.addEventListener("click", () => {
  clearTables();

  let domain;
  try {
    domain = parseDomain(domainInput.value);
  } catch (error) {
    setStatus(error.message || "Domeniul nu este valid.", "err");
    return;
  }

  const a = domain.a;
  const b = domain.b;
  const nodeCount = Number(nInput.value);
  const eps = Number(epsInput.value);
  const nodeType = nodeTypeSelect.value;
  const method = methodSelect.value;

  const validationMessage = validateData(a, b, nodeCount, eps);
  if (validationMessage) {
    setStatus(validationMessage, "err");
    return;
  }

  let fObject;
  try {
    fObject = getSelectedFunction();
  } catch (error) {
    setStatus(error.message || "Functia nu a putut fi interpretata.", "err");
    return;
  }

  const f = (x) => {
    const y = fObject.f(x);
    return typeof y === "number" ? y : NaN;
  };

  const nodeXs = buildNodes(a, b, nodeCount, nodeType);
  const nodeData = buildNodeValues(f, nodeXs);
  const invalidNode = nodeData.some((point) => !isFiniteNumber(point.y));
  if (invalidNode) {
    setStatus("Functia nu are valori valide in toate nodurile selectate.", "err");
    return;
  }

  const approx = buildApproximation(nodeData, method);
  const evalPoints = buildEvaluationPoints(a, b, Math.max(25, nodeCount * 4));
  const maxError = fillValuesTable(f, approx, evalPoints);

  const originalSample = sampleFunction(f, a, b);
  const approxSample = sampleFunction(approx, a, b);
  const errorSample = sampleFunction((x) => Math.abs(f(x) - approx(x)), a, b);
  drawPlot(plot, originalSample, approxSample, errorSample, nodeData, a, b);

  const methodName = methodSelect.options[methodSelect.selectedIndex].textContent;
  const nodeTypeName = nodeTypeSelect.options[nodeTypeSelect.selectedIndex].textContent;
  const thresholdOk = maxError <= eps;
  const thresholdText = thresholdOk ? "respectata" : "depasita";

  setStatus(
    `Calcul finalizat. Forma: ${methodName}. Retea: ${nodeTypeName}. Noduri: ${nodeCount}. Eroare maxima = ${maxError.toExponential(3)}. Prag = ${eps.toExponential(3)} (${thresholdText}).`,
    thresholdOk ? "ok" : "warn"
  );
});

presetSelect.addEventListener("change", () => {
  if (modeCollection.checked) applyPreset();
});
modeCollection.addEventListener("change", syncFunctionMode);
modeInteractive.addEventListener("change", syncFunctionMode);

fillPresets();
presetSelect.value = "b";
applyPreset();
syncFunctionMode();
