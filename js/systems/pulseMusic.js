// ============================================================================
// PULSE ADAPTIVE MUSIC SYSTEM - Generic, Data-Driven, Diegetic
// Automatically adapts to changes in ARENA_CONFIG, ENEMY_TYPES, BOSS_CONFIG
// ============================================================================

import { ARENA_CONFIG } from '../config/arenas.js';
import { ENEMY_TYPES } from '../config/enemies.js';
import { BOSS_CONFIG } from '../config/bosses.js';

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
            
            // Music bus with filter
            this.musicBus = this.ctx.createGain();
            this.musicBus.gain.value = 0.7;
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
            
            this.initialized = true;
            console.log('[PulseMusic] Initialized with', Object.keys(this.arenaProfiles).length, 'arena profiles');
        } catch (e) {
            console.warn('[PulseMusic] Web Audio not available:', e);
            this.enabled = false;
        }
    },
    
    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
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
        
        console.log('[PulseMusic] Loaded arena', arenaId, '-', profile.name, '- Key:', profile.rootNote, profile.scale, '- BPM:', this.bpm);
    },
    
    // ============================================================================
    // MUSIC LOOP
    // ============================================================================
    
    startMusicLoop() {
        if (!this.enabled || !this.initialized || !this.ctx) return;
        
        this.stopMusicLoop();
        this.nextBarTime = this.ctx.currentTime + 0.1;
        this.musicLoopId = setInterval(() => this.musicTick(), 50);
        console.log('[PulseMusic] Music loop started');
    },
    
    stopMusicLoop() {
        if (this.musicLoopId) {
            clearInterval(this.musicLoopId);
            this.musicLoopId = null;
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
        
        const noteDuration = this.beatDuration / 4;
        for (let i = 0; i < 16; i++) {
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
            osc.type = 'square';
            osc.frequency.setValueAtTime(8000, time);
            gain.gain.setValueAtTime(0.1 * volumeMod, time);
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
        if (!this.enabled || !this.initialized || !this.currentProfile) return;
        
        const profile = this.enemySfxProfiles[enemy.typeName] || this.enemySfxProfiles['grunt'];
        if (!profile) return;
        
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        const baseNote = this.currentProfile.rootMidi + profile.pitchClass + profile.colorPitchMod;
        
        if (event === 'spawn') {
            osc.type = profile.waveform;
            osc.frequency.setValueAtTime(this.midiToFreq(baseNote + 12), now);
            osc.frequency.exponentialRampToValueAtTime(this.midiToFreq(baseNote), now + 0.2);
            gain.gain.setValueAtTime(profile.baseVolume * 0.3, now);
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
        if (!this.enabled || !this.initialized || !this.currentProfile) return;
        
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
        if (!this.enabled || !this.initialized || !this.currentProfile) return;
        
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
        if (!this.enabled || !this.initialized || !this.currentProfile) return;
        
        const profile = this.currentProfile;
        const now = this.ctx.currentTime;
        
        const majorScale = [0, 2, 4, 5, 7, 9, 11];
        const notes = [0, 2, 4, 7].map(d => profile.rootMidi + 12 + majorScale[d % majorScale.length]);
        
        let time = now;
        notes.forEach((note, i) => {
            this.playLead(note, time, 0.25, profile);
            time += 0.15;
        });
        
        const chord = [0, 4, 7].map(d => profile.rootMidi + majorScale[d]);
        this.playChord(chord, now + 0.6, 1.5, profile);
    },
    
    playDamageStinger(healthPercent) {
        if (!this.enabled || !this.initialized || !this.currentProfile) return;
        
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
        if (!this.enabled || !this.initialized || !this.currentProfile) return;
        
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
    },
    
    // ============================================================================
    // EVENT HANDLERS
    // ============================================================================
    
    onArenaChange(arenaId) {
        this.loadArena(arenaId);
    },
    
    onWaveStart(waveNum) {
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
        this.playBossStinger();
    },
    
    onBossPhaseChange(phase) {
        this.bossPhase = phase;
        if (this.currentProfile) {
            this.playStab(this.currentProfile.rootMidi + 12, this.ctx.currentTime, this.currentProfile);
        }
    },
    
    onBossDefeat() {
        this.bossPhase = 0;
        this.playVictoryStinger();
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
    // UTILITY
    // ============================================================================
    
    setMasterVolume(vol) {
        if (this.masterGain) {
            this.masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, vol)), this.ctx.currentTime);
        }
    },
    
    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled) {
            this.stop();
        }
    },
    
    toggle() {
        this.setEnabled(!this.enabled);
        return this.enabled;
    }
};

export default PulseMusic;
