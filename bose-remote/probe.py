#!/usr/bin/env python3
"""Hardware sanity check: find the soundbar, connect, read a few things.

Run this once after filling in .env to confirm pybose can talk to your
Soundbar 600 (the 600 isn't on pybose's officially-tested list, but it runs
the same Bose Music platform as the tested 700/900/Ultra).

    ./run.sh            # not needed first - probe is standalone
    .venv/bin/python probe.py

Expected output ends with "PROBE OK". If it fails, the error usually points
at one of: wrong credentials, soundbar not on this network, or discovery
blocked (set BOSE_HOST in .env to the soundbar's IP and retry).
"""

import asyncio
import json
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

from app.bose import BoseManager  # noqa: E402


async def main() -> int:
    manager = BoseManager(data_dir=Path(__file__).parent / "data")
    if manager.mock:
        print("note: MOCK=1 is set - probing the fake speaker, not hardware")

    print("authenticating with Bose and connecting to the soundbar...")
    await manager.start()
    if manager.state.get("error"):
        print(f"\nPROBE FAILED: {manager.state['error']}")
        return 1

    s = manager.state
    print(f"\n  device      : {s['device'].get('name')} ({s['device'].get('productName')})")
    print(f"  firmware    : {s['device'].get('softwareVersion')}")
    print(f"  power       : {s['power']}")
    print(f"  volume      : {s['volume'].get('value')} (muted={s['volume'].get('muted')})")
    print(f"  sources     : {[src['displayName'] for src in s['sources']]}")
    print(f"  audio modes : {s['audioMode'].get('supported', [])}")
    print(f"  eq options  : {list(s['audio'].keys())}")

    print("\nnudging volume up and back down to prove control works...")
    before = s["volume"].get("value")
    await manager.volume_step(+1)
    await asyncio.sleep(1)
    await manager.set_volume(before)
    print(f"volume returned to {before}")

    await manager.stop()
    print("\nPROBE OK - start the server with ./run.sh")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(asyncio.run(main()))
    except KeyboardInterrupt:
        sys.exit(130)
    except Exception as e:
        print(f"\nPROBE FAILED: {e}")
        print(json.dumps({"hint": "set BOSE_HOST in .env if discovery is the problem"}))
        sys.exit(1)
