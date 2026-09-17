"use client";

import { useEffect } from "react";

const preferredMaleVoiceHints = [
  "yuri",
  "юрий",
  "dmitry",
  "dmitri",
  "дмитрий",
  "maxim",
  "maksim",
  "максим",
  "pavel",
  "павел",
  "alexander",
  "aleksandr",
  "александр",
  "mikhail",
  "mihail",
  "михаил",
  "nikolai",
  "nikolay",
  "николай",
] as const;

const femaleVoiceHints = [
  "milena",
  "милена",
  "tatyana",
  "tatiana",
  "татьяна",
  "irina",
  "ирина",
  "katya",
  "katia",
  "катя",
  "alena",
  "alyona",
  "алёна",
  "алена",
] as const;

const qualityHints = ["natural", "premium", "enhanced", "online"] as const;

function normalizedVoiceName(voice: SpeechSynthesisVoice) {
  return `${voice.name} ${voice.voiceURI}`.toLocaleLowerCase("ru-RU");
}

function includesHint(name: string, hints: readonly string[]) {
  return hints.some((hint) => name.includes(hint));
}

function maleVoiceScore(voice: SpeechSynthesisVoice) {
  const name = normalizedVoiceName(voice);
  const maleIndex = preferredMaleVoiceHints.findIndex((hint) => name.includes(hint));
  if (maleIndex === -1) return Number.NEGATIVE_INFINITY;

  const qualityBonus = qualityHints.some((hint) => name.includes(hint)) ? 30 : 0;
  const russianLocaleBonus = /^ru(?:-|_)/i.test(voice.lang) ? 20 : 0;
  const localBonus = voice.localService ? 2 : 0;

  return 100 - maleIndex + qualityBonus + russianLocaleBonus + localBonus;
}

function selectEngineeringVoice(voices: SpeechSynthesisVoice[]) {
  const russianVoices = voices.filter((voice) => /^ru(?:-|_)/i.test(voice.lang));

  const namedMaleVoice = [...russianVoices]
    .map((voice) => ({ voice, score: maleVoiceScore(voice) }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((a, b) => b.score - a.score)[0]?.voice;

  if (namedMaleVoice) return namedMaleVoice;

  // The Web Speech API does not expose voice gender. If the platform does not
  // provide a recognisable Russian male voice, prefer a neutral Russian voice
  // rather than forcing a foreign-language male voice with poor pronunciation.
  return russianVoices.find((voice) => !includesHint(normalizedVoiceName(voice), femaleVoiceHints))
    ?? russianVoices[0]
    ?? null;
}

export function EngineeringVoiceProfile() {
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;

    const synthesis = window.speechSynthesis;
    const nativeSpeak = synthesis.speak;

    const speakWithEngineeringVoice = (utterance: SpeechSynthesisUtterance) => {
      const assistantIsOpen = Boolean(document.querySelector(".assistant-panel"));
      const isRussianAssistantSpeech = assistantIsOpen && /^ru(?:-|_)/i.test(utterance.lang || "");

      if (isRussianAssistantSpeech) {
        const preferredVoice = selectEngineeringVoice(synthesis.getVoices());
        if (preferredVoice) utterance.voice = preferredVoice;

        // Slightly lower pitch and a compact, calm pace keep the engineer voice
        // masculine and clear without making it sound artificially slowed down.
        utterance.pitch = 0.88;
        utterance.rate = 0.97;
        utterance.volume = 1;
      }

      nativeSpeak.call(synthesis, utterance);
    };

    try {
      synthesis.speak = speakWithEngineeringVoice;
    } catch {
      return;
    }

    return () => {
      if (synthesis.speak === speakWithEngineeringVoice) {
        synthesis.speak = nativeSpeak;
      }
    };
  }, []);

  return null;
}
