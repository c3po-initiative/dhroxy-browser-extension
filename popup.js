const $ = (id) => document.getElementById(id);
const send = (msg) => chrome.runtime.sendMessage(typeof msg === "string" ? { type: msg } : msg)
  .then((r) => { if (!r.ok) throw new Error(r.error); return r.data; });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Citizen-friendly names, in the order they are shown.
const TYPES = [
  ["Patient", "Dine stamdata", "Kræves for at samle dine data"],
  ["Condition", "Diagnoser", null],
  ["MedicationStatement", "Medicin", null],
  ["MedicationRequest", "Ordinationer og recepter", null],
  ["Observation", "Laboratoriesvar", null],
  ["Encounter", "Hospitalskontakter", null],
  ["DocumentReference", "Epikriser og notater", "Fri tekst fra journalen"],
  ["Immunization", "Vaccinationer", null],
  ["DiagnosticReport", "Billedbeskrivelser", null],
  ["ImagingStudy", "Billedundersøgelser", null],
  ["Appointment", "Aftaler", null],
  ["Organization", "Egen læge", null]
];
const LOCKED = new Set(["Patient"]);
let selection = null; // Set of chosen resource types
let counts = {};
let settings = {};

const plural = (n, one, many) => `${n.toLocaleString("da-DK")} ${n === 1 ? one : many}`;

function renderChoices(summary) {
  counts = summary.counts;
  const present = TYPES.filter(([t]) => counts[t]);
  if (!selection) selection = new Set(present.map(([t]) => t));
  $("choiceList").innerHTML = present.map(([t, name, sub]) => `
    <li class="${LOCKED.has(t) ? "locked" : ""}"><label>
      <input type="checkbox" data-type="${t}" ${selection.has(t) ? "checked" : ""} ${LOCKED.has(t) ? "disabled" : ""}>
      <span class="name">${esc(name)}${sub ? `<span class="sub">${esc(sub)}</span>` : ""}</span>
      <span class="chip">${counts[t]}</span>
    </label></li>`).join("");
  $("choiceList").querySelectorAll("input").forEach((cb) => cb.addEventListener("change", () => {
    cb.checked ? selection.add(cb.dataset.type) : selection.delete(cb.dataset.type);
    chrome.storage.session.set({ selection: [...selection] });
    renderTransfer();
  }));

  const errs = summary.errors || [];
  $("issues").hidden = !errs.length;
  $("issuesSummary").textContent = `${plural(errs.length, "kilde", "kilder")} kunne ikke hentes`;
  $("issueList").innerHTML = errs.map((e) => `<li>${esc(e)}</li>`).join("");

  $("choices").hidden = false;
  $("chooseIntro").textContent = `Vi fandt ${plural(summary.total, "post", "poster")}. Fjern fluebenet ved det, du ikke vil overføre.`;
  $("fetch").textContent = "Hent igen";
  $("fetch").className = "btn secondary small";
  $("stepChoose").classList.add("done");
  renderTransfer();
}

function chosenCount() {
  return [...selection].reduce((n, t) => n + (counts[t] || 0), 0);
}

function renderTransfer() {
  const ready = selection && [...selection].some((t) => !LOCKED.has(t) && counts[t]);
  $("upload").disabled = !ready;
  $("stepTransfer").classList.toggle("locked", !selection);
  $("transferInfo").textContent = !selection
    ? "Vælg først dine oplysninger."
    : ready
      ? `${plural(chosenCount(), "post", "poster")} er valgt. De sendes til ${new URL(settings.fhirUrl).host}.`
      : "Vælg mindst én type oplysninger.";
}

async function refresh() {
  const s = await send("status");
  settings = s.settings;
  if (s.session) {
    const min = Math.round((Date.now() - s.session.capturedAt) / 60000);
    $("sessionStatus").innerHTML = `<span class="dot ok"></span><span>Du er logget ind <span class="meta">(set for ${min} min siden)</span></span>`;
    $("openSundhed").hidden = true;
    $("stepLogin").classList.add("done", "compact");
    $("stepLogin").querySelector(".num").textContent = "✓";
    $("stepLogin").querySelector("h2").textContent = "Logget ind på Sundhed.dk";
    $("fetch").disabled = false;
  } else {
    $("sessionStatus").innerHTML = `<span class="dot off"></span><span>Log ind med MitID og åbn fx din sundhedsjournal. Kom så tilbage hertil.</span>`;
    $("openSundhed").hidden = false;
    $("stepLogin").classList.remove("done");
    $("fetch").disabled = true;
  }
  if (s.lastFetch) {
    const { selection: saved } = await chrome.storage.session.get("selection");
    if (saved && !selection) selection = new Set(saved);
    renderChoices(s.lastFetch);
  } else {
    renderTransfer();
  }
}

$("openSundhed").onclick = () => chrome.tabs.create({ url: "https://www.sundhed.dk/borger/" });

$("fetch").onclick = async () => {
  const label = $("fetch").textContent;
  $("fetch").disabled = true; $("fetch").textContent = "Henter…";
  const timer = setInterval(async () => {
    const s = await send("status").catch(() => null);
    if (s?.progress) $("fetch").textContent = s.progress;
  }, 700);
  try {
    selection = null;
    await chrome.storage.session.remove("selection");
    renderChoices(await send("fetch"));
  } catch (e) {
    $("chooseIntro").innerHTML = `<span class="error">${esc(e.message)}</span>`;
    $("fetch").textContent = label;
  } finally {
    clearInterval(timer);
    $("fetch").disabled = false;
  }
};

$("upload").onclick = () => {
  $("confirmText").textContent = `Du overfører ${plural(chosenCount(), "post", "poster")} til ${new URL(settings.fhirUrl).host}. Vil du fortsætte?`;
  $("confirm").hidden = false;
  $("upload").hidden = true;
  $("uploadError").hidden = true;
};
$("cancel").onclick = () => { $("confirm").hidden = true; $("upload").hidden = false; };

$("confirmBtn").onclick = async () => {
  $("confirmBtn").disabled = true; $("confirmBtn").textContent = "Overfører…";
  try {
    const r = await send({ type: "upload", types: [...selection] });
    const failed = Object.entries(r.statuses).filter(([k]) => !/^2/.test(k)).reduce((n, [, v]) => n + v, 0);
    $("resultCount").textContent = plural(r.sent - failed, "post", "poster");
    $("resultMeta").textContent = failed ? `${failed} blev afvist af serveren` : "Alt kom sikkert frem";
    $("result").hidden = false;
    $("confirm").hidden = true;
    $("stepTransfer").classList.add("done");
  } catch (e) {
    $("uploadError").textContent = e.message;
    $("uploadError").hidden = false;
    $("confirm").hidden = true;
    $("upload").hidden = false;
  } finally {
    $("confirmBtn").disabled = false; $("confirmBtn").textContent = "Ja, overfør";
  }
};

$("forget").onclick = async (e) => {
  e.preventDefault();
  await send("forget");
  location.reload();
};
$("opts").onclick = (e) => { e.preventDefault(); chrome.runtime.openOptionsPage(); };

refresh();
