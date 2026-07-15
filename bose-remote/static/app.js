/* Remote UI: hydrates from /api/state, stays live via /api/events (SSE),
   sends actions as fire-and-forget POSTs. Server state is authoritative -
   every render comes from a full state snapshot. */

const $ = (id) => document.getElementById(id);

let state = null;
let sliderBusy = false;   // finger on the volume slider
let eqBusy = {};          // option -> finger on that EQ slider

// ---------------------------------------------------------------- actions

async function post(path, body) {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const detail = (await res.json().catch(() => ({}))).detail;
      showError(detail || `request failed (${res.status})`);
    } else {
      showError(null);
    }
  } catch (e) {
    showError("server unreachable");
  }
}

// ----------------------------------------------------------------- render

function showError(msg) {
  const el = $("error");
  el.hidden = !msg;
  el.textContent = msg || "";
}

function render() {
  if (!state) return;

  const dev = state.device || {};
  if (dev.name) $("device-name").textContent = dev.name;
  $("product-name").textContent =
    (dev.productName || "") + (state.mock ? " · mock mode" : "");

  // connection dot
  const connected = state.connected && !state.error;
  $("status-dot").classList.toggle("on", connected);
  $("status-text").textContent = connected
    ? "connected"
    : state.error
      ? "not connected"
      : "connecting";
  if (state.error) showError(state.error);

  // power
  const on = state.power === "ON";
  $("power").classList.toggle("on", on);

  // volume
  const vol = state.volume || {};
  const volEl = $("vol-value");
  volEl.textContent = vol.value ?? "–";
  volEl.classList.toggle("muted", !!vol.muted);
  $("vol-label").textContent = vol.muted ? "MUTED" : "VOLUME";
  $("mute").classList.toggle("active", !!vol.muted);
  $("mute-waves").style.display = vol.muted ? "none" : "";
  $("mute-cross").style.display = vol.muted ? "" : "none";
  const slider = $("vol-slider");
  slider.min = vol.min ?? 0;
  slider.max = vol.max ?? 100;
  if (!sliderBusy && vol.value != null) slider.value = vol.value;

  renderSources();
  renderNowPlaying();
  renderAudio();
}

function renderSources() {
  const wrap = $("sources");
  wrap.innerHTML = "";
  const current = ((state.nowPlaying || {}).source || "").toUpperCase();
  for (const s of state.sources || []) {
    const btn = document.createElement("button");
    btn.className = "pill";
    btn.textContent = s.displayName || s.sourceName;
    const key = (s.sourceAccountName || s.sourceName || "").toUpperCase();
    if (current && (current === key || current === (s.sourceName || "").toUpperCase())) {
      btn.classList.add("active");
    }
    btn.onclick = () =>
      post("/api/source", {
        source: s.sourceName,
        sourceAccount: s.sourceAccountName || "",
      });
    wrap.appendChild(btn);
  }
}

function renderNowPlaying() {
  const np = state.nowPlaying || {};
  $("np-track").textContent = np.trackName || (np.source ? String(np.source) : "—");
  $("np-artist").textContent = [np.artist, np.album].filter(Boolean).join(" — ");
  const playing = np.playStatus === "PLAY";
  $("icon-play").style.display = playing ? "none" : "";
  $("icon-pause").style.display = playing ? "" : "none";
}

function renderAudio() {
  // dialogue / normal mode pills
  const modes = $("audio-modes");
  modes.innerHTML = "";
  const am = state.audioMode || {};
  for (const mode of am.supported || []) {
    const btn = document.createElement("button");
    btn.className = "pill" + (mode === am.value ? " active" : "");
    btn.textContent = mode;
    btn.onclick = () => post("/api/audio/mode", { mode });
    modes.appendChild(btn);
  }

  // EQ sliders - build once, then only sync values
  const eq = $("eq");
  const audio = state.audio || {};
  for (const [opt, cfg] of Object.entries(audio)) {
    let row = document.getElementById(`eq-${opt}`);
    if (!row) {
      row = document.createElement("div");
      row.className = "eq-row";
      row.id = `eq-${opt}`;
      row.innerHTML = `
        <div class="eq-head">
          <span>${opt.replace(/([A-Z])/g, " $1")}</span>
          <span class="eq-value"></span>
        </div>
        <input class="slider" type="range">`;
      const input = row.querySelector("input");
      input.min = cfg.min;
      input.max = cfg.max;
      input.step = cfg.step || 1;
      input.addEventListener("input", () => {
        eqBusy[opt] = true;
        row.querySelector(".eq-value").textContent = input.value;
      });
      input.addEventListener("change", () => {
        eqBusy[opt] = false;
        post("/api/audio", { option: opt, value: parseInt(input.value, 10) });
      });
      eq.appendChild(row);
    }
    if (!eqBusy[opt]) {
      row.querySelector("input").value = cfg.value ?? 0;
      row.querySelector(".eq-value").textContent = cfg.value ?? "–";
    }
  }
}

// ----------------------------------------------------------------- wiring

$("vol-up").onclick = () => post("/api/volume/up");
$("vol-down").onclick = () => post("/api/volume/down");
$("mute").onclick = () => post("/api/volume/mute");
$("power").onclick = () => post("/api/power/toggle");
$("prev").onclick = () => post("/api/previous");
$("next").onclick = () => post("/api/next");
$("play-pause").onclick = () => {
  const playing = (state?.nowPlaying || {}).playStatus === "PLAY";
  post(playing ? "/api/pause" : "/api/play");
};

const volSlider = $("vol-slider");
volSlider.addEventListener("input", () => {
  sliderBusy = true;
  $("vol-value").textContent = volSlider.value;
});
volSlider.addEventListener("change", () => {
  sliderBusy = false;
  post("/api/volume", { level: parseInt(volSlider.value, 10) });
});

// ------------------------------------------------------------ live updates

function connectEvents() {
  const es = new EventSource("/api/events");
  es.onmessage = (ev) => {
    state = JSON.parse(ev.data);
    render();
  };
  es.onerror = () => {
    es.close();
    $("status-dot").classList.remove("on");
    $("status-text").textContent = "reconnecting";
    setTimeout(connectEvents, 2000);
  };
}

fetch("/api/state")
  .then((r) => r.json())
  .then((s) => {
    state = s;
    render();
    connectEvents();
  })
  .catch(() => {
    showError("server unreachable");
    setTimeout(() => location.reload(), 4000);
  });
