"""Connection manager between the web server and the soundbar.

Owns the pybose session: cloud auth (with on-disk token cache), device
discovery, one persistent websocket to the speaker, and a fan-out of state
changes to any number of SSE clients. All pybose cloud calls (requests-based,
blocking) run in a thread so the event loop stays free.
"""

import asyncio
import json
import logging
import os
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger("bose-remote")

VOLUME_STEP = int(os.environ.get("VOLUME_STEP", "5"))

# EQ options the Bose API exposes as /audio/<option>; only those the device
# reports in its capabilities are surfaced to the UI.
EQ_OPTIONS = ["bass", "treble", "center", "height", "subwooferGain", "avSync"]

SUBSCRIBE_RESOURCES = [
    "/audio/volume",
    "/system/power/control",
    "/content/nowPlaying",
    "/audio/mode",
    "/system/sources",
] + [f"/audio/{opt}" for opt in EQ_OPTIONS]


class SpeakerError(Exception):
    """Raised for user-visible failures (bad credentials, no device found)."""


class BoseManager:
    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.mock = os.environ.get("MOCK", "").lower() in ("1", "true", "yes")
        self.email = os.environ.get("BOSE_EMAIL", "")
        self.password = os.environ.get("BOSE_PASSWORD", "")
        self.host = os.environ.get("BOSE_HOST", "")
        self.guid = os.environ.get("BOSE_GUID", "")

        self._speaker = None
        self._auth = None
        self._clients: set[asyncio.Queue] = set()
        self._refresh_task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()

        self.state: dict[str, Any] = {
            "connected": False,
            "mock": self.mock,
            "device": {},
            "power": None,
            "volume": {},
            "nowPlaying": {},
            "sources": [],
            "audioMode": {},
            "audio": {},  # option -> {value, min, max, step}
            "error": None,
        }

    # ---------------------------------------------------------------- startup

    async def start(self) -> None:
        if self.mock:
            from .mock import MockSpeaker

            self._speaker = MockSpeaker(on_notify=self._on_message_threadsafe)
            await self._speaker.connect()
            logger.info("running in MOCK mode - no hardware involved")
        else:
            try:
                await self._connect_real()
            except Exception as e:  # keep serving the UI; it shows the error
                logger.exception("could not connect to soundbar")
                self.state["error"] = str(e)
                return
        await self.refresh_state()
        self._refresh_task = asyncio.create_task(self._token_refresh_loop())

    async def _connect_real(self) -> None:
        from pybose import BoseAuth, BoseDiscovery, BoseSpeaker

        if not self.email or not self.password:
            raise SpeakerError(
                "BOSE_EMAIL / BOSE_PASSWORD not set - copy .env.example to .env "
                "and fill in your Bose app login"
            )

        self._auth = BoseAuth()
        token_file = self.data_dir / "token.json"

        def obtain_token():
            if token_file.exists():
                cached = json.loads(token_file.read_text())
                self._auth.set_access_token(
                    cached["access_token"],
                    cached["refresh_token"],
                    cached["bose_person_id"],
                )
                if self._auth.is_token_valid():
                    return cached
                try:
                    fresh = self._auth.do_token_refresh()
                    if fresh:
                        return fresh
                except Exception:
                    logger.info("token refresh failed, doing full login")
            return self._auth.getControlToken(self.email, self.password, forceNew=True)

        token = await asyncio.to_thread(obtain_token)
        if not token or not token.get("access_token"):
            raise SpeakerError("Bose login failed - check BOSE_EMAIL / BOSE_PASSWORD")
        token_file.write_text(json.dumps(token))

        if not self.host:
            devices = await asyncio.to_thread(
                lambda: BoseDiscovery().discover_devices(timeout=8)
            )
            if not devices:
                raise SpeakerError(
                    "no Bose device found on this network - set BOSE_HOST in .env "
                    "to the soundbar's IP address"
                )
            self.host = devices[0]["IP"]
            self.guid = self.guid or devices[0]["GUID"]
            logger.info("discovered soundbar at %s (GUID %s)", self.host, self.guid)

        self._speaker = BoseSpeaker(
            host=self.host,
            device_id=self.guid or None,
            bose_auth=self._auth,
            auto_reconnect=True,
            on_exception=lambda e: logger.error("speaker error: %s", e),
        )
        await self._speaker.connect()
        self._speaker.attach_receiver(self._on_message_threadsafe)
        await self._speaker.subscribe(SUBSCRIBE_RESOURCES)

    async def stop(self) -> None:
        if self._refresh_task:
            self._refresh_task.cancel()
        if self._speaker:
            try:
                await self._speaker.disconnect()
            except Exception:
                pass

    async def _token_refresh_loop(self) -> None:
        while True:
            await asyncio.sleep(30 * 60)
            if self.mock or not self._auth:
                continue
            try:
                if not await asyncio.to_thread(self._auth.is_token_valid):
                    token = await asyncio.to_thread(self._auth.do_token_refresh)
                    if token:
                        (self.data_dir / "token.json").write_text(json.dumps(token))
                        logger.info("refreshed Bose control token")
            except Exception as e:
                logger.error("token refresh failed: %s", e)

    # ------------------------------------------------------------------ state

    async def refresh_state(self) -> None:
        """Full hydrate of the state cache from the device."""
        sp = self._speaker
        if sp is None:
            return
        async with self._lock:
            try:
                info = await sp.get_system_info()
                self.state["device"] = {
                    "name": info.get("name") or info.get("defaultName"),
                    "productName": info.get("productName"),
                    "softwareVersion": info.get("softwareVersion"),
                }
                self.state["power"] = (await sp.get_power_state()).get("power")
                self._apply_volume(await sp.get_audio_volume())
                self.state["nowPlaying"] = self._trim_now_playing(
                    await sp.get_now_playing()
                )
                sources = (await sp.get_sources()).get("sources", [])
                self.state["sources"] = [
                    {
                        "sourceName": s.get("sourceName"),
                        "sourceAccountName": s.get("sourceAccountName"),
                        "displayName": s.get("displayName") or s.get("sourceName"),
                        "status": s.get("status"),
                    }
                    for s in sources
                    if s.get("visible")
                ]
                if sp.has_capability("/audio/mode"):
                    mode = await sp.get_audio_mode()
                    self.state["audioMode"] = {
                        "value": mode.get("value"),
                        "supported": (mode.get("properties") or {}).get(
                            "supportedValues", []
                        ),
                    }
                audio = {}
                for opt in EQ_OPTIONS:
                    if sp.has_capability(f"/audio/{opt}"):
                        setting = await sp.get_audio_setting(opt)
                        props = setting.get("properties") or {}
                        audio[opt] = {
                            "value": setting.get("value"),
                            "min": props.get("min", -100),
                            "max": props.get("max", 100),
                            "step": props.get("step", 10),
                        }
                self.state["audio"] = audio
                self.state["connected"] = sp.is_connected()
                self.state["error"] = None
            except Exception as e:
                logger.exception("state refresh failed")
                self.state["error"] = str(e)
        self._broadcast()

    def _apply_volume(self, vol: dict) -> None:
        self.state["volume"] = {
            "value": vol.get("value"),
            "muted": vol.get("muted"),
            "min": vol.get("min", 0),
            "max": vol.get("max", 100),
        }

    @staticmethod
    def _trim_now_playing(np: dict) -> dict:
        np = np or {}
        metadata = np.get("metadata") or {}
        state = np.get("state") or {}
        container = np.get("container") or {}
        content_item = container.get("contentItem") or {}
        source = np.get("source") or {}
        return {
            "trackName": metadata.get("trackName"),
            "artist": metadata.get("artist"),
            "album": metadata.get("album"),
            "playStatus": state.get("status"),
            "canPause": state.get("canPause"),
            "canSkipNext": state.get("canSkipNext"),
            "canSkipPrevious": state.get("canSkipPrevious"),
            "source": content_item.get("source") or source.get("sourceDisplayName"),
        }

    # --------------------------------------------------------- notifications

    def _on_message_threadsafe(self, message: dict) -> None:
        """Receiver callback from pybose (may fire from its websocket task)."""
        try:
            header = message.get("header") or {}
            if header.get("msgtype") != "NOTIFY":
                return
            resource = header.get("resource", "")
            body = message.get("body") or {}
            self._apply_notify(resource, body)
            self._broadcast()
        except Exception:
            logger.exception("failed to handle notify")

    def _apply_notify(self, resource: str, body: dict) -> None:
        if resource == "/audio/volume":
            self._apply_volume(body)
        elif resource == "/system/power/control":
            self.state["power"] = body.get("power")
        elif resource == "/content/nowPlaying":
            self.state["nowPlaying"] = self._trim_now_playing(body)
        elif resource == "/audio/mode":
            self.state["audioMode"] = {
                "value": body.get("value"),
                "supported": (body.get("properties") or {}).get(
                    "supportedValues", self.state["audioMode"].get("supported", [])
                ),
            }
        elif resource.startswith("/audio/"):
            opt = resource.rsplit("/", 1)[-1]
            if opt in self.state["audio"]:
                self.state["audio"][opt]["value"] = body.get("value")

    # ------------------------------------------------------------ SSE fan-out

    def register_client(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=32)
        self._clients.add(q)
        return q

    def unregister_client(self, q: asyncio.Queue) -> None:
        self._clients.discard(q)

    def _broadcast(self) -> None:
        snapshot = json.dumps(self.state)
        for q in list(self._clients):
            try:
                q.put_nowait(snapshot)
            except asyncio.QueueFull:
                pass

    # ---------------------------------------------------------------- actions

    def _require_speaker(self):
        if self._speaker is None:
            raise SpeakerError(self.state.get("error") or "not connected to soundbar")
        return self._speaker

    async def set_volume(self, value: int) -> dict:
        sp = self._require_speaker()
        vol = self.state.get("volume") or {}
        value = max(vol.get("min", 0), min(vol.get("max", 100), int(value)))
        self._apply_volume(await sp.set_audio_volume(value))
        self._broadcast()
        return self.state["volume"]

    async def volume_step(self, direction: int) -> dict:
        current = (self.state.get("volume") or {}).get("value")
        if current is None:
            await self.refresh_state()
            current = (self.state.get("volume") or {}).get("value", 30)
        return await self.set_volume(current + direction * VOLUME_STEP)

    async def set_muted(self, muted: Optional[bool] = None) -> dict:
        sp = self._require_speaker()
        if muted is None:
            muted = not (self.state.get("volume") or {}).get("muted")
        self._apply_volume(await sp.set_audio_volume_muted(muted))
        self._broadcast()
        return self.state["volume"]

    async def set_power(self, on: Optional[bool] = None) -> dict:
        sp = self._require_speaker()
        if on is None:
            on = self.state.get("power") != "ON"
        await sp.set_power_state(on)
        self.state["power"] = "ON" if on else "OFF"
        self._broadcast()
        return {"power": self.state["power"]}

    async def playback(self, action: str) -> dict:
        sp = self._require_speaker()
        method = {
            "play": sp.play,
            "pause": sp.pause,
            "next": sp.skip_next,
            "previous": sp.skip_previous,
        }[action]
        np = await method()
        if np:
            self.state["nowPlaying"] = self._trim_now_playing(np)
            self._broadcast()
        return self.state["nowPlaying"]

    async def set_source(self, source: str, source_account: str = "") -> dict:
        sp = self._require_speaker()
        if source.upper() == "TV" and not source_account:
            np = await sp.switch_tv_source()
        else:
            np = await sp.set_source(source, source_account)
        if np:
            self.state["nowPlaying"] = self._trim_now_playing(np)
            self._broadcast()
        return self.state["nowPlaying"]

    async def set_audio_setting(self, option: str, value: int) -> dict:
        sp = self._require_speaker()
        if option not in self.state["audio"]:
            raise SpeakerError(f"audio option '{option}' not supported by this device")
        setting = await sp.set_audio_setting(option, int(value))
        if setting and "value" in setting:
            self.state["audio"][option]["value"] = setting["value"]
        else:
            self.state["audio"][option]["value"] = int(value)
        self._broadcast()
        return self.state["audio"][option]

    async def set_audio_mode(self, mode: str) -> dict:
        sp = self._require_speaker()
        supported = self.state.get("audioMode", {}).get("supported") or []
        if supported and mode not in supported:
            raise SpeakerError(f"audio mode '{mode}' not in {supported}")
        await sp.set_audio_mode(mode)
        self.state["audioMode"]["value"] = mode
        self._broadcast()
        return self.state["audioMode"]
