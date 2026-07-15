"""FastAPI app: JSON API + SSE event stream + the static remote UI.

Simple actions accept GET as well as POST so an iOS Shortcut is just a single
"Get contents of URL" action.
"""

import asyncio
import json
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

from .bose import BoseManager, SpeakerError  # noqa: E402  (needs env loaded)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

manager = BoseManager(data_dir=BASE_DIR / "data")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await manager.start()
    yield
    await manager.stop()


app = FastAPI(title="Soundbar Remote", lifespan=lifespan)


def _handle(coro):
    async def run():
        try:
            return await coro
        except SpeakerError as e:
            raise HTTPException(status_code=503, detail=str(e))
        except KeyError as e:
            raise HTTPException(status_code=400, detail=f"bad parameter: {e}")

    return run()


# ------------------------------------------------------------------- state

@app.get("/api/state")
async def get_state():
    return manager.state


@app.get("/api/events")
async def events():
    async def stream():
        q = manager.register_client()
        try:
            yield f"data: {json.dumps(manager.state)}\n\n"
            while True:
                try:
                    snapshot = await asyncio.wait_for(q.get(), timeout=25)
                    yield f"data: {snapshot}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            manager.unregister_client(q)

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ------------------------------------------------------------------ volume

class VolumeBody(BaseModel):
    level: int


@app.api_route("/api/volume/up", methods=["GET", "POST"])
async def volume_up():
    return await _handle(manager.volume_step(+1))


@app.api_route("/api/volume/down", methods=["GET", "POST"])
async def volume_down():
    return await _handle(manager.volume_step(-1))


@app.post("/api/volume")
async def volume_set(body: VolumeBody):
    return await _handle(manager.set_volume(body.level))


@app.api_route("/api/volume/mute", methods=["GET", "POST"])
async def volume_mute():
    return await _handle(manager.set_muted(None))


# ------------------------------------------------------------------- power

@app.api_route("/api/power/toggle", methods=["GET", "POST"])
async def power_toggle():
    return await _handle(manager.set_power(None))


@app.api_route("/api/power/on", methods=["GET", "POST"])
async def power_on():
    return await _handle(manager.set_power(True))


@app.api_route("/api/power/off", methods=["GET", "POST"])
async def power_off():
    return await _handle(manager.set_power(False))


# ---------------------------------------------------------------- playback

@app.api_route("/api/play", methods=["GET", "POST"])
async def play():
    return await _handle(manager.playback("play"))


@app.api_route("/api/pause", methods=["GET", "POST"])
async def pause():
    return await _handle(manager.playback("pause"))


@app.api_route("/api/next", methods=["GET", "POST"])
async def skip_next():
    return await _handle(manager.playback("next"))


@app.api_route("/api/previous", methods=["GET", "POST"])
async def skip_previous():
    return await _handle(manager.playback("previous"))


# ----------------------------------------------------------------- sources

class SourceBody(BaseModel):
    source: str
    sourceAccount: str = ""


@app.get("/api/sources")
async def get_sources():
    return {"sources": manager.state.get("sources", [])}


@app.post("/api/source")
async def set_source(body: SourceBody):
    return await _handle(manager.set_source(body.source, body.sourceAccount))


@app.api_route("/api/source/tv", methods=["GET", "POST"])
async def source_tv():
    return await _handle(manager.set_source("TV"))


# ------------------------------------------------------------------- audio

class AudioBody(BaseModel):
    option: str
    value: int


class AudioModeBody(BaseModel):
    mode: str


@app.get("/api/audio")
async def get_audio():
    return {"audio": manager.state.get("audio", {}),
            "audioMode": manager.state.get("audioMode", {})}


@app.post("/api/audio")
async def set_audio(body: AudioBody):
    return await _handle(manager.set_audio_setting(body.option, body.value))


@app.post("/api/audio/mode")
async def set_audio_mode(body: AudioModeBody):
    return await _handle(manager.set_audio_mode(body.mode))


@app.api_route("/api/refresh", methods=["GET", "POST"])
async def refresh():
    await manager.refresh_state()
    return manager.state


# ------------------------------------------------------------------ static

STATIC_DIR = BASE_DIR / "static"


@app.get("/")
async def index():
    return FileResponse(STATIC_DIR / "index.html")


app.mount("/", StaticFiles(directory=STATIC_DIR), name="static")


def run():
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=int(os.environ.get("PORT", "8787")),
        log_level="info",
    )


if __name__ == "__main__":
    run()
