"use client";

import { useEffect } from "react";

type AudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

function fireUtteranceEnd(utterance: SpeechSynthesisUtterance) {
  utterance.onend?.call(
    utterance,
    new Event("end") as unknown as SpeechSynthesisEvent,
  );
}

export function EngineeringVoiceProfile() {
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;

    const synthesis = window.speechSynthesis;
    const nativeSpeak = synthesis.speak;
    const nativeCancel = synthesis.cancel;
    let audioContext: AudioContext | null = null;
    let activeSource: AudioBufferSourceNode | null = null;
    let activeRequest: AbortController | null = null;
    let playbackGeneration = 0;

    const stopNeuralPlayback = () => {
      playbackGeneration += 1;
      activeRequest?.abort();
      activeRequest = null;

      if (activeSource) {
        activeSource.onended = null;
        try {
          activeSource.stop();
        } catch {
          // Already stopped.
        }
        activeSource.disconnect();
        activeSource = null;
      }
    };

    const speakWithSystemFallback = (utterance: SpeechSynthesisUtterance) => {
      // Fallback only: keep the native voice neutral instead of reshaping it
      // with a low pitch, which was the main source of the robotic sound.
      utterance.pitch = 1;
      utterance.rate = 0.98;
      utterance.volume = 1;
      nativeSpeak.call(synthesis, utterance);
    };

    const speakWithNeuralVoice = (utterance: SpeechSynthesisUtterance) => {
      stopNeuralPlayback();
      const generation = playbackGeneration;
      const AudioContextCtor = window.AudioContext
        || (window as AudioWindow).webkitAudioContext;

      if (!AudioContextCtor) {
        speakWithSystemFallback(utterance);
        return;
      }

      audioContext ??= new AudioContextCtor();
      // Resume synchronously from the user's click so iOS/Safari keeps audio
      // permission while the neural speech is being generated on the server.
      void audioContext.resume();

      const controller = new AbortController();
      activeRequest = controller;

      void (async () => {
        try {
          const response = await fetch("/api/assistant/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: utterance.text }),
            cache: "no-store",
            signal: controller.signal,
          });
          if (!response.ok) throw new Error("neural-voice-unavailable");

          const encodedAudio = await response.arrayBuffer();
          if (generation !== playbackGeneration) return;

          const context = audioContext;
          if (!context) throw new Error("audio-context-unavailable");
          await context.resume();
          const decoded = await context.decodeAudioData(encodedAudio.slice(0));
          if (generation !== playbackGeneration) return;

          const source = context.createBufferSource();
          source.buffer = decoded;
          source.connect(context.destination);
          activeSource = source;
          activeRequest = null;

          source.onended = () => {
            if (generation !== playbackGeneration) return;
            activeSource = null;
            fireUtteranceEnd(utterance);
          };
          source.start(0);
        } catch {
          if (controller.signal.aborted || generation !== playbackGeneration) return;
          activeRequest = null;
          speakWithSystemFallback(utterance);
        }
      })();
    };

    const speakWithEngineeringVoice = (utterance: SpeechSynthesisUtterance) => {
      const assistantIsOpen = Boolean(document.querySelector(".assistant-panel"));
      const isRussianAssistantSpeech = assistantIsOpen
        && /^ru(?:-|_)/i.test(utterance.lang || "");

      if (!isRussianAssistantSpeech) {
        nativeSpeak.call(synthesis, utterance);
        return;
      }

      speakWithNeuralVoice(utterance);
    };

    const cancelEngineeringVoice = () => {
      stopNeuralPlayback();
      nativeCancel.call(synthesis);
    };

    try {
      synthesis.speak = speakWithEngineeringVoice;
      synthesis.cancel = cancelEngineeringVoice;
    } catch {
      return;
    }

    return () => {
      stopNeuralPlayback();
      if (audioContext) void audioContext.close();
      if (synthesis.speak === speakWithEngineeringVoice) synthesis.speak = nativeSpeak;
      if (synthesis.cancel === cancelEngineeringVoice) synthesis.cancel = nativeCancel;
    };
  }, []);

  return null;
}
