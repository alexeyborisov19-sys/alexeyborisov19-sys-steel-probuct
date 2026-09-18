#!/usr/bin/env python3
"""Local-only neural speech synthesis for the public engineering assistant."""

from __future__ import annotations

import os
import sys
import wave
from pathlib import Path

from piper import PiperVoice, SynthesisConfig

DEFAULT_MODEL = "/var/lib/steelprodukt/tts/ru_RU-dmitri-medium.onnx"
MAX_INPUT_CHARS = 1400


def main() -> int:
    if len(sys.argv) != 2:
        return 2

    output_path = Path(sys.argv[1])
    model_path = Path(os.environ.get("STEELPRODUKT_TTS_MODEL", DEFAULT_MODEL))
    text = sys.stdin.read(MAX_INPUT_CHARS + 1).strip()

    if not text or len(text) > MAX_INPUT_CHARS:
        return 3
    if not model_path.is_file() or not model_path.with_suffix(model_path.suffix + ".json").is_file():
        return 4

    output_path.parent.mkdir(parents=True, exist_ok=True)
    voice = PiperVoice.load(str(model_path))
    synthesis = SynthesisConfig(
        # A slightly calmer pace works better for compact technical answers.
        length_scale=1.04,
        noise_scale=0.667,
        noise_w_scale=0.8,
        normalize_audio=True,
    )

    with wave.open(str(output_path), "wb") as wav_file:
        voice.synthesize_wav(text, wav_file, syn_config=synthesis)

    return 0 if output_path.is_file() and output_path.stat().st_size > 44 else 5


if __name__ == "__main__":
    raise SystemExit(main())
