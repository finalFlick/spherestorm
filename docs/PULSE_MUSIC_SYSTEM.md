# PULSE: Adaptive Music System Design
## Code-Driven, Memorable, Diegetic Adaptive Music for SPHERESTORM

---

## 0. CODE & CONTENT REVIEW — MUSIC INPUT INVENTORY

### Game Architecture Analysis

Based on comprehensive code review of `index.html`, the following stable identifiers and systems have been catalogued:

#### Arena System
```javascript
ARENA_CONFIG = {
  wavesPerArena: 10,
  arenas: {
    1: { name: 'The Proving Grounds', features: ['flat'], color: 0x2a2a4a },
    2: { name: 'Pillar Sanctum', features: ['flat', 'pillars'], color: 0x2a3a4a },
    3: { name: 'Sky Rise', features: ['flat', 'pillars', 'vertical'], color: 0x3a2a4a },
    4: { name: 'Platform Gardens', features: ['flat', 'pillars', 'vertical', 'platforms'], color: 0x2a4a3a },
    5: { name: 'The Labyrinth', features: ['flat', 'pillars', 'vertical', 'platforms', 'tunnels'], color: 0x4a2a3a },
    6: { name: 'Chaos Realm', features: [...all], color: 0x3a3a3a }
  }
}
```

#### Enemy Archetypes (8 Types)
| Type | Behavior | Min Arena | Musical Role |
|------|----------|-----------|--------------|
| `grunt` | chase | 1 | Rhythmic pulse |
| `shooter` | ranged | 1 | Staccato accents |
| `shielded` | tank | 1 | Heavy sub-bass |
| `fastBouncer` | bouncing | 2 | Syncopated hi-hats |
| `splitter` | splits on death | 2 | Cascading arpeggios |
| `shieldBreaker` | rush attack | 3 | Aggressive stabs |
| `waterBalloon` | grows/explodes | 3 | Swelling pads |
| `teleporter` | warping | 4 | Dissonant glitches |

#### Boss Configurations (6 Bosses)
| Arena | Boss Name | AI Type | Musical Identity |
|-------|-----------|---------|------------------|
| 1 | THE GATEKEEPER | `pillarGuardian` | Stoic, ritualistic |
| 2 | THE MONOLITH | `slimeQueen` | Organic, pulsating |
| 3 | THE ASCENDANT | `teleportingTyrant` | Glitchy, unpredictable |
| 4 | THE OVERGROWTH | `balloonKing` | Swelling, ominous |
| 5 | THE BURROWER | `tunnelWyrm` | Subterranean, rumbling |
| 6 | CHAOS INCARNATE | `chaosIncarnate` | All patterns combined |

#### Wave State Machine
```
WAVE_INTRO → WAVE_ACTIVE → WAVE_CLEAR → 
  [if wave < 10] → back to WAVE_INTRO
  [if wave = 10] → BOSS_INTRO → BOSS_ACTIVE → BOSS_DEFEATED → ARENA_TRANSITION
```

#### Player State Variables
- `gameState.health` / `gameState.maxHealth`
- `gameState.level`
- `gameState.kills`
- `gameState.score`
- `gameState.currentArena`
- `gameState.currentWave`
- `gameState.waveState`
- `gameState.bossActive`
- `enemies.length` (real-time enemy count)
- `currentBoss.health` / `currentBoss.maxHealth` (boss health %)

---

## 1. STABILITY MAP — FIXED vs ADAPTIVE PARAMETERS

### 🔒 FIXED PER ARENA (Musical Identity - NEVER Changes)

| Parameter | Description | Example (Arena 1) |
|-----------|-------------|-------------------|
| **Base Tempo Range** | BPM window (±5 max) | 120-125 BPM |
| **Key/Mode** | Root note + scale | D Dorian |
| **Leitmotif Contour** | 4-6 note melodic shape | D-F-G-A (ascending) |
| **Instrument Palette** | Core sound sources | Analog synths, tuned percussion |
| **Rhythmic Identity** | Signature groove pattern | Straight 4/4, kick-heavy |
| **Signature Sound** | Arena-defining timbre | Resonant bell strike |

### 🔄 ADAPTIVE PER MOMENT (Performance Variation)

| Parameter | Trigger | Range |
|-----------|---------|-------|
| **Layer Density** | Enemy count | 1-8 simultaneous layers |
| **Filter Cutoff** | Player health % | 200Hz - 12kHz |
| **Harmonic Tension** | Wave progress | Consonance → Dissonance |
| **Arrangement Complexity** | Boss phase | Minimal → Maximal |
| **Stinger Frequency** | Kill rate | Sparse → Dense |
| **Enemy SFX Volume** | Enemy proximity | -12dB → 0dB |

---

## 2. LEVEL FEATURE VECTOR SCHEMA

The Music Compiler extracts a deterministic `LevelFeatureVector` from arena code:

```typescript
interface LevelFeatureVector {
  // Stable Identifiers (hash inputs)
  arenaId: number;                    // 1-6
  arenaName: string;                  // "The Proving Grounds"
  features: string[];                 // ['flat', 'pillars', ...]
  groundColor: number;                // 0x2a2a4a (hex color)
  
  // Geometry Metrics
  hasVerticality: boolean;            // features.includes('vertical')
  hasPlatforms: boolean;              // features.includes('platforms')
  hasTunnels: boolean;                // features.includes('tunnels')
  hasHazards: boolean;                // features.includes('hazards')
  obstacleCount: number;              // obstacles.length after generation
  
  // Enemy Mix (available in this arena)
  availableEnemyTypes: string[];      // Filtered by minArena
  eliteChance: number;                // Based on enemy spawnWeight
  
  // Lore Tags (derived)
  loreTags: string[];                 // ['ancient', 'stone', 'guardian']
  
  // Hash for deterministic music selection
  featureHash: string;                // SHA-256 of stable properties
}
```

### Hash Calculation (Pseudocode)
```javascript
function computeFeatureHash(arena) {
  const stableData = JSON.stringify({
    id: arena.id,
    name: arena.name,
    features: arena.features.sort(),
    color: arena.color
  });
  return sha256(stableData);
}
```

**Result**: Same arena ALWAYS produces same hash → same musical identity.

---

## 3. MUSIC PROFILE SCHEMA

Generated from `LevelFeatureVector`, cached per arena:

```typescript
interface MusicProfile {
  // === FIXED IDENTITY ===
  arenaId: number;
  
  // Tempo
  baseTempo: number;                  // Center BPM
  tempoRange: [number, number];       // Min-max variation
  
  // Tonality
  rootNote: string;                   // "D", "F#", etc.
  mode: string;                       // "dorian", "phrygian", "locrian"
  scale: number[];                    // MIDI intervals [0, 2, 3, 5, 7, 9, 10]
  
  // Leitmotif
  leitmotifContour: number[];         // Interval sequence [0, 3, 5, 7]
  leitmotifRhythm: number[];          // Duration ratios [1, 1, 2, 1]
  
  // Instrumentation
  leadInstrument: string;             // "analog_lead", "glass_bell"
  bassInstrument: string;             // "sub_bass", "saw_bass"
  padInstrument: string;              // "warm_pad", "dark_strings"
  percussionKit: string;              // "kit_industrial", "kit_organic"
  
  // Signature Sound
  arenaStinger: string;               // Sound ID for arena-specific accent
  
  // === ADAPTIVE RULES ===
  
  // Enemy SFX Integration
  enemySfxRules: {
    [enemyType: string]: {
      pitchClass: number;             // 0-11 (locked to scale)
      rhythmRole: 'downbeat' | 'offbeat' | 'fill' | 'drone';
      stereoWidth: number;            // 0-1
      layerBlend: number;             // 0-1 (how much it blends vs stands out)
    }
  };
  
  // Layer Thresholds
  layerThresholds: {
    layer: string;
    enemyCountMin: number;
    enemyCountMax: number;
  }[];
  
  // Boss Music Rules
  bossProfile: {
    entranceStinger: string;
    phase1Variation: string;          // "add_drums"
    phase2Variation: string;          // "add_distortion"
    phase3Variation: string;          // "full_chaos"
    defeatResolution: string;         // "triumphant_cadence"
  };
}
```

---

## 4. ARENA MUSIC IDENTITY TABLE

### Arena 1: The Proving Grounds
**Musical Law**: *"The first heartbeat of the Pulse — simple, strong, unwavering."*

| Property | Value |
|----------|-------|
| Tempo | 120 BPM |
| Key | D Dorian |
| Leitmotif | D4 → F4 → G4 → A4 (ascending hope) |
| Lead | Warm analog synth |
| Bass | Round sub-bass |
| Percussion | Punchy kick, crisp snare |
| Signature | Resonant bell on wave start |
| Mood | Determined, foundational |

**Adaptive Behavior**:
- Waves 1-3: Drums + bass only
- Waves 4-6: Add synth pad
- Waves 7-9: Add lead melody fragments
- Wave 10: Full arrangement, tension build

---

### Arena 2: Pillar Sanctum
**Musical Law**: *"The pillars sing in ancient intervals — verticality enters the music."*

| Property | Value |
|----------|-------|
| Tempo | 126 BPM |
| Key | F# Phrygian |
| Leitmotif | F#4 → G4 → A4 → F#4 (circular mystery) |
| Lead | Glass marimba |
| Bass | Detuned saw bass |
| Percussion | Tribal toms, metallic hits |
| Signature | Stone pillar resonance (low drone) |
| Mood | Ancient, ritualistic |

**Adaptive Behavior**:
- Fast Bouncers add syncopated hi-hat patterns
- Splitters trigger cascading melodic fragments
- Pillar proximity modulates reverb depth

---

### Arena 3: Sky Rise
**Musical Law**: *"Height brings clarity — the higher you climb, the purer the tone."*

| Property | Value |
|----------|-------|
| Tempo | 132 BPM |
| Key | A Lydian |
| Leitmotif | A4 → B4 → C#5 → D#5 (ascending brightness) |
| Lead | Crystal FM bells |
| Bass | Airy sub with harmonics |
| Percussion | Light hi-hats, filtered kicks |
| Signature | Ascending arpeggio on platform touch |
| Mood | Ethereal, ascending |

**Adaptive Behavior**:
- Player height modulates high-frequency shimmer
- Shield Breakers add aggressive stab accents
- Water Balloons swell the pad volume

---

### Arena 4: Platform Gardens
**Musical Law**: *"Multiple planes, multiple voices — the Pulse fragments into harmony."*

| Property | Value |
|----------|-------|
| Tempo | 128 BPM |
| Key | C Mixolydian |
| Leitmotif | C4 → E4 → G4 → Bb4 (dominant tension) |
| Lead | Plucked synth strings |
| Bass | Growling FM bass |
| Percussion | Organic breaks, shuffled grooves |
| Signature | Garden chime cluster |
| Mood | Complex, layered |

**Adaptive Behavior**:
- Teleporters add glitchy buffer stutter
- Platform count modulates polyphony
- Multi-level combat adds call-response patterns

---

### Arena 5: The Labyrinth
**Musical Law**: *"In the maze, the music turns back on itself — echoes within echoes."*

| Property | Value |
|----------|-------|
| Tempo | 118 BPM |
| Key | E Locrian |
| Leitmotif | E4 → F4 → G4 → Bb4 (unstable descent) |
| Lead | Distorted vocal synth |
| Bass | Aggressive reese bass |
| Percussion | Industrial hits, reversed snares |
| Signature | Tunnel echo feedback loop |
| Mood | Claustrophobic, disorienting |

**Adaptive Behavior**:
- Tunnel entry triggers heavy delay/reverb
- Ambush unlocks add sudden stinger bursts
- Player disorientation (rapid direction change) fragments the beat

---

### Arena 6: Chaos Realm
**Musical Law**: *"All laws converge and collapse — the Pulse becomes unpredictable."*

| Property | Value |
|----------|-------|
| Tempo | 135 BPM (with ±8 BPM drift) |
| Key | Chromatic / Atonal center on Bb |
| Leitmotif | All previous motifs fragmented |
| Lead | Morphing wavetable |
| Bass | Layered sub + distortion |
| Percussion | Polyrhythmic chaos |
| Signature | All arena stingers randomly interlaced |
| Mood | Overwhelming, cathartic |

**Adaptive Behavior**:
- All enemy types active → all musical behaviors active
- Hazard zones add harmonic dissonance
- Boss CHAOS INCARNATE cycles through all boss themes

---

## 5. BOSS MUSIC PHASE DESIGN

### Phase Structure (All Bosses)

```
┌─────────────────────────────────────────────────────────────┐
│ ENTRANCE (0s-10s)                                           │
│ - Music dips to minimal                                     │
│ - Boss stinger plays (arena-specific)                       │
│ - Leitmotif stated in minor/corrupted form                  │
├─────────────────────────────────────────────────────────────┤
│ PHASE 1: ESTABLISHMENT (100%-66% HP)                        │
│ - Full arena music + boss layer                             │
│ - Boss attacks trigger musical accents                      │
│ - Tempo locked, no drift                                    │
├─────────────────────────────────────────────────────────────┤
│ PHASE 2: ESCALATION (66%-33% HP)                            │
│ - Additional percussion layer                               │
│ - Harmonic tension increases (add 7ths, 9ths)               │
│ - Boss attack sounds become more prominent                  │
├─────────────────────────────────────────────────────────────┤
│ PHASE 3: DESPERATION (33%-0% HP)                            │
│ - Full intensity, all layers active                         │
│ - Filter opens completely                                   │
│ - Leitmotif plays in triumphant major form                  │
│ - Boss attacks maximize musical chaos                       │
├─────────────────────────────────────────────────────────────┤
│ DEFEAT RESOLUTION                                           │
│ - 2-bar breakdown to silence                                │
│ - Triumphant stinger                                        │
│ - Leitmotif resolves to tonic                               │
│ - 4-bar victory loop while rewards spawn                    │
└─────────────────────────────────────────────────────────────┘
```

### Boss-Specific Musical Behaviors

#### THE GATEKEEPER (Arena 1)
- **Charge Attack**: Music cuts to silence → impact on hit
- **Summon**: Each spawned enemy adds a voice to the choir
- **Cooldown**: Sustained organ note

#### THE MONOLITH (Arena 2)
- **Jump Prep**: Rising pitch bend
- **Landing**: Sub-bass impact + hazard zone hiss
- **Hazard Trail**: Acidic sizzle tuned to F#

#### THE ASCENDANT (Arena 3)
- **Teleport Out**: Audio ducking + buffer stutter
- **Teleport In**: Reverse cymbal swell
- **Spawned Teleporters**: Pitch-shifted echo of main theme

#### THE OVERGROWTH (Arena 4)
- **Growth**: Swelling pad volume
- **Hazard Spawn**: Water droplet percussion
- **Mini-Boss Split**: Theme fragments into 3 voices

#### THE BURROWER (Arena 5)
- **Burrow**: Low rumble, music muffles
- **Underground**: Heartbeat-like pulse only
- **Emergence**: Explosive full-spectrum hit

#### CHAOS INCARNATE (Arena 6)
- **Pattern Cycle**: Music morphs to match current AI pattern
- **All Attacks**: Combines all previous boss sounds
- **Final Form**: All leitmotifs simultaneously (controlled cacophony)

---

## 6. ENEMY SFX → MUSIC INTEGRATION MAPPING

### Sound Design Principles

1. **Key-Locked**: All enemy SFX pitched to arena scale
2. **Rhythm-Synced**: Attack/death sounds quantized to 16th notes
3. **Spatially Integrated**: Stereo position matches screen position
4. **Dynamically Mixed**: Volume tied to threat level

### Enemy Archetype Sound Map

```typescript
const ENEMY_SFX_MAP = {
  grunt: {
    movement: { sound: 'footstep_thud', pitch: 'root', rhythm: '8th', volume: -12 },
    attack: { sound: 'punch_impact', pitch: '5th', rhythm: 'downbeat', volume: -6 },
    death: { sound: 'splat_low', pitch: 'root', rhythm: 'any', volume: -3 },
    musicalRole: 'rhythmic_foundation'
  },
  
  shooter: {
    movement: { sound: 'hover_hum', pitch: '3rd', rhythm: 'sustain', volume: -18 },
    attack: { sound: 'projectile_fire', pitch: '7th', rhythm: '16th', volume: -6 },
    death: { sound: 'electric_pop', pitch: '5th', rhythm: 'any', volume: -3 },
    musicalRole: 'melodic_accent'
  },
  
  shielded: {
    movement: { sound: 'heavy_step', pitch: 'root_sub', rhythm: 'half', volume: -9 },
    attack: { sound: 'shield_bash', pitch: 'root', rhythm: 'downbeat', volume: -3 },
    death: { sound: 'metal_crash', pitch: 'root', rhythm: 'any', volume: 0 },
    musicalRole: 'bass_reinforcement'
  },
  
  fastBouncer: {
    movement: { sound: 'bounce_ping', pitch: 'random_scale', rhythm: '16th', volume: -9 },
    attack: { sound: 'whip_crack', pitch: '9th', rhythm: 'offbeat', volume: -6 },
    death: { sound: 'pop_high', pitch: 'octave', rhythm: 'any', volume: -6 },
    musicalRole: 'syncopation'
  },
  
  splitter: {
    movement: { sound: 'wobble_mass', pitch: 'root', rhythm: 'triplet', volume: -12 },
    attack: { sound: 'slam_heavy', pitch: '4th', rhythm: 'downbeat', volume: -6 },
    death: { sound: 'split_cascade', pitch: 'arpeggio_down', rhythm: 'roll', volume: 0 },
    splitSpawn: { sound: 'birth_squelch', pitch: 'random_scale', rhythm: '32nd', volume: -9 },
    musicalRole: 'harmonic_cascade'
  },
  
  shieldBreaker: {
    movement: { sound: 'charge_buildup', pitch: 'rising', rhythm: 'accelerando', volume: -12 },
    attack: { sound: 'rush_impact', pitch: 'tritone', rhythm: 'downbeat', volume: 0 },
    death: { sound: 'armor_shatter', pitch: 'cluster', rhythm: 'any', volume: -3 },
    musicalRole: 'tension_stab'
  },
  
  waterBalloon: {
    movement: { sound: 'liquid_slosh', pitch: 'root', rhythm: 'swing', volume: -15 },
    growth: { sound: 'pressure_build', pitch: 'rising_5th', rhythm: 'swell', volume: -9 },
    explosion: { sound: 'splash_burst', pitch: 'spread_chord', rhythm: 'downbeat', volume: 0 },
    musicalRole: 'pad_swell'
  },
  
  teleporter: {
    movement: { sound: 'phase_static', pitch: 'chromatic', rhythm: 'random', volume: -12 },
    teleportOut: { sound: 'warp_out', pitch: 'descending_wholetone', rhythm: 'any', volume: -6 },
    teleportIn: { sound: 'warp_in', pitch: 'ascending_wholetone', rhythm: 'any', volume: -6 },
    attack: { sound: 'void_strike', pitch: 'tritone', rhythm: 'offbeat', volume: -6 },
    death: { sound: 'dimension_collapse', pitch: 'cluster_resolve', rhythm: 'fermata', volume: -3 },
    musicalRole: 'glitch_texture'
  }
};
```

### Dynamic Mixing Rules

```javascript
function calculateEnemySfxVolume(enemy, player) {
  const distance = enemy.position.distanceTo(player.position);
  const maxDistance = 30;
  const minVolume = -24; // dB
  const maxVolume = enemy.sfxConfig.volume;
  
  // Distance attenuation
  let volume = lerp(maxVolume, minVolume, distance / maxDistance);
  
  // Threat multiplier (low health = louder warnings)
  const playerHealthPercent = gameState.health / gameState.maxHealth;
  if (playerHealthPercent < 0.3) volume += 3;
  
  // Elite/Boss priority
  if (enemy.isElite) volume += 3;
  if (enemy.isBoss) volume += 6;
  
  return clamp(volume, -30, 0);
}
```

---

## 7. RUNTIME ADAPTATION RULES

### Transition Timing

All musical transitions are **quantized to musical boundaries**:

| Transition Type | Quantize To | Crossfade Duration |
|-----------------|-------------|-------------------|
| Layer add/remove | 1 bar | 2 beats |
| Filter sweep | Continuous | N/A |
| Tempo shift | 4 bars | 4 bars |
| Key change | 8 bars | 1 bar silence bridge |
| Boss entrance | Immediate | 0 (hard cut) |
| Boss phase change | 2 bars | 2 bars |

### Hysteresis (Prevent Jitter)

```javascript
const HYSTERESIS_CONFIG = {
  layerChange: {
    threshold: 3,      // Enemy count must change by 3+ to trigger
    cooldown: 2000     // ms before next change allowed
  },
  tensionChange: {
    threshold: 0.1,    // Health % must change by 10%+
    cooldown: 1000
  },
  filterChange: {
    smoothingFactor: 0.05  // Exponential smoothing
  }
};
```

### Real-Time Parameter Mapping

```javascript
function updateMusicParameters(gameState) {
  const music = activeMusicProfile;
  
  // LAYER DENSITY (enemy count)
  const enemyCount = enemies.length + (currentBoss ? 5 : 0);
  music.setLayerDensity(mapRange(enemyCount, 0, 20, 1, 8));
  
  // FILTER CUTOFF (player health)
  const healthPercent = gameState.health / gameState.maxHealth;
  const targetCutoff = mapRange(healthPercent, 0, 1, 200, 12000);
  music.smoothFilterTo(targetCutoff, HYSTERESIS_CONFIG.filterChange.smoothingFactor);
  
  // HARMONIC TENSION (wave progress)
  const waveProgress = gameState.currentWave / WAVES_PER_ARENA;
  music.setHarmonicTension(waveProgress); // 0 = consonant, 1 = dissonant
  
  // TEMPO MICRO-VARIATION (combat intensity)
  const killsPerMinute = calculateKillRate();
  const tempoOffset = mapRange(killsPerMinute, 0, 60, -2, 3);
  music.setTempo(music.baseTempo + tempoOffset);
  
  // BOSS PHASE (if active)
  if (currentBoss && gameState.bossActive) {
    const bossHealthPercent = currentBoss.health / currentBoss.maxHealth;
    if (bossHealthPercent < 0.33) music.setBossPhase(3);
    else if (bossHealthPercent < 0.66) music.setBossPhase(2);
    else music.setBossPhase(1);
  }
}
```

### Wave State Musical Responses

```javascript
const WAVE_STATE_MUSIC = {
  WAVE_INTRO: {
    action: 'playWaveStinger',
    layerState: 'minimal',
    filterState: 'opening_sweep'
  },
  WAVE_ACTIVE: {
    action: 'enableAdaptiveLayers',
    layerState: 'dynamic',
    filterState: 'responsive'
  },
  WAVE_CLEAR: {
    action: 'playResolutionPhrase',
    layerState: 'sustain_current',
    filterState: 'open'
  },
  BOSS_INTRO: {
    action: 'playBossStinger',
    layerState: 'silence_then_build',
    filterState: 'close_then_sweep'
  },
  BOSS_ACTIVE: {
    action: 'enableBossMusic',
    layerState: 'boss_layers',
    filterState: 'phase_responsive'
  },
  BOSS_DEFEATED: {
    action: 'playVictoryFanfare',
    layerState: 'triumphant',
    filterState: 'wide_open'
  },
  ARENA_TRANSITION: {
    action: 'crossfadeToNewArena',
    layerState: 'fade_out',
    filterState: 'gradual_close'
  }
};
```

---

## 8. THE PULSE LEITMOTIF SYSTEM

### Core Motif (4 Notes)

The **Pulse Motif** appears in every arena, boss fight, and victory:

```
Notes: D4 - F4 - G4 - A4
Intervals: 0 - 3 - 5 - 7 (minor 3rd, major 2nd, major 2nd)
Rhythm: ♩ ♩ ♩. ♪ (quarter, quarter, dotted quarter, eighth)
```

### Motif Variations by Context

| Context | Transformation |
|---------|----------------|
| **Arena Intro** | Full, confident, major quality |
| **Low Health** | Fragmented, tremolo, minor quality |
| **High Combo** | Octave doubled, triumphant |
| **Boss Entrance** | Inverted (A-G-F-D), ominous |
| **Boss Phase 3** | Original + inversion simultaneously |
| **Victory** | Extended to 8 notes, resolves to tonic |
| **Game Over** | Slowed 50%, descending, fades out |

### Motif in Enemy SFX

Subtle motif fragments appear in:
- **Elite enemy spawn**: First 2 notes as warning
- **Boss attack wind-up**: Inverted first 2 notes
- **Critical health pickup**: Full motif, fast, bright

---

## 9. IMPLEMENTATION ARCHITECTURE

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                      PULSE MUSIC ENGINE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │   MUSIC     │    │   LEVEL     │    │   MUSIC     │         │
│  │  COMPILER   │───▶│  FEATURE    │───▶│  PROFILE    │         │
│  │             │    │  VECTOR     │    │   CACHE     │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│         │                                     │                 │
│         ▼                                     ▼                 │
│  ┌─────────────────────────────────────────────────────┐       │
│  │              ADAPTIVE MIXER                          │       │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │       │
│  │  │  LAYER  │ │ FILTER  │ │ TENSION │ │  TEMPO  │   │       │
│  │  │ MANAGER │ │ CONTROL │ │ CONTROL │ │ CONTROL │   │       │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘   │       │
│  └─────────────────────────────────────────────────────┘       │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────────────────┐       │
│  │              SFX INTEGRATION LAYER                   │       │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │       │
│  │  │  ENEMY  │ │  BOSS   │ │ PLAYER  │ │  ENV    │   │       │
│  │  │   SFX   │ │   SFX   │ │   SFX   │ │   SFX   │   │       │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘   │       │
│  └─────────────────────────────────────────────────────┘       │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────────────────┐       │
│  │              WEB AUDIO OUTPUT                        │       │
│  │  Master Bus → Compressor → Limiter → Destination    │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Minimal Integration Points (Code Hooks)

```javascript
// 1. ARENA CHANGE - In generateArena()
function generateArena(arenaNumber) {
  // ... existing code ...
  PulseMusic.loadArenaProfile(arenaNumber);  // ← ADD
}

// 2. WAVE STATE CHANGE - In wave state handlers
function handleWaveIntro() {
  // ... existing code ...
  PulseMusic.onWaveStart(gameState.currentWave);  // ← ADD
}

// 3. BOSS SPAWN - In spawnBoss()
function spawnBoss(arenaNumber) {
  // ... existing code ...
  PulseMusic.onBossStart(arenaNumber);  // ← ADD
}

// 4. BOSS DEFEAT - In killBoss()
function killBoss() {
  // ... existing code ...
  PulseMusic.onBossDefeat();  // ← ADD
}

// 5. GAME LOOP - In animate()
function animate() {
  // ... existing code ...
  PulseMusic.update(gameState, enemies, currentBoss);  // ← ADD
}

// 6. ENEMY EVENTS - In updateEnemies() and kill handlers
function onEnemySpawn(enemy) { PulseMusic.onEnemySpawn(enemy); }
function onEnemyDeath(enemy) { PulseMusic.onEnemyDeath(enemy); }
function onEnemyAttack(enemy) { PulseMusic.onEnemyAttack(enemy); }

// 7. PLAYER EVENTS
function takeDamage(amount) {
  // ... existing code ...
  PulseMusic.onPlayerDamage(gameState.health / gameState.maxHealth);  // ← ADD
}
```

---

## 10. TECHNICAL REQUIREMENTS

### Audio Assets Needed

#### Per Arena (6 sets)
- 8 music layers (stems) at matching tempo/key
- 1 arena stinger (wave start)
- 1 victory phrase
- 1 transition fade

#### Per Boss (6 sets)
- 1 entrance stinger
- 3 phase variation stems
- 1 defeat fanfare

#### Per Enemy Type (8 sets)
- Movement loop/one-shot
- Attack sound (pitched)
- Death sound (pitched)
- Special ability sound (if applicable)

#### Global
- Pulse leitmotif (multiple variations)
- Low health warning drone
- Level up chime
- Game over sting

### Web Audio API Structure

```javascript
const audioContext = new AudioContext();

// Master chain
const masterGain = audioContext.createGain();
const masterCompressor = audioContext.createDynamicsCompressor();
const masterLimiter = audioContext.createDynamicsCompressor();

masterGain.connect(masterCompressor);
masterCompressor.connect(masterLimiter);
masterLimiter.connect(audioContext.destination);

// Music bus (8 layer channels)
const musicBus = audioContext.createGain();
const musicLayers = Array(8).fill(null).map(() => ({
  source: null,
  gain: audioContext.createGain(),
  filter: audioContext.createBiquadFilter()
}));

// SFX bus (enemy sounds)
const sfxBus = audioContext.createGain();
const sfxPool = new AudioPool(32); // Object pool for enemy SFX
```

---

## 11. VALIDATION CHECKLIST

### Before Implementation

- [ ] All 6 arena MusicProfiles defined with unique identities
- [ ] LevelFeatureVector hashing produces consistent results
- [ ] Enemy SFX scales match arena keys
- [ ] Boss music phases mapped to HP thresholds
- [ ] Leitmotif variations created for all contexts

### During Implementation

- [ ] Layer transitions sound smooth (no clicks/pops)
- [ ] Filter sweeps are inaudible as "effects" (feel natural)
- [ ] Enemy SFX enhance rhythm without cluttering
- [ ] Boss music phases feel dramatic, not jarring
- [ ] Same arena sounds identical on replay (identity preserved)

### After Implementation

- [ ] Playtest: Can identify arena by music alone?
- [ ] Playtest: Does intensity feel connected to gameplay?
- [ ] Playtest: Do enemy sounds feel "part of the music"?
- [ ] Playtest: Is boss music memorable and climactic?
- [ ] Playtest: Does the Pulse motif feel like a presence?

---

## 12. DESIGN NORTH STAR

> **"The arena always sings the same song — but how it performs it depends on how well you survive inside it."**

### What Players Should Experience

1. **Recognition**: "Oh, it's the Pillar Sanctum theme" within 3 seconds
2. **Immersion**: Enemy sounds feel like instruments, not noise
3. **Tension**: Music reflects danger without being annoying
4. **Triumph**: Boss defeat feels like a musical climax
5. **Memory**: Humming the theme after closing the game

### What the Music Should NEVER Do

- ❌ Sound random or procedurally "generated"
- ❌ Change so much that identity is lost
- ❌ Make enemy sounds feel disconnected
- ❌ Distract from gameplay
- ❌ Reset or restart noticeably between waves

---

## APPENDIX A: FUTURE EXTENSIONS

### Combo System Integration (If Added)
- High combo = brighter filter
- Combo break = musical "stumble" (beat skip)
- Max combo = leitmotif plays in full

### Multiplayer Adaptation (If Added)
- Player count modulates layer count
- Spatial audio per player
- Shared intensity affects shared music

### Procedural Arena Generation (If Added)
- Feature vector extracts from generated geometry
- More features = denser music profile
- Hash includes seed for consistency

---

## APPENDIX B: REFERENCE GAMES

| Game | What to Learn |
|------|--------------|
| **Hades** | How leitmotifs persist across areas |
| **DOOM 2016** | How intensity layers work |
| **Risk of Rain 2** | How music scales with chaos |
| **Hotline Miami** | How music defines arena identity |
| **Rez** | How SFX integrate with music |
| **Crypt of the NecroDancer** | How rhythm and gameplay merge |

---

*Document Version: 1.0*
*Generated from SPHERESTORM codebase analysis*
*Designed for the Pulse — the heartbeat of the arena*
