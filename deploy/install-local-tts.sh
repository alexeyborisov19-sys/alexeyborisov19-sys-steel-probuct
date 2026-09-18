#!/usr/bin/env bash
set -euo pipefail

APP_USER="${1:-nodejs}"
APP_GROUP="$(id -gn "$APP_USER")"
TTS_ROOT="/var/lib/steelprodukt/tts"
PYTHON_DIR="$TTS_ROOT/python"
MODEL="$TTS_ROOT/ru_RU-dmitri-medium.onnx"
CONFIG="$MODEL.json"
MODEL_CARD="$TTS_ROOT/MODEL_CARD.ru_RU-dmitri-medium"
PIPER_LICENSE="$TTS_ROOT/PIPER-COPYING-GPL-3.0-or-later"
VERSION_FILE="$TTS_ROOT/runtime-version"
PIPER_VERSION="1.8.0"
VOICE_VERSION="v1.0.0"
EXPECTED_MODEL_SHA256="f073356ebc4bd0f80c5af58df2953a5988bd5bdab1eb38635ce960b071fbefcb"
VOICE_BASE="https://huggingface.co/rhasspy/piper-voices/resolve/$VOICE_VERSION/ru/ru_RU/dmitri/medium"
PIPER_LICENSE_URL="https://raw.githubusercontent.com/OHF-Voice/piper1-gpl/v$PIPER_VERSION/COPYING"

if [ "$(id -u)" -ne 0 ]; then
  echo "Local TTS installation must run as root."
  exit 1
fi

install -d -m 0700 -o "$APP_USER" -g "$APP_GROUP" "$TTS_ROOT"

runtime_signature="piper-tts=$PIPER_VERSION;voice=ru_RU-dmitri-medium@$VOICE_VERSION"
current_signature="$(cat "$VERSION_FILE" 2>/dev/null || true)"

if [ "$current_signature" != "$runtime_signature" ] || [ ! -d "$PYTHON_DIR/piper" ]; then
  temp_python="$(mktemp -d "$TTS_ROOT/python.XXXXXX")"
  trap 'rm -rf "${temp_python:-}" "${temp_model:-}" "${temp_config:-}" "${temp_card:-}" "${temp_license:-}"' EXIT
  python3 -m pip install \
    --disable-pip-version-check \
    --no-cache-dir \
    --target "$temp_python" \
    "piper-tts==$PIPER_VERSION"
  rm -rf "$PYTHON_DIR"
  mv "$temp_python" "$PYTHON_DIR"
  temp_python=""
fi

model_ok=false
if [ -f "$MODEL" ]; then
  actual_sha="$(sha256sum "$MODEL" | awk '{print $1}')"
  if [ "$actual_sha" = "$EXPECTED_MODEL_SHA256" ]; then
    model_ok=true
  fi
fi

if [ "$model_ok" != true ]; then
  temp_model="$(mktemp "$TTS_ROOT/model.XXXXXX")"
  curl -fsSL "$VOICE_BASE/ru_RU-dmitri-medium.onnx" -o "$temp_model"
  printf '%s  %s\n' "$EXPECTED_MODEL_SHA256" "$temp_model" | sha256sum -c -
  mv "$temp_model" "$MODEL"
  temp_model=""
fi

if [ ! -s "$CONFIG" ]; then
  temp_config="$(mktemp "$TTS_ROOT/config.XXXXXX")"
  curl -fsSL "$VOICE_BASE/ru_RU-dmitri-medium.onnx.json" -o "$temp_config"
  python3 -m json.tool "$temp_config" >/dev/null
  mv "$temp_config" "$CONFIG"
  temp_config=""
fi

if [ ! -s "$MODEL_CARD" ]; then
  temp_card="$(mktemp "$TTS_ROOT/card.XXXXXX")"
  curl -fsSL "$VOICE_BASE/MODEL_CARD" -o "$temp_card"
  mv "$temp_card" "$MODEL_CARD"
  temp_card=""
fi

if [ ! -s "$PIPER_LICENSE" ]; then
  temp_license="$(mktemp "$TTS_ROOT/license.XXXXXX")"
  curl -fsSL "$PIPER_LICENSE_URL" -o "$temp_license"
  mv "$temp_license" "$PIPER_LICENSE"
  temp_license=""
fi

printf '%s\n' "$runtime_signature" > "$VERSION_FILE"
chown -R "$APP_USER:$APP_GROUP" "$TTS_ROOT"
find "$TTS_ROOT" -type d -exec chmod 0700 {} +
find "$TTS_ROOT" -type f -exec chmod 0600 {} +

# Smoke-test the exact runtime after installation. No visitor text is used here.
test_wav="$(mktemp /tmp/steelprodukt-tts-check.XXXXXX.wav)"
trap 'rm -f "$test_wav"' EXIT
PYTHONPATH="$PYTHON_DIR" STEELPRODUKT_TTS_MODEL="$MODEL" \
  python3 "$(dirname "$0")/local-tts/synthesize.py" "$test_wav" \
  <<<'Проверка локального голоса.'
test -s "$test_wav"
rm -f "$test_wav"
trap - EXIT

echo "Local Piper TTS ready: $runtime_signature"
