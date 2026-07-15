"""In-memory stand-in for pybose's BoseSpeaker.

Enabled with MOCK=1. Lets the UI and every API route run without a soundbar
(or Bose credentials) - used for development and automated verification, and
handy for previewing the app before wiring up the real device.
"""

import asyncio
from typing import Callable


class MockSpeaker:
    def __init__(self, on_notify: Callable[[dict], None]):
        self._on_notify = on_notify
        self._connected = False
        self._power = "ON"
        self._volume = {"value": 30, "muted": False, "min": 0, "max": 70}
        self._source = {"source": "PRODUCT", "sourceAccount": "TV"}
        self._play_status = "PLAY"
        self._audio = {
            "bass": {"value": 0, "properties": {"min": -100, "max": 100, "step": 10}},
            "treble": {"value": 20, "properties": {"min": -100, "max": 100, "step": 10}},
            "center": {"value": 0, "properties": {"min": -100, "max": 100, "step": 10}},
            "height": {"value": 50, "properties": {"min": -100, "max": 100, "step": 10}},
        }
        self._audio_mode = {
            "value": "normal",
            "properties": {"supportedValues": ["normal", "dialog"]},
        }

    async def connect(self):
        self._connected = True

    async def disconnect(self):
        self._connected = False

    def is_connected(self):
        return self._connected

    def attach_receiver(self, callback):
        self._on_notify = callback
        return 1

    async def subscribe(self, resources=None):
        return {}

    def has_capability(self, endpoint: str) -> bool:
        if endpoint == "/audio/mode":
            return True
        return endpoint.rsplit("/", 1)[-1] in self._audio

    def _notify(self, resource: str, body: dict):
        self._on_notify(
            {"header": {"msgtype": "NOTIFY", "resource": resource}, "body": body}
        )

    # --- getters -----------------------------------------------------------

    async def get_system_info(self):
        return {
            "name": "Living Room Soundbar (mock)",
            "productName": "Bose Smart Soundbar 600",
            "softwareVersion": "0.0-mock",
        }

    async def get_power_state(self):
        return {"power": self._power}

    async def get_audio_volume(self):
        return dict(self._volume)

    async def get_now_playing(self):
        return {
            "metadata": {"trackName": "Mock Track", "artist": "Mock Artist", "album": "Mock Album"},
            "state": {"status": self._play_status, "canPause": True,
                      "canSkipNext": True, "canSkipPrevious": True},
            "container": {"contentItem": {"source": self._source["source"],
                                          "sourceAccount": self._source["sourceAccount"]}},
            "source": {"sourceDisplayName": self._source["sourceAccount"] or self._source["source"]},
        }

    async def get_sources(self):
        return {
            "sources": [
                {"sourceName": "PRODUCT", "sourceAccountName": "TV",
                 "displayName": "TV", "status": "AVAILABLE", "visible": True},
                {"sourceName": "BLUETOOTH", "sourceAccountName": "",
                 "displayName": "Bluetooth", "status": "AVAILABLE", "visible": True},
                {"sourceName": "SPOTIFY", "sourceAccountName": "mockuser",
                 "displayName": "Spotify", "status": "AVAILABLE", "visible": True},
            ]
        }

    async def get_audio_mode(self):
        return dict(self._audio_mode)

    async def get_audio_setting(self, option: str):
        return dict(self._audio[option])

    # --- setters -----------------------------------------------------------

    async def set_audio_volume(self, volume: int):
        self._volume["value"] = volume
        self._notify("/audio/volume", dict(self._volume))
        return dict(self._volume)

    async def set_audio_volume_muted(self, muted: bool):
        self._volume["muted"] = muted
        self._notify("/audio/volume", dict(self._volume))
        return dict(self._volume)

    async def set_power_state(self, state: bool):
        self._power = "ON" if state else "OFF"
        self._notify("/system/power/control", {"power": self._power})

    async def play(self):
        self._play_status = "PLAY"
        return await self.get_now_playing()

    async def pause(self):
        self._play_status = "PAUSED"
        return await self.get_now_playing()

    async def skip_next(self):
        return await self.get_now_playing()

    async def skip_previous(self):
        return await self.get_now_playing()

    async def set_source(self, source: str, source_account: str):
        self._source = {"source": source, "sourceAccount": source_account}
        return await self.get_now_playing()

    async def switch_tv_source(self):
        return await self.set_source("PRODUCT", "TV")

    async def set_audio_setting(self, option: str, value: int):
        self._audio[option]["value"] = value
        self._notify(f"/audio/{option}", dict(self._audio[option]))
        return dict(self._audio[option])

    async def set_audio_mode(self, mode: str):
        self._audio_mode["value"] = mode
        self._notify("/audio/mode", dict(self._audio_mode))
        return True
