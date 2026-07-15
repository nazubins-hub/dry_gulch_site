# Soundbar 600 Remote

Control your Bose Smart Soundbar 600 from your iPhone: a black-and-white
home-screen app plus one-tap Shortcut buttons, powered by
[pybose](https://github.com/cavefire/pybose) (unofficial, local control).

How it works: a small Python server runs on your Mac and holds a persistent
local connection to the soundbar over your WiFi. Your iPhone talks to that
server — through a full remote web app you add to your home screen, or through
plain URLs that iOS Shortcuts can call for single-button controls.

**Features:** power, volume (+/− buttons, slider, mute), source switching
(TV / Bluetooth / streaming), play/pause/skip with now-playing info, dialogue
mode, and per-band EQ (bass, treble, center, height…) — whatever your device
reports it supports. The UI updates live, even when volume changes from the
TV remote or the Bose app.

---

## 1. Set up on the Mac

Requires Python 3.11+ (`python3 --version`; get it from python.org or
`brew install python` if needed).

```bash
cd bose-remote
cp .env.example .env
open -e .env          # fill in your Bose Music app email + password
./run.sh
```

`.env` (and the cached login token) never leave the Mac — both are gitignored.

Want to see the app before touching the real soundbar? `MOCK=1 ./run.sh`
serves the full UI against a fake device, no credentials needed.

### Check the soundbar responds

The Soundbar 600 isn't on pybose's officially-tested list (the 700/900/Ultra
are; the 600 runs the same platform), so verify once:

```bash
.venv/bin/python probe.py
```

You should see your device's name, volume, sources, etc., the volume nudge
up-and-back, and `PROBE OK`. If discovery fails, put the soundbar's IP in
`.env` as `BOSE_HOST` (find it in your router's client list, or in the Bose
app under soundbar settings → network) and give it a fixed/reserved IP in
your router so it doesn't change.

### Keep it running

```bash
./install-launchd.sh
```

This registers a launchd agent: the server starts at login, restarts if it
crashes, and logs to `data/server.log`. The Mac has to be awake — on a
desktop Mac, turn on **System Settings → Energy → Prevent automatic sleeping
when the display is off**.

## 2. Add the app to your iPhone

1. On the iPhone (same WiFi), open Safari and go to
   `http://<your-mac-name>.local:8787` — find the name in
   System Settings → General → Sharing → Local hostname (e.g. `http://studio.local:8787`).
2. Tap **Share → Add to Home Screen**.

You get a full-screen, black-and-white "Soundbar" app with its own icon.

## 3. One-tap Shortcut buttons (optional)

Every control is also a plain URL, so a Shortcut is a single action:

1. Shortcuts app → **+** → **Add Action** → **Get Contents of URL**.
2. Paste a URL from the table below (leave method GET).
3. Name it (e.g. "Vol +"), then **Add to Home Screen** — or bind it to the
   **Action Button** or **Back Tap** (Settings → Accessibility → Touch).

| Control | URL |
| --- | --- |
| Volume up | `http://<mac>.local:8787/api/volume/up` |
| Volume down | `http://<mac>.local:8787/api/volume/down` |
| Mute / unmute | `http://<mac>.local:8787/api/volume/mute` |
| Power toggle | `http://<mac>.local:8787/api/power/toggle` |
| Power on / off | `.../api/power/on` · `.../api/power/off` |
| Play / pause | `.../api/play` · `.../api/pause` |
| Next / previous track | `.../api/next` · `.../api/previous` |
| Switch to TV | `.../api/source/tv` |

Volume step per call is `VOLUME_STEP` in `.env` (default 5).

## API

`GET /api/state` returns everything (power, volume, now playing, sources,
EQ). `GET /api/events` is a server-sent-events stream of state snapshots.
Setters: `POST /api/volume {"level": 40}`, `POST /api/source
{"source": "BLUETOOTH", "sourceAccount": ""}`, `POST /api/audio
{"option": "bass", "value": 20}`, `POST /api/audio/mode {"mode": "dialog"}` —
plus the GET-friendly routes in the table above.

## Notes & troubleshooting

- **LAN only.** The server has no authentication — anyone on your WiFi can
  change the volume. Don't port-forward it to the internet.
- **"not connected" banner in the app**: check `data/server.log`. Usual
  causes: wrong Bose credentials, soundbar unplugged, or discovery failing
  (set `BOSE_HOST`).
- **Token expiry** is handled automatically (cached in `data/token.json`,
  refreshed in the background).
- pybose is an unofficial, reverse-engineered library — a Bose firmware
  update could break it. If something stops working, try
  `pip install -U pybose` in the venv (and adjust the pin in
  `requirements.txt`).
