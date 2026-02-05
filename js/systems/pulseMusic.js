// ============================================================================
// PULSE ADAPTIVE MUSIC SYSTEM - Generic, Data-Driven, Diegetic
// Automatically adapts to changes in ARENA_CONFIG, ENEMY_TYPES, BOSS_CONFIG
// ============================================================================

import { ARENA_CONFIG } from '../config/arenas.js';
import { ENEMY_TYPES } from '../config/enemies.js';
import { BOSS_CONFIG } from '../config/bosses.js';
import { DEBUG, STORAGE_PREFIX } from '../config/constants.js';
import { log } from './debugLog.js';

const MUSIC_ENABLED_KEY = STORAGE_PREFIX + 'music_enabled';
const MASTER_VOL_KEY = STORAGE_PREFIX + 'volume_master';
const MUSIC_VOL_KEY = STORAGE_PREFIX + 'volume_music';

export const PulseMusic = {
    // Audio context and nodes
    ctx: null,
    masterGain: null,
    musicBus: null,
    sfxBus: null,
    compressor: null,
    musicFilter: null,
    
    // State
    initialized: false,
    enabled: true,
    currentArenaId: null,
    currentProfile: null,
    activeOscillators: [],
    activeLayers: {},
    scheduledEvents: [],
    musicLoopId: null,
    
    // Timing
    bpm: 120,
    beatDuration: 0.5,
    barDuration: 2,
    lastBeat: 0,
    beatCount: 0,
    nextBarTime: 0,
    
    // Adaptive state
    intensity: 0,
    targetIntensity: 0,
    filterCutoff: 8000,
    targetFilterCutoff: 8000,
    harmonicTension: 0,
    bossPhase: 0,
    
    // Hysteresis
    lastLayerChange: 0,
    lastIntensityChange: 0,
    lastShieldHit: 0,
    lastIntensityBucket: null,
    lastBossPhaseLogged: 0,
    lastXpPickupTime: -999,

    // Volume (init-safe: stored even before audio context exists)
    desiredMasterVol: 0.6,
    desiredMusicVol: 0.5,

    _safeGetStorageItem(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            return null;
        }
    },

    _safeSetStorageItem(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            if (DEBUG) console.warn('[PulseMusic] Storage write failed (privacy mode?):', e.message);
            // ignore (privacy mode / disabled storage)
        }
    },
    
    // Helper: Check if system is ready (reduces duplication)
    _checkReady() {
        return this.enabled && this.initialized && this.currentProfile && this.ctx;
    },
    
    // Musical scales (intervals from root)
    SCALES: {
        dorian: [0, 2, 3, 5, 7, 9, 10],
        phrygian: [0, 1, 3, 5, 7, 8, 10],
        lydian: [0, 2, 4, 6, 7, 9, 11],
        mixolydian: [0, 2, 4, 5, 7, 9, 10],
        locrian: [0, 1, 3, 5, 6, 8, 10],
        minor: [0, 2, 3, 5, 7, 8, 10],
        major: [0, 2, 4, 5, 7, 9, 11],
        chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    },
    
    // Root notes (MIDI note numbers, octave 3)
    ROOTS: { 'C': 48, 'C#': 49, 'D': 50, 'D#': 51, 'E': 52, 'F': 53, 'F#': 54, 'G': 55, 'G#': 56, 'A': 57, 'A#': 58, 'B': 59 },
    
    // Leitmotif: The Pulse (relative intervals)
    LEITMOTIF: [0, 3, 5, 7],
    LEITMOTIF_RHYTHM: [1, 1, 1.5, 0.5],
    
    // Profile storage
    arenaProfiles: {},
    enemySfxProfiles: {},
    bossProfiles: {},
    
    // ============================================================================
    // INITIALIZATION
    // ============================================================================
    
    init() {
        if (this.initialized) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            
            // Master chain
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.6;
            
            this.compressor = this.ctx.createDynamicsCompressor();
            this.compressor.threshold.value = -24;
            this.compressor.knee.value = 30;
            this.compressor.ratio.value = 4;
            this.compressor.attack.value = 0.003;
            this.compressor.release.value = 0.25;
            
            // Music bus with filter - lowered from 0.7 to 0.5 for less harsh sound
            this.musicBus = this.ctx.createGain();
            this.musicBus.gain.value = 0.5;
            this.musicFilter = this.ctx.createBiquadFilter();
            this.musicFilter.type = 'lowpass';
            this.musicFilter.frequency.value = 8000;
            this.musicFilter.Q.value = 1;
            
            // SFX bus
            this.sfxBus = this.ctx.createGain();
            this.sfxBus.gain.value = 0.5;
            
            // Connect chain
            this.musicBus.connect(this.musicFilter);
            this.musicFilter.connect(this.masterGain);
            this.sfxBus.connect(this.masterGain);
            this.masterGain.connect(this.compressor);
            this.compressor.connect(this.ctx.destination);
            
            // Generate profiles from game config
            this.generateAllProfiles();

            // Load persisted settings (safe even if localStorage is unavailable)
            const savedEnabled = this._safeGetStorageItem(MUSIC_ENABLED_KEY);
            if (savedEnabled !== null) {
                try {
                    this.enabled = JSON.parse(savedEnabled);
                } catch (e) {
                    // ignore
                }
            }
            const savedMaster = this._safeGetStorageItem(MASTER_VOL_KEY);
            if (savedMaster !== null && !Number.isNaN(parseFloat(savedMaster))) {
                this.desiredMasterVol = Math.max(0, Math.min(1, parseFloat(savedMaster)));
            }
            const savedMusic = this._safeGetStorageItem(MUSIC_VOL_KEY);
            if (savedMusic !== null && !Number.isNaN(parseFloat(savedMusic))) {
                this.desiredMusicVol = Math.max(0, Math.min(1, parseFloat(savedMusic)));
            }

            this._applyVolumes();
            
            this.initialized = true;
            if (DEBUG) console.log('[PulseMusic] Initialized with', Object.keys(this.arenaProfiles).length, 'arena profiles');
        } catch (e) {
            console.warn('[PulseMusic] Web Audio not available:', e);
            this.enabled = false;
        }
    },
    
    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        this._applyVolumes();
    },

    _applyVolumes() {
        if (!this.ctx || !this.masterGain || !this.musicBus) return;

        const t = this.ctx.currentTime;
        const master = Math.max(0, Math.min(1, this.desiredMasterVol));
        const music = Math.max(0, Math.min(1, this.desiredMusicVol));

        // Smooth changes to avoid clicks
        this.masterGain.gain.setTargetAtTime(master, t, 0.02);
        this.musicBus.gain.setTargetAtTime(music, t, 0.02);
    },
    
    // ============================================================================
    // PROFILE GENERATION
    // ============================================================================
    
    generateAllProfiles() {
        const arenaIds = Object.keys(ARENA_CONFIG.arenas);
        arenaIds.forEach((id, index) => {
            this.arenaProfiles[id] = this.generateArenaProfile(parseInt(id), ARENA_CONFIG.arenas[id], index, arenaIds.length);
        });
        
        Object.keys(ENEMY_TYPES).forEach((typeName, index) => {
            this.enemySfxProfiles[typeName] = this.generateEnemySfxProfile(typeName, ENEMY_TYPES[typeName], index);
        });
        
        Object.keys(BOSS_CONFIG).forEach((id, index) => {
            this.bossProfiles[id] = this.generateBossProfile(parseInt(id), BOSS_CONFIG[id], index);
        });
    },
    
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    },
    
    generateArenaProfile(arenaId, arenaData, index, totalArenas) {
        const hash = this.hashString(arenaData.name + JSON.stringify(arenaData.features));
        const scaleKeys = Object.keys(this.SCALES);
        const rootKeys = Object.keys(this.ROOTS);
        
        const rootNote = rootKeys[hash % rootKeys.length];
        const scale = scaleKeys[(hash >> 4) % scaleKeys.length];
        const baseTempo = 115 + (index * 4) + (hash % 10);
        
        const r = (arenaData.color >> 16) & 0xFF;
        const g = (arenaData.color >> 8) & 0xFF;
        const b = arenaData.color & 0xFF;
        const brightness = (r + g + b) / 3;
        
        const hasVerticality = arenaData.features.includes('vertical');
        const hasTunnels = arenaData.features.includes('tunnels');
        const hasHazards = arenaData.features.includes('hazards');
        const complexity = arenaData.features.length;
        
        return {
            arenaId,
            name: arenaData.name,
            rootNote,
            rootMidi: this.ROOTS[rootNote],
            scale,
            scaleIntervals: this.SCALES[scale],
            baseTempo,
            tempoRange: [baseTempo - 3, baseTempo + 5],
            brightness: brightness / 255,
            warmth: r / 255,
            tension: hasHazards ? 0.8 : (hasTunnels ? 0.6 : 0.3),
            depth: hasVerticality ? 0.7 : 0.4,
            maxLayers: 3 + Math.floor(complexity / 2),
            layerThresholds: this.generateLayerThresholds(complexity),
            leitmotifOctave: hasVerticality ? 5 : 4,
            leitmotifSpeed: hasTunnels ? 0.8 : 1.0,
            baseFilterCutoff: 4000 + (brightness * 40),
            filterResonance: hasTunnels ? 3 : 1,
            profileHash: hash
        };
    },
    
    generateLayerThresholds(complexity) {
        const thresholds = [];
        const baseEnemies = 3;
        for (let i = 0; i <= complexity + 2; i++) {
            thresholds.push({
                layer: i,
                minEnemies: i * baseEnemies,
                maxEnemies: (i + 1) * baseEnemies + 2
            });
        }
        return thresholds;
    },
    
    generateEnemySfxProfile(typeName, enemyData, index) {
        const hash = this.hashString(typeName + enemyData.behavior);
        
        const behaviorRoles = {
            'chase': { role: 'rhythmic', pitchRange: [0, 4], rhythmDiv: 4 },
            'shooter': { role: 'melodic', pitchRange: [4, 8], rhythmDiv: 8 },
            'bouncer': { role: 'syncopation', pitchRange: [7, 11], rhythmDiv: 16 },
            'shieldBreaker': { role: 'accent', pitchRange: [0, 2], rhythmDiv: 2 },
            'waterBalloon': { role: 'pad', pitchRange: [0, 7], rhythmDiv: 1 },
            'teleporter': { role: 'glitch', pitchRange: [5, 11], rhythmDiv: 32 }
        };
        
        const roleData = behaviorRoles[enemyData.behavior] || behaviorRoles['chase'];
        const r = (enemyData.color >> 16) & 0xFF;
        const g = (enemyData.color >> 8) & 0xFF;
        const colorPitch = Math.floor((r + g) / 50);
        
        return {
            typeName,
            behavior: enemyData.behavior,
            role: roleData.role,
            pitchClass: (hash % 12),
            pitchRange: roleData.pitchRange,
            rhythmDivision: roleData.rhythmDiv,
            baseVolume: enemyData.damage > 15 ? 0.8 : 0.5,
            spatialWidth: enemyData.speed > 0.05 ? 0.8 : 0.4,
            waveform: enemyData.damageReduction ? 'square' : (enemyData.speed > 0.08 ? 'sawtooth' : 'triangle'),
            attack: enemyData.behavior === 'shieldBreaker' ? 0.01 : 0.05,
            release: enemyData.behavior === 'waterBalloon' ? 0.5 : 0.15,
            isElite: enemyData.spawnWeight < 10,
            colorPitchMod: colorPitch
        };
    },
    
    generateBossProfile(bossId, bossData, index) {
        const hash = this.hashString(bossData.name + bossData.ai);
        
        const aiCharacteristics = {
            'pillarGuardian': { intensity: 0.7, chaos: 0.3, melodic: true },
            'slimeQueen': { intensity: 0.6, chaos: 0.5, melodic: false },
            'teleportingTyrant': { intensity: 0.8, chaos: 0.7, melodic: true },
            'balloonKing': { intensity: 0.5, chaos: 0.4, melodic: false },
            'tunnelWyrm': { intensity: 0.9, chaos: 0.6, melodic: false },
            'chaosIncarnate': { intensity: 1.0, chaos: 1.0, melodic: true }
        };
        
        const aiData = aiCharacteristics[bossData.ai] || { intensity: 0.7, chaos: 0.5, melodic: true };
        
        return {
            bossId,
            name: bossData.name,
            ai: bossData.ai,
            baseIntensity: aiData.intensity,
            chaosLevel: aiData.chaos,
            useMelody: aiData.melodic,
            phases: {
                1: { tempoMod: 0, filterMod: 0, tensionMod: 0 },
                2: { tempoMod: 5, filterMod: 1000, tensionMod: 0.2 },
                3: { tempoMod: 10, filterMod: 2000, tensionMod: 0.4 }
            },
            bassBoost: 1 + (bossData.size / 4)
        };
    },
    
    // ============================================================================
    // ARENA LOADING
    // ============================================================================
    
    loadArena(arenaId) {
        const profile = this.arenaProfiles[arenaId];
        if (!profile) {
            console.warn('[PulseMusic] No profile for arena', arenaId);
            return;
        }
        
        this.currentArenaId = arenaId;
        this.currentProfile = profile;
        
        this.bpm = profile.baseTempo;
        this.beatDuration = 60 / this.bpm;
        this.barDuration = this.beatDuration * 4;
        
        if (this.musicFilter) {
            this.targetFilterCutoff = profile.baseFilterCutoff;
            this.musicFilter.Q.value = profile.filterResonance;
        }
        
        this.intensity = 0;
        this.targetIntensity = 0;
        this.bossPhase = 0;
        this.lastIntensityBucket = null;
        this.lastBossPhaseLogged = 0;
        
        if (DEBUG) console.log('[PulseMusic] Loaded arena', arenaId, '-', profile.name, '- Key:', profile.rootNote, profile.scale, '- BPM:', this.bpm);
    },
    
    // ============================================================================
    // MUSIC LOOP
    // ============================================================================
    
    startMusicLoop() {
        if (!this.enabled || !this.initialized || !this.ctx) return;
        
        this.stopMusicLoop();
        this.nextBarTime = this.ctx.currentTime + 0.1;
        this.musicLoopId = setInterval(() => this.musicTick(), 50);
        if (this.currentProfile) {
            log('MUSIC', 'loop_started', {
                arena: this.currentArenaId,
                profile: this.currentProfile.name,
                bpm: this.bpm
            });
        } else {
            log('MUSIC', 'loop_started', { arena: this.currentArenaId });
        }
        if (DEBUG) console.log('[PulseMusic] Music loop started');
    },
    
    stopMusicLoop() {
        if (this.musicLoopId) {
            clearInterval(this.musicLoopId);
            this.musicLoopId = null;
        }
    },
    
    pause() {
        this.stopMusicLoop();
        this.isPaused = true;
        // Stop all currently playing sounds for immediate silence
        this.activeOscillators.forEach(osc => {
            try { osc.stop(); } catch (e) {}
        });
        this.activeOscillators = [];
        // Suspend audio context for immediate silence
        if (this.ctx && this.ctx.state === 'running') {
            this.ctx.suspend();
        }
    },
    
    unpause() {
        if (this.isPaused && this.enabled && this.initialized) {
            this.isPaused = false;
            // Resume audio context first
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            this.startMusicLoop();
        }
    },
    
    stop() {
        this.stopMusicLoop();
        this.activeOscillators.forEach(osc => {
            try { osc.stop(); } catch (e) {}
        });
        this.activeOscillators = [];
    },
    
    musicTick() {
        if (!this.currentProfile || !this.ctx) return;
        
        const now = this.ctx.currentTime;
        
        if (now >= this.nextBarTime - 0.1) {
            this.scheduleBar(this.nextBarTime);
            this.nextBarTime += this.barDuration;
        }
        
        this.filterCutoff += (this.targetFilterCutoff - this.filterCutoff) * 0.05;
        this.musicFilter.frequency.setValueAtTime(this.filterCutoff, now);
        
        this.intensity += (this.targetIntensity - this.intensity) * 0.03;
        
        this.activeOscillators = this.activeOscillators.filter(osc => {
            try {
                return osc.context.currentTime < osc.endTime;
            } catch (e) {
                return false;
            }
        });
    },
    
    scheduleBar(barStartTime) {
        const profile = this.currentProfile;
        if (!profile) return;
        
        this.scheduleKickPattern(barStartTime, profile);
        
        if (this.intensity > 0.1) {
            this.scheduleBassline(barStartTime, profile);
        }
        
        if (this.intensity > 0.3) {
            this.scheduleChords(barStartTime, profile);
        }
        
        if (this.intensity > 0.5) {
            this.scheduleMelody(barStartTime, profile);
        }
        
        if (this.intensity > 0.7 || this.bossPhase > 0) {
            this.scheduleArpeggio(barStartTime, profile);
        }
        
        if (this.bossPhase > 0) {
            this.scheduleBossLayer(barStartTime, profile);
        }
    },
    
    // ============================================================================
    // MUSICAL ELEMENT GENERATORS
    // ============================================================================
    
    scheduleKickPattern(startTime, profile) {
        const kickTimes = [0, 1, 2, 3];
        kickTimes.forEach(beat => {
            const time = startTime + (beat * this.beatDuration);
            this.playDrum('kick', time, profile);
        });
        
        if (this.intensity > 0.2) {
            [1, 3].forEach(beat => {
                const time = startTime + (beat * this.beatDuration);
                this.playDrum('snare', time, profile);
            });
        }
        
        if (this.intensity > 0.4) {
            for (let i = 0; i < 8; i++) {
                const time = startTime + (i * this.beatDuration / 2);
                this.playDrum('hihat', time, profile, i % 2 === 0 ? 0.4 : 0.2);
            }
        }
    },
    
    scheduleBassline(startTime, profile) {
        const root = profile.rootMidi;
        const scale = profile.scaleIntervals;
        
        const bassNotes = [0, 0, 4, 4];
        bassNotes.forEach((degree, i) => {
            const time = startTime + (i * this.beatDuration);
            const note = root - 12 + scale[degree % scale.length];
            this.playBass(note, time, this.beatDuration * 0.9, profile);
        });
    },
    
    scheduleChords(startTime, profile) {
        const root = profile.rootMidi;
        const scale = profile.scaleIntervals;
        
        const chordDegrees = [0, 2, 4];
        const tension = this.harmonicTension;
        if (tension > 0.5) chordDegrees.push(6);
        
        const chordNotes = chordDegrees.map(d => root + scale[d % scale.length]);
        this.playChord(chordNotes, startTime, this.barDuration * 0.95, profile);
    },
    
    scheduleMelody(startTime, profile) {
        const root = profile.rootMidi + 12;
        const scale = profile.scaleIntervals;
        
        const variation = (this.beatCount / 4) % 4;
        const motif = [...this.LEITMOTIF];
        
        if (variation === 1) motif.reverse();
        if (variation === 2) motif[2] += 2;
        if (variation === 3) motif[0] += 5;
        
        let time = startTime;
        motif.forEach((interval, i) => {
            const duration = this.LEITMOTIF_RHYTHM[i] * this.beatDuration * profile.leitmotifSpeed;
            const scaleDegree = interval % scale.length;
            const note = root + scale[scaleDegree] + Math.floor(interval / scale.length) * 12;
            
            this.playLead(note, time, duration * 0.8, profile);
            time += duration;
        });
    },
    
    scheduleArpeggio(startTime, profile) {
        const root = profile.rootMidi + 12;
        const scale = profile.scaleIntervals;
        const arpPattern = [0, 2, 4, 2];
        
        // Reduced from 16 notes to 8 per bar for less busy sound
        const noteDuration = this.beatDuration / 2;
        for (let i = 0; i < 8; i++) {
            const time = startTime + (i * noteDuration);
            const degree = arpPattern[i % arpPattern.length] + Math.floor(i / 4);
            const note = root + scale[degree % scale.length] + Math.floor(degree / scale.length) * 12;
            this.playArp(note, time, noteDuration * 0.7, profile);
        }
    },
    
    scheduleBossLayer(startTime, profile) {
        const bossProfile = this.bossProfiles[this.currentArenaId];
        if (!bossProfile) return;
        
        const subNote = profile.rootMidi - 24;
        this.playSubBass(subNote, startTime, this.barDuration, profile, bossProfile.bassBoost);
        
        if (this.bossPhase >= 2) {
            [0.5, 2.5].forEach(beat => {
                const time = startTime + (beat * this.beatDuration);
                this.playStab(profile.rootMidi + profile.scaleIntervals[5], time, profile);
            });
        }
        
        if (this.bossPhase >= 3) {
            for (let i = 0; i < 4; i++) {
                const time = startTime + (Math.random() * this.barDuration);
                const note = profile.rootMidi + profile.scaleIntervals[Math.floor(Math.random() * profile.scaleIntervals.length)];
                this.playGlitch(note, time, 0.1, profile);
            }
        }
    },
    
    // ============================================================================
    // SOUND GENERATORS
    // ============================================================================
    
    midiToFreq(midi) {
        return 440 * Math.pow(2, (midi - 69) / 12);
    },
    
    playDrum(type, time, profile, volumeMod = 1) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        if (type === 'kick') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(150, time);
            osc.frequency.exponentialRampToValueAtTime(40, time + 0.1);
            gain.gain.setValueAtTime(0.8 * volumeMod, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);
        } else if (type === 'snare') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(200, time);
            gain.gain.setValueAtTime(0.4 * volumeMod, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);
        } else if (type === 'hihat') {
            osc.type = 'triangle';  // Softer than square
            osc.frequency.setValueAtTime(5000, time);  // Reduced from 8000 for less harsh
            gain.gain.setValueAtTime(0.06 * volumeMod, time);  // Reduced from 0.1
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
        }
        
        osc.connect(gain);
        gain.connect(this.musicBus);
        osc.start(time);
        osc.stop(time + 0.5);
        osc.endTime = time + 0.5;
        this.activeOscillators.push(osc);
    },
    
    playBass(note, time, duration, profile) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(this.midiToFreq(note), time);
        
        const volume = 0.35 * this.intensity;
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(volume, time + 0.02);
        gain.gain.setValueAtTime(volume, time + duration - 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, time + duration);
        
        osc.connect(gain);
        gain.connect(this.musicBus);
        osc.start(time);
        osc.stop(time + duration + 0.1);
        osc.endTime = time + duration + 0.1;
        this.activeOscillators.push(osc);
    },
    
    playChord(notes, time, duration, profile) {
        notes.forEach((note, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(this.midiToFreq(note), time);
            
            const volume = 0.12 * this.intensity;
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(volume, time + 0.1);
            gain.gain.setValueAtTime(volume * 0.8, time + duration - 0.2);
            gain.gain.exponentialRampToValueAtTime(0.01, time + duration);
            
            osc.connect(gain);
            gain.connect(this.musicBus);
            osc.start(time);
            osc.stop(time + duration + 0.1);
            osc.endTime = time + duration + 0.1;
            this.activeOscillators.push(osc);
        });
    },
    
    playLead(note, time, duration, profile) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(this.midiToFreq(note), time);
        
        const volume = 0.2 * this.intensity;
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(volume, time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, time + duration);
        
        osc.connect(gain);
        gain.connect(this.musicBus);
        osc.start(time);
        osc.stop(time + duration + 0.1);
        osc.endTime = time + duration + 0.1;
        this.activeOscillators.push(osc);
    },
    
    playArp(note, time, duration, profile) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(this.midiToFreq(note), time);
        
        const volume = 0.08 * this.intensity;
        gain.gain.setValueAtTime(volume, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + duration);
        
        osc.connect(gain);
        gain.connect(this.musicBus);
        osc.start(time);
        osc.stop(time + duration + 0.05);
        osc.endTime = time + duration + 0.05;
        this.activeOscillators.push(osc);
    },
    
    playSubBass(note, time, duration, profile, boost = 1) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(this.midiToFreq(note), time);
        
        const volume = 0.5 * boost;
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(volume, time + 0.1);
        gain.gain.setValueAtTime(volume, time + duration - 0.2);
        gain.gain.exponentialRampToValueAtTime(0.01, time + duration);
        
        osc.connect(gain);
        gain.connect(this.musicBus);
        osc.start(time);
        osc.stop(time + duration + 0.1);
        osc.endTime = time + duration + 0.1;
        this.activeOscillators.push(osc);
    },
    
    playStab(note, time, profile) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(this.midiToFreq(note), time);
        
        gain.gain.setValueAtTime(0.3, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);
        
        osc.connect(gain);
        gain.connect(this.musicBus);
        osc.start(time);
        osc.stop(time + 0.2);
        osc.endTime = time + 0.2;
        this.activeOscillators.push(osc);
    },
    
    playGlitch(note, time, duration, profile) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(this.midiToFreq(note), time);
        osc.frequency.setValueAtTime(this.midiToFreq(note + 7), time + duration / 2);
        
        gain.gain.setValueAtTime(0.15, time);
        gain.gain.setValueAtTime(0.01, time + duration);
        
        osc.connect(gain);
        gain.connect(this.musicBus);
        osc.start(time);
        osc.stop(time + duration + 0.05);
        osc.endTime = time + duration + 0.05;
        this.activeOscillators.push(osc);
    },
    
    // ============================================================================
    // ENEMY SOUNDS
    // ============================================================================
    
    playEnemySound(enemy, event) {
        if (!this._checkReady()) return;

        // Rate limiting: global per event, plus per-enemy for attacks.
        const now = this.ctx.currentTime;
        const GLOBAL_COOLDOWNS = { spawn: 0.08, death: 0.06, attack: 0.10 };
        const globalKey = '_lastSfx_' + event;
        const globalCd = GLOBAL_COOLDOWNS[event] || 0;
        if (globalCd > 0 && this[globalKey] && (now - this[globalKey]) < globalCd) return;
        this[globalKey] = now;

        if (event === 'attack') {
            if (enemy && enemy._lastAttackSfx && (now - enemy._lastAttackSfx) < 0.25) return;
            if (enemy) enemy._lastAttackSfx = now;
        }

        const type = (enemy && (enemy.enemyType || enemy.typeName || enemy.type)) || 'grunt';
        const profile = this.enemySfxProfiles[type] || this.enemySfxProfiles['grunt'];
        if (!profile) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        const baseNote = this.currentProfile.rootMidi + profile.pitchClass + profile.colorPitchMod;
        
        if (event === 'spawn') {
            osc.type = profile.waveform;
            osc.frequency.setValueAtTime(this.midiToFreq(baseNote + 12), now);
            osc.frequency.exponentialRampToValueAtTime(this.midiToFreq(baseNote), now + 0.2);
            gain.gain.setValueAtTime(profile.baseVolume * 0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        } else if (event === 'death') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(this.midiToFreq(baseNote), now);
            osc.frequency.exponentialRampToValueAtTime(this.midiToFreq(baseNote - 24), now + 0.3);
            gain.gain.setValueAtTime(profile.baseVolume * 0.5, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        } else if (event === 'attack') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(this.midiToFreq(baseNote + 5), now);
            gain.gain.setValueAtTime(profile.baseVolume * 0.4, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        }
        
        osc.connect(gain);
        gain.connect(this.sfxBus);
        osc.start(now);
        osc.stop(now + 0.4);
        osc.endTime = now + 0.4;
        this.activeOscillators.push(osc);
    },
    
    // ============================================================================
    // STINGERS
    // ============================================================================
    
    playWaveStinger() {
        if (!this._checkReady()) return;
        
        const profile = this.currentProfile;
        const now = this.ctx.currentTime;
        const notes = [0, 4, 7].map(d => profile.rootMidi + profile.scaleIntervals[d % profile.scaleIntervals.length]);
        
        let time = now;
        notes.forEach((note, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(this.midiToFreq(note + 12), time);
            
            gain.gain.setValueAtTime(0.3, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);
            
            osc.connect(gain);
            gain.connect(this.sfxBus);
            osc.start(time);
            osc.stop(time + 0.35);
            osc.endTime = time + 0.35;
            this.activeOscillators.push(osc);
            
            time += 0.1;
        });
    },
    
    playBossStinger() {
        if (!this._checkReady()) return;
        
        const profile = this.currentProfile;
        const now = this.ctx.currentTime;
        const notes = [0, 3, 6].map(d => profile.rootMidi + profile.scaleIntervals[d % profile.scaleIntervals.length]);
        
        let time = now;
        notes.forEach((note, i) => {
            this.playStab(note, time, profile);
            time += 0.2;
        });
        
        this.playSubBass(profile.rootMidi - 24, now + 0.8, 1.5, profile, 1.5);
    },
    
    playVictoryStinger() {
        if (!this._checkReady()) return;
        
        const profile = this.currentProfile;
        const now = this.ctx.currentTime;
        
        const majorScale = [0, 2, 4, 5, 7, 9, 11];
        const notes = [0, 2, 4, 7].map(d => profile.rootMidi + 12 + majorScale[d % majorScale.length]);
        
        let time = now;
        notes.forEach((note, i) => {
            this.playLead(note, time, 0.25, profile);
            time += 0.15;
        });
        
        const chord = [0, 4, 7].map(d => profile.rootMidi + majorScale[d % majorScale.length]);
        this.playChord(chord, now + 0.6, 1.5, profile);
    },
    
    playDamageStinger(healthPercent) {
        if (!this._checkReady()) return;
        
        const profile = this.currentProfile;
        const now = this.ctx.currentTime;
        
        const note = profile.rootMidi + 6;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(this.midiToFreq(note), now);
        osc.frequency.exponentialRampToValueAtTime(this.midiToFreq(note - 12), now + 0.2);
        
        const vol = 0.3 * (1 - healthPercent);
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        
        osc.connect(gain);
        gain.connect(this.sfxBus);
        osc.start(now);
        osc.stop(now + 0.25);
        osc.endTime = now + 0.25;
        this.activeOscillators.push(osc);
    },
    
    playLevelUpStinger() {
        if (!this._checkReady()) return;
        
        const profile = this.currentProfile;
        const now = this.ctx.currentTime;
        
        const notes = [0, 4, 7, 12].map(interval => profile.rootMidi + 12 + profile.scaleIntervals[interval % profile.scaleIntervals.length] + Math.floor(interval / profile.scaleIntervals.length) * 12);
        
        let time = now;
        notes.forEach((note, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(this.midiToFreq(note), time);
            
            gain.gain.setValueAtTime(0.25, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);
            
            osc.connect(gain);
            gain.connect(this.sfxBus);
            osc.start(time);
            osc.stop(time + 0.35);
            osc.endTime = time + 0.35;
            this.activeOscillators.push(osc);
            
            time += 0.08;
        });
    },
    
    // ============================================================================
    // ADAPTIVE STATE UPDATES
    // ============================================================================
    
    update(gameStateRef, enemiesRef, bossRef) {
        if (!this.enabled || !this.initialized) return;
        
        const enemyCount = enemiesRef.length;
        const maxEnemiesForIntensity = 20;
        let enemyIntensity = Math.min(1, enemyCount / maxEnemiesForIntensity);
        
        const wavesTotal = 10;
        const waveIntensity = (gameStateRef.currentWave - 1) / wavesTotal;
        
        this.targetIntensity = Math.min(1, (enemyIntensity * 0.6) + (waveIntensity * 0.4));
        
        if (bossRef && gameStateRef.bossActive) {
            this.targetIntensity = 0.9;
            
            const healthPercent = bossRef.health / bossRef.maxHealth;
            if (healthPercent < 0.33) this.bossPhase = 3;
            else if (healthPercent < 0.66) this.bossPhase = 2;
            else this.bossPhase = 1;
        } else {
            this.bossPhase = 0;
        }
        
        const healthPercent = gameStateRef.health / gameStateRef.maxHealth;
        if (this.currentProfile) {
            const baseFilter = this.currentProfile.baseFilterCutoff;
            this.targetFilterCutoff = baseFilter * (0.3 + healthPercent * 0.7);
            
            if (this.bossPhase > 0) {
                const bossProfile = this.bossProfiles[this.currentArenaId];
                if (bossProfile) {
                    this.targetFilterCutoff += bossProfile.phases[this.bossPhase].filterMod;
                }
            }
        }
        
        this.harmonicTension = waveIntensity * 0.7 + (this.bossPhase > 0 ? 0.3 : 0);
        this.beatCount++;

        const intensityBucket = this.getIntensityBucket(this.targetIntensity, this.bossPhase);
        if (intensityBucket !== this.lastIntensityBucket) {
            this.lastIntensityBucket = intensityBucket;
            log('MUSIC', 'intensity_bucket', {
                bucket: intensityBucket,
                targetIntensity: Number(this.targetIntensity.toFixed(2)),
                enemyCount,
                wave: gameStateRef.currentWave,
                bossPhase: this.bossPhase
            });
        }

        if (this.bossPhase !== this.lastBossPhaseLogged) {
            this.lastBossPhaseLogged = this.bossPhase;
            log('MUSIC', 'boss_phase', { phase: this.bossPhase });
        }
    },
    
    // ============================================================================
    // EVENT HANDLERS
    // ============================================================================
    
    onArenaChange(arenaId) {
        this.loadArena(arenaId);
        if (this.currentProfile) {
            log('MUSIC', 'arena_change', {
                arena: arenaId,
                profile: this.currentProfile.name,
                key: this.currentProfile.rootNote,
                scale: this.currentProfile.scale,
                bpm: this.bpm
            });
        } else {
            log('MUSIC', 'arena_change', { arena: arenaId });
        }
    },
    
    onWaveStart(waveNum) {
        log('MUSIC', 'wave_start', { wave: waveNum, arena: this.currentArenaId });
        this.playWaveStinger();
    },
    
    onWaveClear() {
        if (this.currentProfile) {
            const now = this.ctx.currentTime;
            const chord = [0, 4, 7].map(d => this.currentProfile.rootMidi + this.currentProfile.scaleIntervals[d % this.currentProfile.scaleIntervals.length]);
            this.playChord(chord, now, 0.8, this.currentProfile);
        }
    },
    
    onBossStart(arenaId) {
        this.bossPhase = 1;
        log('MUSIC', 'boss_start', { arena: arenaId });
        this.playBossStinger();
    },
    
    onBossPhaseChange(phase) {
        this.bossPhase = phase;
        if (!this.currentProfile || !this.ctx) return;
        
        const now = this.ctx.currentTime;
        const profile = this.currentProfile;
        
        // Dramatic phase transition stinger
        // Dissonant build-up
        const tritone = profile.rootMidi + 6;
        const root = profile.rootMidi;
        
        // Initial dissonant hit
        this.playStab(tritone, now, profile);
        this.playStab(root + 1, now + 0.05, profile);
        
        // Resolving power chord
        const resolution = [root, root + 7, root + 12];
        resolution.forEach((note, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = phase === 3 ? 'sawtooth' : 'square';
            osc.frequency.setValueAtTime(this.midiToFreq(note), now + 0.15);
            
            gain.gain.setValueAtTime(0.4, now + 0.15);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
            
            osc.connect(gain);
            gain.connect(this.sfxBus);
            osc.start(now + 0.15);
            osc.stop(now + 0.85);
            osc.endTime = now + 0.85;
            this.activeOscillators.push(osc);
        });
        
        // Sub impact for phase 3
        if (phase === 3) {
            const subOsc = this.ctx.createOscillator();
            const subGain = this.ctx.createGain();
            subOsc.type = 'sine';
            subOsc.frequency.setValueAtTime(30, now + 0.15);
            subGain.gain.setValueAtTime(0.7, now + 0.15);
            subGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
            subOsc.connect(subGain);
            subGain.connect(this.sfxBus);
            subOsc.start(now + 0.15);
            subOsc.stop(now + 0.55);
            this.activeOscillators.push(subOsc);
        }
    },
    
    onBossDefeat() {
        this.bossPhase = 0;
        this.playVictoryStinger();
    },
    
    // Boss 4 (THE OVERGROWTH) specific audio cues
    onBossGrowthStart() {
        if (!this._checkReady()) return;
        
        const now = this.ctx.currentTime;
        const profile = this.currentProfile;
        
        // Deep rumbling sound for growth
        const subOsc = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        
        // Sub bass rumble
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(40, now);
        subOsc.frequency.linearRampToValueAtTime(35, now + 0.8);
        
        // LFO for wobble effect
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(4, now);
        lfoGain.gain.setValueAtTime(5, now);
        
        lfo.connect(lfoGain);
        lfoGain.connect(subOsc.frequency);
        
        subGain.gain.setValueAtTime(0.5, now);
        subGain.gain.linearRampToValueAtTime(0.3, now + 0.4);
        subGain.gain.exponentialRampToValueAtTime(0.01, now + 1.0);
        
        subOsc.connect(subGain);
        subGain.connect(this.sfxBus);
        
        subOsc.start(now);
        subOsc.stop(now + 1.1);
        lfo.start(now);
        lfo.stop(now + 1.0);
        subOsc.endTime = now + 1.1;
        this.activeOscillators.push(subOsc);
        this.activeOscillators.push(lfo);
    },
    
    onBossSplitWarning() {
        if (!this._checkReady()) return;
        
        const now = this.ctx.currentTime;
        const profile = this.currentProfile;
        
        // Cracking/fracturing sound - multiple high frequency clicks
        for (let i = 0; i < 5; i++) {
            const clickTime = now + i * 0.08;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = 'square';
            const freq = 800 + Math.random() * 400;
            osc.frequency.setValueAtTime(freq, clickTime);
            osc.frequency.exponentialRampToValueAtTime(freq * 0.5, clickTime + 0.02);
            
            gain.gain.setValueAtTime(0.3, clickTime);
            gain.gain.exponentialRampToValueAtTime(0.01, clickTime + 0.03);
            
            osc.connect(gain);
            gain.connect(this.sfxBus);
            osc.start(clickTime);
            osc.stop(clickTime + 0.04);
            osc.endTime = clickTime + 0.04;
            this.activeOscillators.push(osc);
        }
        
        // Rising tension tone
        const riseOsc = this.ctx.createOscillator();
        const riseGain = this.ctx.createGain();
        
        riseOsc.type = 'sawtooth';
        riseOsc.frequency.setValueAtTime(this.midiToFreq(profile.rootMidi + 12), now);
        riseOsc.frequency.exponentialRampToValueAtTime(this.midiToFreq(profile.rootMidi + 24), now + 0.5);
        
        riseGain.gain.setValueAtTime(0.15, now);
        riseGain.gain.linearRampToValueAtTime(0.25, now + 0.4);
        riseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.55);
        
        riseOsc.connect(riseGain);
        riseGain.connect(this.sfxBus);
        riseOsc.start(now);
        riseOsc.stop(now + 0.6);
        riseOsc.endTime = now + 0.6;
        this.activeOscillators.push(riseOsc);
    },
    
    onBossSplit() {
        if (!this._checkReady()) return;
        
        const now = this.ctx.currentTime;
        const profile = this.currentProfile;
        
        // Explosive split sound - impact + scatter
        // Low impact
        const impactOsc = this.ctx.createOscillator();
        const impactGain = this.ctx.createGain();
        
        impactOsc.type = 'sine';
        impactOsc.frequency.setValueAtTime(80, now);
        impactOsc.frequency.exponentialRampToValueAtTime(30, now + 0.15);
        
        impactGain.gain.setValueAtTime(0.6, now);
        impactGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        
        impactOsc.connect(impactGain);
        impactGain.connect(this.sfxBus);
        impactOsc.start(now);
        impactOsc.stop(now + 0.25);
        impactOsc.endTime = now + 0.25;
        this.activeOscillators.push(impactOsc);
        
        // Scatter noise burst
        const noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.15, this.ctx.sampleRate);
        const noiseData = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseData.length; i++) {
            noiseData[i] = (Math.random() * 2 - 1) * (1 - i / noiseData.length);
        }
        
        const noiseSource = this.ctx.createBufferSource();
        const noiseGain = this.ctx.createGain();
        const noiseFilter = this.ctx.createBiquadFilter();
        
        noiseSource.buffer = noiseBuffer;
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.setValueAtTime(2000, now);
        noiseFilter.frequency.exponentialRampToValueAtTime(500, now + 0.1);
        
        noiseGain.gain.setValueAtTime(0.4, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        
        noiseSource.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.sfxBus);
        noiseSource.start(now);
        noiseSource.stop(now + 0.18);
        
        // Triad chord burst for 3 mini-bosses
        [0, 4, 7].forEach((interval, i) => {
            const chordOsc = this.ctx.createOscillator();
            const chordGain = this.ctx.createGain();
            
            chordOsc.type = 'square';
            chordOsc.frequency.setValueAtTime(this.midiToFreq(profile.rootMidi + interval + 12), now + 0.02);
            
            chordGain.gain.setValueAtTime(0.2, now + 0.02);
            chordGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            
            chordOsc.connect(chordGain);
            chordGain.connect(this.sfxBus);
            chordOsc.start(now + 0.02);
            chordOsc.stop(now + 0.35);
            chordOsc.endTime = now + 0.35;
            this.activeOscillators.push(chordOsc);
        });
    },
    
    onLaneWallWarning() {
        if (!this._checkReady()) return;
        
        const now = this.ctx.currentTime;
        const profile = this.currentProfile;
        
        // Rising warning tone
        const warnOsc = this.ctx.createOscillator();
        const warnGain = this.ctx.createGain();
        
        warnOsc.type = 'triangle';
        warnOsc.frequency.setValueAtTime(this.midiToFreq(profile.rootMidi + 7), now);
        warnOsc.frequency.linearRampToValueAtTime(this.midiToFreq(profile.rootMidi + 14), now + 0.3);
        
        warnGain.gain.setValueAtTime(0.25, now);
        warnGain.gain.linearRampToValueAtTime(0.35, now + 0.2);
        warnGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        
        warnOsc.connect(warnGain);
        warnGain.connect(this.sfxBus);
        warnOsc.start(now);
        warnOsc.stop(now + 0.45);
        warnOsc.endTime = now + 0.45;
        this.activeOscillators.push(warnOsc);
        
        // Secondary alarm beep
        const beepOsc = this.ctx.createOscillator();
        const beepGain = this.ctx.createGain();
        
        beepOsc.type = 'square';
        beepOsc.frequency.setValueAtTime(this.midiToFreq(profile.rootMidi + 19), now + 0.15);
        
        beepGain.gain.setValueAtTime(0, now);
        beepGain.gain.setValueAtTime(0.2, now + 0.15);
        beepGain.gain.setValueAtTime(0, now + 0.2);
        beepGain.gain.setValueAtTime(0.2, now + 0.25);
        beepGain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        
        beepOsc.connect(beepGain);
        beepGain.connect(this.sfxBus);
        beepOsc.start(now + 0.15);
        beepOsc.stop(now + 0.4);
        beepOsc.endTime = now + 0.4;
        this.activeOscillators.push(beepOsc);
    },
    
    onEnemySpawn(enemy) {
        this.playEnemySound(enemy, 'spawn');
    },
    
    onEnemyDeath(enemy) {
        this.playEnemySound(enemy, 'death');
    },
    
    onEnemyAttack(enemy) {
        this.playEnemySound(enemy, 'attack');
    },
    
    onPlayerDamage(healthPercent) {
        this.playDamageStinger(healthPercent);
    },
    
    onLevelUp() {
        this.playLevelUpStinger();
    },

    onXpPickup() {
        if (!this._checkReady()) return;

        const now = this.ctx.currentTime;
        if (now - this.lastXpPickupTime < 0.05) return;
        this.lastXpPickupTime = now;

        const profile = this.currentProfile;
        const notes = [0, 2, 4].map(interval => profile.rootMidi + 12 + profile.scaleIntervals[interval % profile.scaleIntervals.length]);
        let time = now;

        notes.forEach((note) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(this.midiToFreq(note), time);

            gain.gain.setValueAtTime(0.12, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.18);

            osc.connect(gain);
            gain.connect(this.sfxBus);
            osc.start(time);
            osc.stop(time + 0.2);
            osc.endTime = time + 0.2;
            this.activeOscillators.push(osc);

            time += 0.04;
        });
    },

    getIntensityBucket(intensity, bossPhase) {
        if (bossPhase > 0) return 'boss';
        if (intensity > 0.7) return 'arp';
        if (intensity > 0.5) return 'melody';
        if (intensity > 0.3) return 'chords';
        if (intensity > 0.1) return 'bass';
        return 'idle';
    },
    
    onGameOver() {
        this.stopMusicLoop();
        if (this.currentProfile && this.ctx) {
            const now = this.ctx.currentTime;
            const notes = [7, 5, 3, 0].map(d => this.currentProfile.rootMidi + this.currentProfile.scaleIntervals[d % this.currentProfile.scaleIntervals.length]);
            let time = now;
            notes.forEach(note => {
                this.playLead(note, time, 0.5, this.currentProfile);
                time += 0.4;
            });
        }
    },
    
    // ============================================================================
    // REBALANCE MECHANIC SOUNDS
    // ============================================================================
    
    onShieldHit() {
        if (!this._checkReady()) return;
        
        // Cooldown to prevent spam (50ms)
        const now = this.ctx.currentTime;
        if (this.lastShieldHit && now - this.lastShieldHit < 0.05) return;
        this.lastShieldHit = now;
        
        // Enhanced ricochet "clang" sound - louder and more metallic
        // High metallic clang
        const clangOsc = this.ctx.createOscillator();
        const clangGain = this.ctx.createGain();
        
        clangOsc.type = 'triangle';
        clangOsc.frequency.setValueAtTime(1400, now);
        clangOsc.frequency.exponentialRampToValueAtTime(600, now + 0.06);
        
        clangGain.gain.setValueAtTime(0.25, now);
        clangGain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        
        clangOsc.connect(clangGain);
        clangGain.connect(this.sfxBus);
        clangOsc.start(now);
        clangOsc.stop(now + 0.15);
        clangOsc.endTime = now + 0.15;
        this.activeOscillators.push(clangOsc);
        
        // Low "thud" undertone - muffled, blocked feeling
        const thudOsc = this.ctx.createOscillator();
        const thudGain = this.ctx.createGain();
        
        thudOsc.type = 'sine';
        thudOsc.frequency.setValueAtTime(120, now);
        thudOsc.frequency.exponentialRampToValueAtTime(60, now + 0.08);
        
        thudGain.gain.setValueAtTime(0.3, now);
        thudGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        
        thudOsc.connect(thudGain);
        thudGain.connect(this.sfxBus);
        thudOsc.start(now);
        thudOsc.stop(now + 0.12);
        thudOsc.endTime = now + 0.12;
        this.activeOscillators.push(thudOsc);
    },
    
    onShieldBreak() {
        if (!this._checkReady()) return;
        
        const now = this.ctx.currentTime;
        
        // Part 1: Sub-bass thud (40Hz)
        const subOsc = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(40, now);
        
        subGain.gain.setValueAtTime(0.6, now);
        subGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        
        subOsc.connect(subGain);
        subGain.connect(this.sfxBus);
        subOsc.start(now);
        subOsc.stop(now + 0.12);
        subOsc.endTime = now + 0.12;
        this.activeOscillators.push(subOsc);
        
        // Part 2: Glass shatter (filtered noise burst)
        const bufferSize = this.ctx.sampleRate * 0.3;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
        }
        
        const noiseSource = this.ctx.createBufferSource();
        noiseSource.buffer = buffer;
        
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.setValueAtTime(2000, now + 0.05);
        noiseFilter.frequency.linearRampToValueAtTime(800, now + 0.3);
        noiseFilter.Q.value = 2;
        
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.4, now + 0.05);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        
        noiseSource.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.sfxBus);
        noiseSource.start(now + 0.05);
        noiseSource.stop(now + 0.35);
    },
    
    onBossExposed() {
        if (!this._checkReady()) return;
        
        const profile = this.currentProfile;
        const now = this.ctx.currentTime;
        
        // Tritone (dissonance) to perfect fifth (resolution)
        const root = profile.rootMidi;
        const tritone = root + 6; // Augmented fourth
        const fifth = root + 7;    // Perfect fifth
        
        // Dissonant chord
        [root, tritone].forEach(note => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(this.midiToFreq(note), now);
            
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.2);
            
            osc.connect(gain);
            gain.connect(this.sfxBus);
            osc.start(now);
            osc.stop(now + 0.22);
            osc.endTime = now + 0.22;
            this.activeOscillators.push(osc);
        });
        
        // Resolution chord
        [root, fifth, root + 12].forEach(note => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(this.midiToFreq(note), now + 0.2);
            
            gain.gain.setValueAtTime(0.25, now + 0.2);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.7);
            
            osc.connect(gain);
            gain.connect(this.sfxBus);
            osc.start(now + 0.2);
            osc.stop(now + 0.75);
            osc.endTime = now + 0.75;
            this.activeOscillators.push(osc);
        });
    },
    
    // Boss 1 (RED PUFFER KING) specific audio cues
    onBossChargeWindup() {
        if (!this._checkReady()) return;
        
        const now = this.ctx.currentTime;
        
        // Rising warning tone (200Hz -> 400Hz over 0.5s)
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.linearRampToValueAtTime(400, now + 0.5);
        
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0.25, now + 0.4);
        gain.gain.linearRampToValueAtTime(0, now + 0.5);
        
        osc.connect(gain);
        gain.connect(this.sfxBus);
        osc.start(now);
        osc.stop(now + 0.52);
        osc.endTime = now + 0.52;
        this.activeOscillators.push(osc);
    },
    
    onBossShieldActivate() {
        if (!this._checkReady()) return;
        
        const now = this.ctx.currentTime;
        const profile = this.currentProfile;
        
        // Crystalline bubble activation sound - arpeggiated chord
        const frequencies = [523, 659, 784, 1047];  // C5, E5, G5, C6
        frequencies.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = 'sine';
            osc.frequency.value = freq;
            
            const startTime = now + i * 0.05;
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.12, startTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);
            
            osc.connect(gain);
            gain.connect(this.sfxBus);
            osc.start(startTime);
            osc.stop(startTime + 0.45);
            osc.endTime = startTime + 0.45;
            this.activeOscillators.push(osc);
        });
    },
    
    onBossShieldBreak() {
        if (!this._checkReady()) return;
        
        const now = this.ctx.currentTime;
        
        // Satisfying shatter sound - noise burst with high-pass filter
        const noiseBuffer = this.ctx.createBuffer(1, 4410, 44100);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noise = this.ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        
        const highpass = this.ctx.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 2000;
        
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        
        noise.connect(highpass);
        highpass.connect(gain);
        gain.connect(this.sfxBus);
        noise.start(now);
        noise.stop(now + 0.2);
        
        // Add a satisfying "glass" tone
        const glassTone = this.ctx.createOscillator();
        const glassGain = this.ctx.createGain();
        glassTone.type = 'sine';
        glassTone.frequency.setValueAtTime(1200, now);
        glassTone.frequency.exponentialRampToValueAtTime(400, now + 0.15);
        glassGain.gain.setValueAtTime(0.2, now);
        glassGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        glassTone.connect(glassGain);
        glassGain.connect(this.sfxBus);
        glassTone.start(now);
        glassTone.stop(now + 0.22);
        glassTone.endTime = now + 0.22;
        this.activeOscillators.push(glassTone);
    },
    
    // Combo start audio - rising synth note indicating combo chain beginning
    onComboStart(comboLength = 2) {
        if (!this._checkReady()) return;
        
        const now = this.ctx.currentTime;
        const profile = this.currentProfile;
        
        // Rising "rev-up" synth - ascending arpeggio
        const baseFreq = this.midiToFreq(profile.rootMidi + 12);
        const notes = [0, 4, 7]; // Major triad intervals
        
        notes.forEach((interval, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = 'sawtooth';
            const freq = baseFreq * Math.pow(2, interval / 12);
            osc.frequency.setValueAtTime(freq * 0.5, now + i * 0.05);
            osc.frequency.exponentialRampToValueAtTime(freq, now + i * 0.05 + 0.08);
            
            const startTime = now + i * 0.05;
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.12, startTime + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);
            
            osc.connect(gain);
            gain.connect(this.sfxBus);
            osc.start(startTime);
            osc.stop(startTime + 0.25);
            osc.endTime = startTime + 0.25;
            this.activeOscillators.push(osc);
        });
        
        // Add a subtle low "power-up" hum based on combo length
        const humOsc = this.ctx.createOscillator();
        const humGain = this.ctx.createGain();
        humOsc.type = 'sine';
        humOsc.frequency.setValueAtTime(80, now);
        humOsc.frequency.linearRampToValueAtTime(80 + comboLength * 20, now + 0.15);
        humGain.gain.setValueAtTime(0.15, now);
        humGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        humOsc.connect(humGain);
        humGain.connect(this.sfxBus);
        humOsc.start(now);
        humOsc.stop(now + 0.25);
        humOsc.endTime = now + 0.25;
        this.activeOscillators.push(humOsc);
    },
    
    // Combo end audio - quick "snap" closure sound
    onComboEnd() {
        if (!this._checkReady()) return;
        
        const now = this.ctx.currentTime;
        
        // Quick descending "snap" - like a whip crack
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.08);
        
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        
        osc.connect(gain);
        gain.connect(this.sfxBus);
        osc.start(now);
        osc.stop(now + 0.12);
        osc.endTime = now + 0.12;
        this.activeOscillators.push(osc);
        
        // Add a tiny "click" for closure
        const clickOsc = this.ctx.createOscillator();
        const clickGain = this.ctx.createGain();
        clickOsc.type = 'sine';
        clickOsc.frequency.value = 1200;
        clickGain.gain.setValueAtTime(0.1, now + 0.05);
        clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        clickOsc.connect(clickGain);
        clickGain.connect(this.sfxBus);
        clickOsc.start(now + 0.05);
        clickOsc.stop(now + 0.1);
        clickOsc.endTime = now + 0.1;
        this.activeOscillators.push(clickOsc);
    },

    onMinionKill() {
        if (!this._checkReady()) return;

        const now = this.ctx.currentTime;
        const profile = this.currentProfile;
        const root = profile.rootMidi + 12;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(this.midiToFreq(root + 7), now);
        osc.frequency.exponentialRampToValueAtTime(this.midiToFreq(root), now + 0.08);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

        osc.connect(gain);
        gain.connect(this.sfxBus);
        osc.start(now);
        osc.stop(now + 0.15);
        osc.endTime = now + 0.15;
        this.activeOscillators.push(osc);
    },
    
    // Final boss victory fanfare - triumphant ascending chord progression
    onFinalBossVictory() {
        if (!this._checkReady()) return;
        
        const now = this.ctx.currentTime;
        
        // Triumphant fanfare - ascending major chord progression
        const chords = [
            [261.63, 329.63, 392.00],  // C major
            [293.66, 369.99, 440.00],  // D major
            [329.63, 415.30, 493.88],  // E major
            [392.00, 493.88, 587.33, 783.99]  // G major (full chord with octave)
        ];
        
        chords.forEach((chord, chordIndex) => {
            const chordTime = now + chordIndex * 0.4;
            
            chord.forEach(freq => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                
                osc.type = chordIndex === 3 ? 'triangle' : 'sine';
                osc.frequency.value = freq;
                
                // Final chord is longer and louder
                const duration = chordIndex === 3 ? 2.0 : 0.35;
                const volume = chordIndex === 3 ? 0.2 : 0.15;
                
                gain.gain.setValueAtTime(0, chordTime);
                gain.gain.linearRampToValueAtTime(volume, chordTime + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.01, chordTime + duration);
                
                osc.connect(gain);
                gain.connect(this.sfxBus);
                osc.start(chordTime);
                osc.stop(chordTime + duration + 0.05);
                osc.endTime = chordTime + duration + 0.05;
                this.activeOscillators.push(osc);
            });
        });
        
        // Add a shimmering high note for sparkle effect
        for (let i = 0; i < 5; i++) {
            const sparkleTime = now + 1.5 + i * 0.15;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = 'sine';
            osc.frequency.value = 1500 + i * 200;
            
            gain.gain.setValueAtTime(0, sparkleTime);
            gain.gain.linearRampToValueAtTime(0.08, sparkleTime + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.01, sparkleTime + 0.2);
            
            osc.connect(gain);
            gain.connect(this.sfxBus);
            osc.start(sparkleTime);
            osc.stop(sparkleTime + 0.25);
            osc.endTime = sparkleTime + 0.25;
            this.activeOscillators.push(osc);
        }
    },
    
    onTeleport(isAppearing) {
        if (!this._checkReady()) return;
        
        const now = this.ctx.currentTime;
        
        // Create filtered noise whoosh
        const bufferSize = this.ctx.sampleRate * 0.2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noiseSource = this.ctx.createBufferSource();
        noiseSource.buffer = buffer;
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.value = 5;
        
        const gain = this.ctx.createGain();
        
        if (isAppearing) {
            // Low to high sweep (appearing)
            filter.frequency.setValueAtTime(200, now);
            filter.frequency.exponentialRampToValueAtTime(2000, now + 0.2);
            gain.gain.setValueAtTime(0.01, now);
            gain.gain.linearRampToValueAtTime(0.35, now + 0.1);
            gain.gain.linearRampToValueAtTime(0, now + 0.2);
        } else {
            // High to low sweep (vanishing)
            filter.frequency.setValueAtTime(2000, now);
            filter.frequency.exponentialRampToValueAtTime(200, now + 0.2);
            gain.gain.setValueAtTime(0.35, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
        }
        
        noiseSource.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxBus);
        noiseSource.start(now);
        noiseSource.stop(now + 0.22);
    },

    onTeleportReal() {
        if (!this._checkReady()) return;

        // Capture time once for both sounds to keep them in sync
        const now = this.ctx.currentTime;

        // Base appearing whoosh
        this.onTeleport(true);

        // Overlay: bright tonal shimmer so the real destination reads as distinct
        const profile = this.currentProfile;
        const root = profile.rootMidi + 12;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(this.midiToFreq(root + 7), now);
        osc.frequency.setValueAtTime(this.midiToFreq(root + 12), now + 0.05);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

        osc.connect(gain);
        gain.connect(this.sfxBus);
        osc.start(now);
        osc.stop(now + 0.2);
        osc.endTime = now + 0.2;
        this.activeOscillators.push(osc);
    },
    
    // ============================================================================
    // BOSS 2 (THE MONOLITH) SOUNDS - Pillar Perch + Slam
    // ============================================================================
    
    onPillarPerch() {
        if (!this._checkReady()) return;
        
        const now = this.ctx.currentTime;
        const profile = this.currentProfile;
        
        // Ascending whoosh as boss jumps to pillar
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(this.midiToFreq(profile.rootMidi), now);
        osc.frequency.exponentialRampToValueAtTime(this.midiToFreq(profile.rootMidi + 12), now + 0.3);
        
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        
        osc.connect(gain);
        gain.connect(this.sfxBus);
        osc.start(now);
        osc.stop(now + 0.4);
        osc.endTime = now + 0.4;
        this.activeOscillators.push(osc);
    },
    
    onSlamCharge() {
        if (!this._checkReady()) return;
        
        const now = this.ctx.currentTime;
        const profile = this.currentProfile;
        
        // Building tension - low rumble that rises
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(this.midiToFreq(profile.rootMidi - 12), now);
        osc.frequency.linearRampToValueAtTime(this.midiToFreq(profile.rootMidi), now + 0.7);
        
        // LFO for pulsing intensity
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(4, now);
        lfo.frequency.linearRampToValueAtTime(12, now + 0.7);
        lfoGain.gain.setValueAtTime(0.1, now);
        
        lfo.connect(lfoGain);
        lfoGain.connect(gain.gain);
        
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0.35, now + 0.5);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.75);
        
        // Filter for that "building" sound
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, now);
        filter.frequency.exponentialRampToValueAtTime(2000, now + 0.7);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxBus);
        
        osc.start(now);
        osc.stop(now + 0.8);
        lfo.start(now);
        lfo.stop(now + 0.8);
        osc.endTime = now + 0.8;
        this.activeOscillators.push(osc);
        this.activeOscillators.push(lfo);
    },
    
    onSlamImpact() {
        if (!this._checkReady()) return;
        
        const now = this.ctx.currentTime;
        
        // Heavy impact - sub bass thud + impact noise
        const subOsc = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(60, now);
        subOsc.frequency.exponentialRampToValueAtTime(25, now + 0.15);
        
        subGain.gain.setValueAtTime(0.8, now);
        subGain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        
        subOsc.connect(subGain);
        subGain.connect(this.sfxBus);
        subOsc.start(now);
        subOsc.stop(now + 0.3);
        subOsc.endTime = now + 0.3;
        this.activeOscillators.push(subOsc);
        
        // Impact noise burst
        const bufferSize = this.ctx.sampleRate * 0.15;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
        }
        
        const noiseSource = this.ctx.createBufferSource();
        noiseSource.buffer = buffer;
        
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(1500, now);
        noiseFilter.frequency.exponentialRampToValueAtTime(200, now + 0.15);
        
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.5, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        
        noiseSource.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.sfxBus);
        noiseSource.start(now);
        noiseSource.stop(now + 0.2);
    },
    
    onHazardSpawn() {
        if (!this._checkReady()) return;
        
        const now = this.ctx.currentTime;
        const profile = this.currentProfile;
        
        // Sizzle/warning sound - filtered noise with descending tone
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(this.midiToFreq(profile.rootMidi + 12), now);
        osc.frequency.exponentialRampToValueAtTime(this.midiToFreq(profile.rootMidi), now + 0.2);
        
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        
        osc.connect(gain);
        gain.connect(this.sfxBus);
        osc.start(now);
        osc.stop(now + 0.3);
        osc.endTime = now + 0.3;
        this.activeOscillators.push(osc);
        
        // Sizzle noise overlay
        const bufferSize = this.ctx.sampleRate * 0.2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noiseSource = this.ctx.createBufferSource();
        noiseSource.buffer = buffer;
        
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(3000, now);
        noiseFilter.Q.value = 3;
        
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.15, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        
        noiseSource.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.sfxBus);
        noiseSource.start(now);
        noiseSource.stop(now + 0.25);
    },
    
    // Boss starts burrowing - descending rumble sound
    onBurrowStart() {
        if (!this._checkReady()) return;
        
        const now = this.ctx.currentTime;
        
        // Descending rumble - pitch drops as boss goes underground
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.exponentialRampToValueAtTime(25, now + 0.8); // Pitch drops
        
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.9);
        
        osc.connect(gain);
        gain.connect(this.sfxBus);
        osc.start(now);
        osc.stop(now + 1);
        osc.endTime = now + 1;
        this.activeOscillators.push(osc);
        
        // Dirt/debris noise
        const bufferSize = this.ctx.sampleRate * 0.5;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            // Granular dirt sound - irregular noise
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.5)) * 0.4;
        }
        
        const noiseSource = this.ctx.createBufferSource();
        noiseSource.buffer = buffer;
        
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(400, now);
        noiseFilter.frequency.exponentialRampToValueAtTime(100, now + 0.5);
        
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.25, now);
        noiseGain.gain.linearRampToValueAtTime(0.01, now + 0.6);
        
        noiseSource.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.sfxBus);
        noiseSource.start(now);
        noiseSource.stop(now + 0.6);
    },
    
    onBurrowWarning() {
        if (!this._checkReady()) return;
        
        const now = this.ctx.currentTime;
        
        // Low rumble - sub-bass drone
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(35, now); // Very low rumble
        
        // LFO for intensity modulation
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(8, now); // 8Hz tremolo
        lfoGain.gain.setValueAtTime(0.15, now);
        
        lfo.connect(lfoGain);
        lfoGain.connect(gain.gain);
        
        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.4, now + 0.5);
        gain.gain.linearRampToValueAtTime(0.5, now + 2.5);
        gain.gain.linearRampToValueAtTime(0.01, now + 3);
        
        osc.connect(gain);
        gain.connect(this.sfxBus);
        osc.start(now);
        osc.stop(now + 3.1);
        lfo.start(now);
        lfo.stop(now + 3.1);
        osc.endTime = now + 3.1;
        this.activeOscillators.push(osc);
        this.activeOscillators.push(lfo);
    },
    
    onBurrowEmerge() {
        if (!this._checkReady()) return;
        
        const now = this.ctx.currentTime;
        
        // Sub hit
        const subOsc = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(30, now);
        
        subGain.gain.setValueAtTime(0.7, now);
        subGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        
        subOsc.connect(subGain);
        subGain.connect(this.sfxBus);
        subOsc.start(now);
        subOsc.stop(now + 0.22);
        subOsc.endTime = now + 0.22;
        this.activeOscillators.push(subOsc);
        
        // Explosive noise burst
        const bufferSize = this.ctx.sampleRate * 0.2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
        }
        
        const noiseSource = this.ctx.createBufferSource();
        noiseSource.buffer = buffer;
        
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.5, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        
        noiseSource.connect(noiseGain);
        noiseGain.connect(this.sfxBus);
        noiseSource.start(now);
        noiseSource.stop(now + 0.22);
    },
    
    onWallSpawn() {
        if (!this._checkReady()) return;
        
        const now = this.ctx.currentTime;
        
        // FM zap sound
        const carrier = this.ctx.createOscillator();
        const modulator = this.ctx.createOscillator();
        const modGain = this.ctx.createGain();
        const gain = this.ctx.createGain();
        
        const note = this.currentProfile.rootMidi + 19; // High pitched
        carrier.type = 'sine';
        carrier.frequency.setValueAtTime(this.midiToFreq(note), now);
        
        modulator.type = 'sine';
        modulator.frequency.setValueAtTime(this.midiToFreq(note) * 3, now);
        
        modGain.gain.setValueAtTime(200, now);
        modGain.gain.exponentialRampToValueAtTime(1, now + 0.15);
        
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        
        modulator.connect(modGain);
        modGain.connect(carrier.frequency);
        carrier.connect(gain);
        gain.connect(this.sfxBus);
        
        carrier.start(now);
        carrier.stop(now + 0.17);
        modulator.start(now);
        modulator.stop(now + 0.17);
        carrier.endTime = now + 0.17;
        this.activeOscillators.push(carrier);
        this.activeOscillators.push(modulator);
    },
    
    onBreatherStart() {
        if (!this.enabled || !this.initialized) return;
        
        // Lower music intensity during breather
        this.breatherActive = true;
        this.preBreatherIntensity = this.targetIntensity;
        this.targetIntensity *= 0.5;
    },
    
    onBreatherEnd() {
        if (!this.enabled || !this.initialized) return;
        
        // Restore intensity and play a subtle "incoming" cue
        this.breatherActive = false;
        this.targetIntensity = this.preBreatherIntensity || this.targetIntensity;
        
        if (this.currentProfile) {
            const now = this.ctx.currentTime;
            const note = this.currentProfile.rootMidi + 7; // Fifth
            
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(this.midiToFreq(note), now);
            
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            
            osc.connect(gain);
            gain.connect(this.sfxBus);
            osc.start(now);
            osc.stop(now + 0.35);
            osc.endTime = now + 0.35;
            this.activeOscillators.push(osc);
        }
    },
    
    // ============================================================================
    // UTILITY
    // ============================================================================
    
    setMasterVolume(vol) {
        this.desiredMasterVol = Math.max(0, Math.min(1, vol));
        this._safeSetStorageItem(MASTER_VOL_KEY, String(this.desiredMasterVol));
        this._applyVolumes();
    },

    setMusicVolume(vol) {
        this.desiredMusicVol = Math.max(0, Math.min(1, vol));
        this._safeSetStorageItem(MUSIC_VOL_KEY, String(this.desiredMusicVol));
        this._applyVolumes();
    },

    getMasterVolume() {
        return this.desiredMasterVol;
    },

    getMusicVolume() {
        return this.desiredMusicVol;
    },
    
    setEnabled(enabled) {
        this.enabled = enabled;
        this._safeSetStorageItem(MUSIC_ENABLED_KEY, JSON.stringify(enabled));
        if (!enabled) {
            this.stop();
        }
    },
    
    toggle() {
        this.setEnabled(!this.enabled);
        return this.enabled;
    },
    
    // ============================================================================
    // MENU MUSIC - Epic intro theme for start screen
    // ============================================================================
    
    menuMusicLoopId: null,
    isMenuMusicPlaying: false,
    menuBeatPhase: 0,
    menuLastBeatTime: 0,
    
    // Get menu pulse intensity for visual sync (0-1 value that pulses with beat)
    getMenuPulseIntensity() {
        if (!this.isMenuMusicPlaying || !this.ctx) return 0;
        
        const now = this.ctx.currentTime;
        const timeSinceBeat = (now - this.menuLastBeatTime) % this.beatDuration;
        const beatProgress = timeSinceBeat / this.beatDuration;
        
        // Create a pulse that peaks at beat start and decays
        // Using exponential decay for more natural feel
        const pulse = Math.exp(-beatProgress * 4);
        
        return pulse;
    },
    
    startMenuMusic() {
        if (!this.enabled || !this.initialized || this.isMenuMusicPlaying) return;
        
        this.resume(); // Ensure audio context is running
        
        this.isMenuMusicPlaying = true;
        this.bpm = 90; // Slower, more epic tempo
        this.beatDuration = 60 / this.bpm;
        this.barDuration = this.beatDuration * 4;
        
        // D minor for dramatic tension
        const rootMidi = this.ROOTS['D'];
        const scale = this.SCALES.minor;
        
        this.nextBarTime = this.ctx.currentTime + 0.1;
        
        // Menu music tick - simplified epic music
        this.menuMusicLoopId = setInterval(() => {
            if (!this.ctx || !this.isMenuMusicPlaying) return;
            
            const now = this.ctx.currentTime;
            
            if (now >= this.nextBarTime - 0.1) {
                this.scheduleMenuBar(this.nextBarTime, rootMidi, scale);
                this.nextBarTime += this.barDuration;
            }
        }, 50);
        
        if (DEBUG) console.log('[PulseMusic] Menu music started');
    },
    
    stopMenuMusic() {
        if (this.menuMusicLoopId) {
            clearInterval(this.menuMusicLoopId);
            this.menuMusicLoopId = null;
        }
        this.isMenuMusicPlaying = false;
        
        // Fade out any active sounds
        this.activeOscillators.forEach(osc => {
            try { osc.stop(this.ctx.currentTime + 0.5); } catch (e) {}
        });
        this.activeOscillators = [];
        
        if (DEBUG) console.log('[PulseMusic] Menu music stopped');
    },
    
    scheduleMenuBar(barTime, rootMidi, scale) {
        if (!this.ctx) return;
        
        const beatDur = this.beatDuration;
        
        // Epic sub-bass drone on root
        this.playMenuBass(rootMidi - 12, barTime, this.barDuration * 0.9);
        
        // Dramatic pad chord (D minor with added 9th for epicness)
        const padNotes = [0, 3, 7, 14].map(i => rootMidi + (scale[i % scale.length] || i));
        this.playMenuPad(padNotes, barTime, this.barDuration * 0.95);
        
        // Slow, powerful kick pattern - softer for ambient feel
        this.playMenuKick(barTime);
        this.playMenuKick(barTime + beatDur * 2);
        
        // Track beat timing for visual sync
        this.menuLastBeatTime = barTime;
        
        // Removed hi-hats - too harsh for ambient menu music
        // Removed melody - simpler, more ambient feel
    },
    
    playMenuBass(midi, time, duration) {
        if (!this.ctx || !this.musicBus) return;
        
        const freq = 440 * Math.pow(2, (midi - 69) / 12);
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);
        
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.35, time + 0.1);  // Increased from 0.25
        gain.gain.setValueAtTime(0.35, time + duration - 0.2);
        gain.gain.linearRampToValueAtTime(0, time + duration);
        
        osc.connect(gain);
        gain.connect(this.musicBus);
        
        osc.start(time);
        osc.stop(time + duration + 0.1);
        this.activeOscillators.push(osc);
    },
    
    playMenuPad(notes, time, duration) {
        if (!this.ctx || !this.musicBus) return;
        
        notes.forEach(midi => {
            const freq = 440 * Math.pow(2, (midi - 69) / 12);
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, time);
            
            // Soft pad with slower attack/release for smoother ambient sound
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(0.05, time + 0.5);  // Increased from 0.025
            gain.gain.setValueAtTime(0.05, time + duration - 0.6);
            gain.gain.linearRampToValueAtTime(0, time + duration);  // Longer release
            
            // Lower filter frequency for warmer, less harsh sound
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(800, time);  // Reduced from 1200
            
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.musicBus);
            
            osc.start(time);
            osc.stop(time + duration + 0.1);
            this.activeOscillators.push(osc);
        });
    },
    
    playMenuKick(time) {
        if (!this.ctx || !this.musicBus) return;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.frequency.setValueAtTime(80, time);
        osc.frequency.exponentialRampToValueAtTime(40, time + 0.15);
        
        // Menu kick - increased for audibility
        gain.gain.setValueAtTime(0.4, time);  // Increased from 0.3
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
        
        osc.connect(gain);
        gain.connect(this.musicBus);
        
        osc.start(time);
        osc.stop(time + 0.5);
        this.activeOscillators.push(osc);
    },
    
    playMenuHat(time, vol = 0.05) {
        if (!this.ctx || !this.musicBus) return;
        
        // Use noise-like high frequency for hat
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(8000, time);
        
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(7000, time);
        
        gain.gain.setValueAtTime(vol, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicBus);
        
        osc.start(time);
        osc.stop(time + 0.1);
        this.activeOscillators.push(osc);
    },
    
    playMenuMelody(midi, time, duration) {
        if (!this.ctx || !this.musicBus) return;
        
        const freq = 440 * Math.pow(2, (midi - 69) / 12);
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, time);
        
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.12, time + 0.05);
        gain.gain.setValueAtTime(0.12, time + duration * 0.7);
        gain.gain.linearRampToValueAtTime(0, time + duration);
        
        osc.connect(gain);
        gain.connect(this.musicBus);
        
        osc.start(time);
        osc.stop(time + duration + 0.1);
        this.activeOscillators.push(osc);
    }
};

export default PulseMusic;
