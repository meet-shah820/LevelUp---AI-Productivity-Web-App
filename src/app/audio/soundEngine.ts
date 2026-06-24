import { getMasterVolumeScalar } from "./soundPreferences";

export type SoundId =
	| "system_boot"
	| "ui_click"
	| "ui_confirm"
	| "notification"
	| "quest_complete"
	| "xp_gain"
	| "level_up"
	| "rank_up"
	| "achievement"
	| "all_quests"
	| "mission_accept"
	| "timer_start"
	| "timer_stop"
	| "penalty"
	| "error"
	| "arena_enter"
	| "tutorial_step"
	| "tutorial_focus"
	| "tutorial_challenge"
	| "tutorial_milestone"
	| "tutorial_complete"
	| "tutorial_skip";

type ToneOpts = {
	freq: number;
	type?: OscillatorType;
	start?: number;
	duration?: number;
	attack?: number;
	decay?: number;
	volume?: number;
	detune?: number;
	pan?: number;
};

let audioCtx: AudioContext | null = null;
let unlocked = false;

const PRIORITY: Record<SoundId, number> = {
	rank_up: 100,
	arena_enter: 95,
	tutorial_complete: 88,
	tutorial_milestone: 72,
	tutorial_challenge: 58,
	tutorial_focus: 52,
	tutorial_step: 48,
	level_up: 90,
	all_quests: 85,
	achievement: 80,
	quest_complete: 70,
	mission_accept: 65,
	penalty: 60,
	notification: 55,
	xp_gain: 50,
	timer_start: 40,
	timer_stop: 35,
	system_boot: 30,
	ui_confirm: 20,
	ui_click: 10,
	error: 15,
};

let lastPlayedAt = 0;
let lastPriority = 0;

function ensureContext(): AudioContext | null {
	if (typeof window === "undefined") return null;
	if (!audioCtx) {
		const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
		if (!Ctx) return null;
		audioCtx = new Ctx();
	}
	return audioCtx;
}

export function unlockAudioContext(): void {
	const ctx = ensureContext();
	if (!ctx || unlocked) return;
	if (ctx.state === "suspended") {
		void ctx.resume();
	}
	unlocked = true;
}

function scheduleTone(ctx: AudioContext, dest: AudioNode, opts: ToneOpts) {
	const {
		freq,
		type = "sine",
		start = 0,
		duration = 0.18,
		attack = 0.008,
		decay = 0.14,
		volume = 0.35,
		detune = 0,
		pan = 0,
	} = opts;

	const t0 = ctx.currentTime + start;
	const osc = ctx.createOscillator();
	const gain = ctx.createGain();
	const panner = ctx.createStereoPanner();

	osc.type = type;
	osc.frequency.setValueAtTime(freq, t0);
	if (detune) osc.detune.setValueAtTime(detune, t0);

	gain.gain.setValueAtTime(0.0001, t0);
	gain.gain.linearRampToValueAtTime(Math.max(0.0001, volume), t0 + attack);
	gain.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);

	osc.connect(gain);
	gain.connect(panner);
	panner.pan.setValueAtTime(pan, t0);
	panner.connect(dest);

	osc.start(t0);
	osc.stop(t0 + duration);
}

function scheduleNoiseBurst(ctx: AudioContext, dest: AudioNode, start: number, duration: number, volume: number) {
	const t0 = ctx.currentTime + start;
	const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
	const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
	const data = buffer.getChannelData(0);
	for (let i = 0; i < bufferSize; i++) {
		data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
	}
	const src = ctx.createBufferSource();
	src.buffer = buffer;
	const filter = ctx.createBiquadFilter();
	filter.type = "bandpass";
	filter.frequency.value = 1200;
	filter.Q.value = 0.8;
	const gain = ctx.createGain();
	gain.gain.setValueAtTime(volume, t0);
	gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
	src.connect(filter);
	filter.connect(gain);
	gain.connect(dest);
	src.start(t0);
	src.stop(t0 + duration);
}

function scheduleSweep(
	ctx: AudioContext,
	dest: AudioNode,
	opts: {
		startFreq: number;
		endFreq: number;
		start?: number;
		duration?: number;
		type?: OscillatorType;
		volume?: number;
		pan?: number;
	},
) {
	const { startFreq, endFreq, start = 0, duration = 0.4, type = "sawtooth", volume = 0.3, pan = 0 } = opts;
	const t0 = ctx.currentTime + start;
	const osc = ctx.createOscillator();
	const gain = ctx.createGain();
	const panner = ctx.createStereoPanner();
	osc.type = type;
	osc.frequency.setValueAtTime(Math.max(1, startFreq), t0);
	osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t0 + duration);
	gain.gain.setValueAtTime(0.0001, t0);
	gain.gain.linearRampToValueAtTime(volume, t0 + 0.025);
	gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
	osc.connect(gain);
	gain.connect(panner);
	panner.pan.setValueAtTime(pan, t0);
	panner.connect(dest);
	osc.start(t0);
	osc.stop(t0 + duration + 0.05);
}

function scheduleNoiseSweep(
	ctx: AudioContext,
	dest: AudioNode,
	start: number,
	duration: number,
	volume: number,
	freqStart: number,
	freqEnd: number,
) {
	const t0 = ctx.currentTime + start;
	const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
	const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
	const data = buffer.getChannelData(0);
	for (let i = 0; i < bufferSize; i++) {
		const env = 1 - i / bufferSize;
		data[i] = (Math.random() * 2 - 1) * env * env;
	}
	const src = ctx.createBufferSource();
	src.buffer = buffer;
	const filter = ctx.createBiquadFilter();
	filter.type = "bandpass";
	filter.Q.value = 1.2;
	filter.frequency.setValueAtTime(freqStart, t0);
	filter.frequency.exponentialRampToValueAtTime(Math.max(80, freqEnd), t0 + duration);
	const gain = ctx.createGain();
	gain.gain.setValueAtTime(volume, t0);
	gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
	src.connect(filter);
	filter.connect(gain);
	gain.connect(dest);
	src.start(t0);
	src.stop(t0 + duration + 0.05);
}

function systemChime(ctx: AudioContext, dest: AudioNode, baseVol: number) {
	scheduleTone(ctx, dest, { freq: 880, type: "sine", start: 0, volume: baseVol * 0.55, decay: 0.22, pan: -0.15 });
	scheduleTone(ctx, dest, { freq: 1320, type: "triangle", start: 0.04, volume: baseVol * 0.4, decay: 0.18, pan: 0.2 });
	scheduleTone(ctx, dest, { freq: 220, type: "sine", start: 0, volume: baseVol * 0.35, decay: 0.28, pan: 0 });
}

const RECIPES: Record<SoundId, (ctx: AudioContext, dest: AudioNode, vol: number) => void> = {
	system_boot(ctx, dest, vol) {
		scheduleTone(ctx, dest, { freq: 55, type: "sine", start: 0, volume: vol * 0.5, attack: 0.02, decay: 0.45, duration: 0.55 });
		scheduleTone(ctx, dest, { freq: 110, type: "triangle", start: 0.08, volume: vol * 0.35, decay: 0.35, duration: 0.45 });
		[440, 554, 659, 880].forEach((f, i) => {
			scheduleTone(ctx, dest, {
				freq: f,
				type: "sine",
				start: 0.18 + i * 0.07,
				volume: vol * (0.28 - i * 0.04),
				decay: 0.2,
				pan: i % 2 === 0 ? -0.25 : 0.25,
			});
		});
		scheduleNoiseBurst(ctx, dest, 0.12, 0.08, vol * 0.08);
	},

	ui_click(ctx, dest, vol) {
		scheduleTone(ctx, dest, { freq: 1400, type: "square", start: 0, volume: vol * 0.12, attack: 0.002, decay: 0.04, duration: 0.06 });
		scheduleTone(ctx, dest, { freq: 280, type: "sine", start: 0, volume: vol * 0.08, attack: 0.002, decay: 0.05, duration: 0.07 });
	},

	ui_confirm(ctx, dest, vol) {
		scheduleTone(ctx, dest, { freq: 523, type: "sine", start: 0, volume: vol * 0.3, decay: 0.12 });
		scheduleTone(ctx, dest, { freq: 784, type: "triangle", start: 0.06, volume: vol * 0.28, decay: 0.14, pan: 0.2 });
	},

	notification(ctx, dest, vol) {
		systemChime(ctx, dest, vol);
		scheduleTone(ctx, dest, { freq: 1760, type: "sine", start: 0.1, volume: vol * 0.22, decay: 0.16, pan: 0.35 });
	},

	quest_complete(ctx, dest, vol) {
		scheduleTone(ctx, dest, { freq: 392, type: "sine", start: 0, volume: vol * 0.42, decay: 0.2 });
		scheduleTone(ctx, dest, { freq: 523, type: "triangle", start: 0.07, volume: vol * 0.38, decay: 0.22, pan: 0.15 });
		scheduleTone(ctx, dest, { freq: 659, type: "sine", start: 0.14, volume: vol * 0.34, decay: 0.24, pan: -0.1 });
		scheduleTone(ctx, dest, { freq: 98, type: "sine", start: 0, volume: vol * 0.28, decay: 0.3 });
		scheduleNoiseBurst(ctx, dest, 0.05, 0.06, vol * 0.06);
	},

	xp_gain(ctx, dest, vol) {
		scheduleTone(ctx, dest, { freq: 1047, type: "sine", start: 0, volume: vol * 0.25, attack: 0.003, decay: 0.1, duration: 0.14 });
		scheduleTone(ctx, dest, { freq: 1319, type: "triangle", start: 0.03, volume: vol * 0.18, decay: 0.08, duration: 0.12, pan: 0.3 });
	},

	level_up(ctx, dest, vol) {
		const notes = [262, 330, 392, 523, 659, 784, 1047];
		notes.forEach((f, i) => {
			scheduleTone(ctx, dest, {
				freq: f,
				type: i < 3 ? "sine" : "triangle",
				start: i * 0.09,
				volume: vol * (0.32 + i * 0.03),
				decay: 0.22,
				duration: 0.35,
				pan: i % 2 === 0 ? -0.3 : 0.3,
			});
		});
		scheduleTone(ctx, dest, { freq: 65, type: "sine", start: 0, volume: vol * 0.45, attack: 0.03, decay: 0.7, duration: 0.85 });
		scheduleNoiseBurst(ctx, dest, 0.2, 0.12, vol * 0.1);
	},

	rank_up(ctx, dest, vol) {
		scheduleTone(ctx, dest, { freq: 41, type: "sine", start: 0, volume: vol * 0.55, attack: 0.04, decay: 0.9, duration: 1.05 });
		[196, 247, 294, 370, 440, 554, 659, 880, 1047].forEach((f, i) => {
			scheduleTone(ctx, dest, {
				freq: f,
				type: i > 5 ? "triangle" : "sine",
				start: 0.12 + i * 0.08,
				volume: vol * (0.28 + i * 0.025),
				decay: 0.28,
				duration: 0.45,
				pan: (i % 3 - 1) * 0.35,
			});
		});
		scheduleNoiseBurst(ctx, dest, 0.35, 0.18, vol * 0.12);
	},

	achievement(ctx, dest, vol) {
		[523, 659, 784, 988, 1175].forEach((f, i) => {
			scheduleTone(ctx, dest, {
				freq: f,
				type: "triangle",
				start: i * 0.07,
				volume: vol * (0.35 - i * 0.03),
				decay: 0.3,
				duration: 0.4,
				pan: i % 2 === 0 ? -0.4 : 0.4,
			});
		});
		scheduleTone(ctx, dest, { freq: 147, type: "sine", start: 0, volume: vol * 0.4, decay: 0.55, duration: 0.7 });
	},

	all_quests(ctx, dest, vol) {
		[330, 392, 440, 523, 659, 784, 880, 1047, 1319].forEach((f, i) => {
			scheduleTone(ctx, dest, {
				freq: f,
				type: i % 2 === 0 ? "sine" : "triangle",
				start: i * 0.1,
				volume: vol * 0.34,
				decay: 0.35,
				duration: 0.5,
				pan: (i % 4 - 1.5) * 0.25,
			});
		});
		scheduleTone(ctx, dest, { freq: 55, type: "sine", start: 0, volume: vol * 0.42, attack: 0.02, decay: 0.95, duration: 1.1 });
	},

	mission_accept(ctx, dest, vol) {
		scheduleTone(ctx, dest, { freq: 220, type: "sawtooth", start: 0, volume: vol * 0.12, attack: 0.01, decay: 0.15, duration: 0.2 });
		scheduleTone(ctx, dest, { freq: 440, type: "sine", start: 0.08, volume: vol * 0.32, decay: 0.2 });
		scheduleTone(ctx, dest, { freq: 554, type: "triangle", start: 0.16, volume: vol * 0.3, decay: 0.22, pan: 0.2 });
		scheduleTone(ctx, dest, { freq: 880, type: "sine", start: 0.24, volume: vol * 0.26, decay: 0.2, pan: -0.15 });
	},

	timer_start(ctx, dest, vol) {
		scheduleTone(ctx, dest, { freq: 660, type: "square", start: 0, volume: vol * 0.14, attack: 0.002, decay: 0.06, duration: 0.08 });
		scheduleTone(ctx, dest, { freq: 990, type: "sine", start: 0.05, volume: vol * 0.22, decay: 0.12 });
	},

	timer_stop(ctx, dest, vol) {
		scheduleTone(ctx, dest, { freq: 440, type: "sine", start: 0, volume: vol * 0.2, decay: 0.14 });
		scheduleTone(ctx, dest, { freq: 330, type: "triangle", start: 0.06, volume: vol * 0.16, decay: 0.12, pan: -0.2 });
	},

	penalty(ctx, dest, vol) {
		scheduleTone(ctx, dest, { freq: 180, type: "sawtooth", start: 0, volume: vol * 0.28, decay: 0.25, duration: 0.35 });
		scheduleTone(ctx, dest, { freq: 140, type: "square", start: 0.1, volume: vol * 0.22, decay: 0.3, duration: 0.4, pan: -0.3 });
		scheduleTone(ctx, dest, { freq: 90, type: "sine", start: 0.05, volume: vol * 0.35, decay: 0.4, duration: 0.5 });
	},

	error(ctx, dest, vol) {
		scheduleTone(ctx, dest, { freq: 120, type: "sawtooth", start: 0, volume: vol * 0.2, attack: 0.002, decay: 0.12, duration: 0.15 });
		scheduleTone(ctx, dest, { freq: 90, type: "square", start: 0.08, volume: vol * 0.18, attack: 0.002, decay: 0.1, duration: 0.13 });
	},

	arena_enter(ctx, dest, vol) {
		scheduleTone(ctx, dest, { freq: 36, type: "sine", start: 0, volume: vol * 0.55, attack: 0.08, decay: 0.85, duration: 1.05 });
		scheduleTone(ctx, dest, { freq: 72, type: "triangle", start: 0.05, volume: vol * 0.38, attack: 0.06, decay: 0.7, duration: 0.9 });
		scheduleNoiseSweep(ctx, dest, 0.1, 0.55, vol * 0.22, 180, 2400);
		scheduleSweep(ctx, dest, { startFreq: 90, endFreq: 520, start: 0.18, duration: 0.42, type: "sawtooth", volume: vol * 0.2, pan: -0.45 });
		scheduleSweep(ctx, dest, { startFreq: 140, endFreq: 780, start: 0.22, duration: 0.38, type: "square", volume: vol * 0.12, pan: 0.45 });
		[130.81, 164.81, 196, 261.63].forEach((f, i) => {
			scheduleTone(ctx, dest, {
				freq: f,
				type: i < 2 ? "sawtooth" : "triangle",
				start: 0.48 + i * 0.04,
				volume: vol * (0.38 - i * 0.05),
				attack: 0.006,
				decay: 0.45,
				duration: 0.55,
				pan: (i - 1.5) * 0.22,
			});
		});
		scheduleNoiseBurst(ctx, dest, 0.5, 0.35, vol * 0.14);
		[523, 659, 784, 988].forEach((f, i) => {
			scheduleTone(ctx, dest, {
				freq: f,
				type: "sine",
				start: 0.62 + i * 0.06,
				volume: vol * (0.3 - i * 0.04),
				decay: 0.28,
				duration: 0.4,
				pan: i % 2 === 0 ? -0.35 : 0.35,
			});
		});
		scheduleTone(ctx, dest, { freq: 1047, type: "triangle", start: 0.88, volume: vol * 0.28, decay: 0.35, duration: 0.5, pan: 0 });
	},

	tutorial_step(ctx, dest, vol) {
		scheduleNoiseSweep(ctx, dest, 0, 0.14, vol * 0.1, 400, 1800);
		scheduleTone(ctx, dest, { freq: 392, type: "sine", start: 0.04, volume: vol * 0.28, decay: 0.14, pan: -0.2 });
		scheduleTone(ctx, dest, { freq: 523, type: "triangle", start: 0.08, volume: vol * 0.24, decay: 0.12, pan: 0.2 });
	},

	tutorial_focus(ctx, dest, vol) {
		scheduleTone(ctx, dest, { freq: 880, type: "square", start: 0, volume: vol * 0.08, attack: 0.002, decay: 0.05, duration: 0.07 });
		scheduleTone(ctx, dest, { freq: 1175, type: "sine", start: 0.05, volume: vol * 0.26, decay: 0.16, pan: 0.15 });
		scheduleTone(ctx, dest, { freq: 147, type: "sine", start: 0, volume: vol * 0.22, decay: 0.22 });
		scheduleSweep(ctx, dest, { startFreq: 600, endFreq: 1200, start: 0.1, duration: 0.2, type: "triangle", volume: vol * 0.12, pan: -0.3 });
	},

	tutorial_challenge(ctx, dest, vol) {
		scheduleTone(ctx, dest, { freq: 110, type: "sine", start: 0, volume: vol * 0.32, attack: 0.02, decay: 0.28, duration: 0.35 });
		scheduleTone(ctx, dest, { freq: 220, type: "sawtooth", start: 0.06, volume: vol * 0.14, decay: 0.2, duration: 0.28 });
		[440, 554, 659].forEach((f, i) => {
			scheduleTone(ctx, dest, {
				freq: f,
				type: "triangle",
				start: 0.12 + i * 0.07,
				volume: vol * (0.26 - i * 0.04),
				decay: 0.18,
				pan: (i - 1) * 0.35,
			});
		});
	},

	tutorial_milestone(ctx, dest, vol) {
		scheduleTone(ctx, dest, { freq: 523, type: "sine", start: 0, volume: vol * 0.32, decay: 0.18 });
		scheduleTone(ctx, dest, { freq: 659, type: "triangle", start: 0.07, volume: vol * 0.28, decay: 0.2, pan: 0.25 });
		scheduleTone(ctx, dest, { freq: 784, type: "sine", start: 0.14, volume: vol * 0.24, decay: 0.22, pan: -0.2 });
		scheduleNoiseBurst(ctx, dest, 0.08, 0.08, vol * 0.08);
	},

	tutorial_complete(ctx, dest, vol) {
		scheduleTone(ctx, dest, { freq: 49, type: "sine", start: 0, volume: vol * 0.42, attack: 0.03, decay: 0.75, duration: 0.9 });
		[392, 494, 587, 698, 880, 1047].forEach((f, i) => {
			scheduleTone(ctx, dest, {
				freq: f,
				type: i < 3 ? "sine" : "triangle",
				start: 0.15 + i * 0.09,
				volume: vol * (0.3 + i * 0.02),
				decay: 0.32,
				duration: 0.45,
				pan: (i % 3 - 1) * 0.3,
			});
		});
		scheduleNoiseBurst(ctx, dest, 0.35, 0.25, vol * 0.1);
		scheduleTone(ctx, dest, { freq: 1319, type: "sine", start: 0.72, volume: vol * 0.3, decay: 0.4, duration: 0.55 });
	},

	tutorial_skip(ctx, dest, vol) {
		scheduleSweep(ctx, dest, { startFreq: 520, endFreq: 180, start: 0, duration: 0.35, type: "sine", volume: vol * 0.22, pan: 0 });
		scheduleTone(ctx, dest, { freq: 220, type: "triangle", start: 0.12, volume: vol * 0.16, decay: 0.2, pan: -0.2 });
	},
};

export function playSoundEffect(id: SoundId, volumeMul = 1): void {
	const master = getMasterVolumeScalar();
	if (master <= 0) return;

	const ctx = ensureContext();
	if (!ctx) return;

	if (ctx.state === "suspended") {
		void ctx.resume();
	}

	const priority = PRIORITY[id] ?? 0;
	const now = performance.now();
	if (now - lastPlayedAt < 90 && priority < lastPriority) {
		return;
	}
	lastPlayedAt = now;
	lastPriority = priority;

	const recipe = RECIPES[id];
	if (!recipe) return;

	const bus = ctx.createGain();
	bus.gain.value = master * volumeMul;
	bus.connect(ctx.destination);
	recipe(ctx, bus, 1);
}
