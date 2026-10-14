// Speech & Audio Beep notification utility for document scanning with selectable voice presets & Custom MP3 support

export type VoicePresetKey =
  | "PROVIDED_OFFICIAL_AUDIO"
  | "AMITABH_DEEP_BARITONE"
  | "HINDI_MALE"
  | "HINDI_FEMALE"
  | "BILINGUAL"
  | "FUTURISTIC_AI"
  | "CUSTOM_MP3";

export interface VoicePresetOption {
  key: VoicePresetKey;
  label: string;
  badge?: string;
  description: string;
  phrase: string;
  pitch: number;
  rate: number;
  preferGender: "male" | "female" | "any";
  isDeepBass?: boolean;
}

export const VOICE_PRESETS: VoicePresetOption[] = [
  {
    key: "PROVIDED_OFFICIAL_AUDIO",
    label: "Provided Audio Voice (Official Hindi)",
    badge: "Official Preference",
    description: "Authentic dialogue exactly as provided: 'आपके दस्तावेज़ों की सावधानी पूर्वक जांच की जा रही है। कृपया प्रतीक्षा करें।'",
    phrase: "आपके दस्तावेज़ों की सावधानी पूर्वक जांच की जा रही है। कृपया प्रतीक्षा करें।",
    pitch: 0.88,
    rate: 0.88,
    preferGender: "male",
    isDeepBass: false,
  },
  {
    key: "AMITABH_DEEP_BARITONE",
    label: "Amitabh Bachchan Style (Ultra-Deep Baritone)",
    badge: "Celebrity Deep Male",
    description: "Commanding, hard-hitting, low-pitched testosterone-rich male baritone voice.",
    phrase: "नमस्कार। आपका दस्तावेज़ स्कैन किया जा रहा है। पूरी सावधानी से जांच जारी है।",
    pitch: 0.48, // Ultra-low pitch for heavy, deep baritone acoustic resonance
    rate: 0.78, // Measured, deliberate cadence characteristic of Amitabh Bachchan
    preferGender: "male",
    isDeepBass: true,
  },
  {
    key: "HINDI_MALE",
    label: "Hindi Male Officer (Formal & Deep)",
    description: "Formal male revenue officer voice with authoritative tone.",
    phrase: "आपके दस्तावेज़ों की सावधानी पूर्वक जांच की जा रही है। कृपया प्रतीक्षा करें।",
    pitch: 0.75,
    rate: 0.85,
    preferGender: "male",
    isDeepBass: true,
  },
  {
    key: "HINDI_FEMALE",
    label: "Hindi Female Officer (Soft & Natural)",
    description: "Clear, warm female voice in natural Hindi pronunciation.",
    phrase: "आपके दस्तावेज़ों की सावधानी पूर्वक जांच की जा रही है। कृपया प्रतीक्षा करें।",
    pitch: 1.15,
    rate: 0.92,
    preferGender: "female",
  },
  {
    key: "BILINGUAL",
    label: "Bilingual Announcement (English + Hindi)",
    description: "Dual language notification for maximum clarity.",
    phrase: "Document scanning in progress. आपके दस्तावेज़ों की सावधानी पूर्वक जांच की जा रही है। कृपया प्रतीक्षा करें।",
    pitch: 0.95,
    rate: 0.92,
    preferGender: "any",
  },
  {
    key: "FUTURISTIC_AI",
    label: "Futuristic AI Voice (High-Tech)",
    description: "Slightly elevated pitch for an advanced optical scanner feel.",
    phrase: "Optical scan initialized. आपके दस्तावेज़ों की सावधानी पूर्वक जांच की जा रही है।",
    pitch: 1.25,
    rate: 1.05,
    preferGender: "female",
  },
  {
    key: "CUSTOM_MP3",
    label: "Custom Uploaded MP3 Voice",
    badge: "Your MP3 Audio",
    description: "Play your authentic recorded MP3 voice dialogue file directly on every scan.",
    phrase: "Custom MP3 Voice Audio File",
    pitch: 1.0,
    rate: 1.0,
    preferGender: "any",
    isDeepBass: false,
  },
];

const CUSTOM_MP3_STORAGE_KEY = "vision_vault_custom_mp3_audio";
const CUSTOM_MP3_NAME_KEY = "vision_vault_custom_mp3_filename";

// Standalone base64 WAV 2-tone crisp optical scan laser chime (880Hz + 1250Hz)
// Guarantees audio playback even if Web Audio oscillator is restricted by browser sandbox
const OPTICAL_BEEP_WAV_BASE64 =
  "data:audio/wav;base64,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";

let sharedAudioContext: AudioContext | null = null;

function getOrCreateAudioContext(): AudioContext | null {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!sharedAudioContext || sharedAudioContext.state === "closed") {
      sharedAudioContext = new AudioCtx();
    }
    if (sharedAudioContext.state === "suspended") {
      sharedAudioContext.resume().catch(() => {});
    }
    return sharedAudioContext;
  } catch {
    return null;
  }
}

// Ensure AudioContext is unlocked in every circumstance on any click, touch, or key interaction
if (typeof window !== "undefined") {
  const unlock = () => {
    const ctx = getOrCreateAudioContext();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
  };
  window.addEventListener("click", unlock, { passive: true });
  window.addEventListener("touchstart", unlock, { passive: true });
  window.addEventListener("keydown", unlock, { passive: true });
}

export function getCustomMp3Audio(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CUSTOM_MP3_STORAGE_KEY);
}

export function getCustomMp3Filename(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CUSTOM_MP3_NAME_KEY) || "custom-scan-voice.mp3";
}

export function setCustomMp3Audio(dataUrl: string | null, filename?: string) {
  if (typeof window === "undefined") return;
  if (!dataUrl) {
    localStorage.removeItem(CUSTOM_MP3_STORAGE_KEY);
    localStorage.removeItem(CUSTOM_MP3_NAME_KEY);
  } else {
    localStorage.setItem(CUSTOM_MP3_STORAGE_KEY, dataUrl);
    if (filename) localStorage.setItem(CUSTOM_MP3_NAME_KEY, filename);
  }
}

export function getSelectedVoicePreset(): VoicePresetKey {
  if (typeof window === "undefined") return "PROVIDED_OFFICIAL_AUDIO";
  const saved = localStorage.getItem("vision_vault_scan_voice_preset") as VoicePresetKey;
  if (saved && VOICE_PRESETS.some((p) => p.key === saved)) {
    return saved;
  }
  return "PROVIDED_OFFICIAL_AUDIO";
}

export function setSelectedVoicePreset(presetKey: VoicePresetKey) {
  if (typeof window === "undefined") return;
  localStorage.setItem("vision_vault_scan_voice_preset", presetKey);
}

let activeAudioElement: HTMLAudioElement | null = null;
let lastBeepTimestamp = 0;

/**
 * High-reliability Optical Laser Scanner Beep
 * Plays under EVERY circumstance:
 * 1. Web Audio API synthesized dual-tone laser chirp (880Hz -> 1320Hz)
 * 2. Instant HTML5 Audio fallback using embedded base64 WAV sound
 */
export function playOpticalScanBeep() {
  if (typeof window === "undefined") return;

  const nowMs = Date.now();
  if (nowMs - lastBeepTimestamp < 350) {
    return; // Prevent duplicate overlap within a third of a second
  }
  lastBeepTimestamp = nowMs;

  let webAudioFired = false;

  try {
    const ctx = getOrCreateAudioContext();
    if (ctx) {
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Dual-tone laser scanner acoustic frequency
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now); // Tone 1: A5 (880 Hz)
      osc.frequency.setValueAtTime(880, now + 0.07);
      osc.frequency.setValueAtTime(1250, now + 0.08); // Tone 2: Laser chirp (1250 Hz -> 1400 Hz)
      osc.frequency.exponentialRampToValueAtTime(1400, now + 0.20);

      // Volume envelope with clean decay
      gain.gain.setValueAtTime(0.32, now);
      gain.gain.setValueAtTime(0.32, now + 0.07);
      gain.gain.setValueAtTime(0.02, now + 0.075);
      gain.gain.setValueAtTime(0.35, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
      webAudioFired = true;
    }
  } catch (e) {
    console.warn("Web Audio primary beep error:", e);
  }

  // Backup fallback: Play embedded base64 WAV audio chime to ensure it actually beeps out in every possible circumstance!
  try {
    const fallbackAudio = new Audio(OPTICAL_BEEP_WAV_BASE64);
    fallbackAudio.volume = 0.85;
    const playPromise = fallbackAudio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch((err) => {
        // Silently caught if browser already played via Web Audio
        if (!webAudioFired) {
          console.warn("Fallback audio play error:", err);
        }
      });
    }
  } catch (e) {
    console.warn("Fallback WAV chime error:", e);
  }
}

let lastNotificationTime = 0;

/**
 * Plays document scan notification:
 * 1. Guarantees the optical laser scan beep plays in EVERY circumstance.
 * 2. Follows immediately with spoken voice dialogue (or custom MP3 audio).
 */
export function playScanSpeechNotification(customPresetKey?: VoicePresetKey) {
  if (typeof window === "undefined") return;

  const activeKey = customPresetKey || getSelectedVoicePreset();
  const isPreview = Boolean(customPresetKey);

  const nowMs = Date.now();
  if (!isPreview && nowMs - lastNotificationTime < 900) {
    return; // Prevent duplicate speech triggers within 900ms during automated state sync
  }
  lastNotificationTime = nowMs;

  // 1. ALWAYS play the optical scan beep first under every possible circumstance!
  playOpticalScanBeep();

  // 2. If custom MP3 is selected, play the uploaded audio file right after the beep
  if (activeKey === "CUSTOM_MP3") {
    const customData = getCustomMp3Audio();
    if (customData) {
      setTimeout(() => {
        try {
          if (activeAudioElement) {
            activeAudioElement.pause();
            activeAudioElement.currentTime = 0;
          }
          activeAudioElement = new Audio(customData);
          activeAudioElement.volume = 1.0;
          activeAudioElement.play().catch((err) => {
            console.warn("Failed to play custom MP3 audio:", err);
          });
        } catch (err) {
          console.warn("Custom MP3 playback error:", err);
        }
      }, 160);
      return;
    }
  }

  // 3. Spoken dialogue for standard presets (defaults to PROVIDED_OFFICIAL_AUDIO)
  const preset =
    VOICE_PRESETS.find((p) => p.key === activeKey) || VOICE_PRESETS[0];

  setTimeout(() => {
    try {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(preset.phrase);
        utterance.lang = "hi-IN";
        utterance.rate = preset.rate;
        utterance.pitch = preset.pitch;
        utterance.volume = 1.0;

        const voices = window.speechSynthesis.getVoices();

        let selectedVoice = voices.find((v) => {
          const name = v.name.toLowerCase();
          const lang = v.lang.toLowerCase();
          const matchesLang = lang.includes("hi") || lang.includes("hi-in") || lang.includes("hin");
          if (!matchesLang) return false;

          if (preset.preferGender === "male") {
            return (
              name.includes("male") ||
              name.includes("hemant") ||
              name.includes("ravi") ||
              name.includes("karan") ||
              name.includes("madhav") ||
              name.includes("david") ||
              name.includes("george")
            );
          } else if (preset.preferGender === "female") {
            return (
              name.includes("female") ||
              name.includes("veena") ||
              name.includes("kalpana") ||
              name.includes("zira") ||
              name.includes("google हिन्दी")
            );
          }
          return true;
        });

        // Fallback to any Hindi voice
        if (!selectedVoice) {
          selectedVoice = voices.find(
            (v) =>
              v.lang.toLowerCase().includes("hi") ||
              v.lang.toLowerCase().includes("hin") ||
              v.name.toLowerCase().includes("hindi")
          );
        }

        // Secondary fallback to Indian English or clear male voice
        if (!selectedVoice && preset.preferGender === "male") {
          selectedVoice = voices.find((v) => {
            const name = v.name.toLowerCase();
            const lang = v.lang.toLowerCase();
            return (
              (lang.includes("in") || lang.includes("en")) &&
              (name.includes("male") || name.includes("david") || name.includes("rishi"))
            );
          });
        }

        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }

        window.speechSynthesis.speak(utterance);
      }
    } catch (e) {
      console.warn("Speech synthesis error:", e);
    }
  }, 160);
}
