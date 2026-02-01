# SPHERESTORM - Epics & Feature Tracking

This document tracks major features and initiatives. Update status as work progresses.

---

## Status Legend

| Status | Meaning |
|--------|---------|
| **Done** | Fully implemented and working |
| **In Progress** | Currently being worked on |
| **Planned** | Designed but not started |
| **Idea** | Concept only, needs design |

---

## Core Systems

### Epic: Arena Progression System
**Status:** Done

Progressive arena system with tiered wave counts and unique mechanics per arena.

| Arena | Waves | Mechanic | Status |
|-------|-------|----------|--------|
| 1 - Training Grounds | 3 | Flat ground | Done |
| 2 - Obstacle Field | 5 | Pillars & cover | Done |
| 3 - Vertical Loop | 6 | Platforms & ramps | Done |
| 4 - Platform Gardens | 8 | Multi-level terrain | Done |
| 5 - The Labyrinth | 8 | Tunnel walls | Done |
| 6 - Chaos Realm | 10 | Hazard zones | Done |

**Files:** `js/config/arenas.js`, `js/arena/generator.js`, `js/systems/waveSystem.js`

---

### Epic: Boss System
**Status:** Done

Six unique bosses with modular ability system and accumulated tactics.

| Boss | Arena | Abilities | Inherits | Status |
|------|-------|-----------|----------|--------|
| The Gatekeeper | 1 | Charge + Summon | (base) | Done |
| The Monolith | 2 | Jump Slam + Hazards | + Arena 1 | Done |
| The Ascendant | 3 | Teleport | + Arena 1-2 | Done |
| The Overgrowth | 4 | Growth + Split | + Arena 1-3 | Done |
| The Burrower | 5 | Burrow/Emerge | + Arena 1-4 | Done |
| Chaos Incarnate | 6 | All abilities | ALL | Done |

**Features:**
- Modular ability system with config-driven flags
- Anti-stuck heuristics (strafe, jump bailout, teleport bailout)
- Phase patterns with ability combos (Phase 2/3)
- Shorter tells in higher phases

**Files:** `js/config/bosses.js`, `js/entities/boss.js`

---

### Epic: Enemy System  
**Status:** Done

Eight enemy types with unique visual profiles for instant recognition.

| Enemy | Size Band | Visual Profile | Movement | Death VFX | Status |
|-------|-----------|----------------|----------|-----------|--------|
| Grunt | Standard | Spikes | Sway | Burst | Done |
| Shooter | Standard | Turret | Strafe | Spark Ring | Done |
| Shielded | Heavy | Ring | Stomp | Shatter | Done |
| Fast Bouncer | Swarm | Springs | Squash | Streak | Done |
| Splitter | Heavy | Cracks | Inertia | Crack Split | Done |
| Shield Breaker | Standard | Horns | Jitter | Shock Cone | Done |
| Water Balloon | Standard | Transparent | Wobble | Splash | Done |
| Teleporter | Standard | Ghosts | Stutter | Glitch | Done |

**Features:**
- Config-driven visual profiles (silhouette attachments)
- Movement signatures per enemy type
- Telegraph cues before attacks
- Unique death VFX per type
- Size bands: Swarm (0.30-0.40), Standard (0.45-0.62), Heavy (0.70-0.95)

**Files:** `js/config/enemies.js`, `js/entities/enemies.js`, `js/effects/particles.js`

---

### Epic: Badge System
**Status:** Done

Stat badges (earned during run) and arena mastery badges (persistent).

| Category | Count | Status |
|----------|-------|--------|
| Stat badges | 8 | Done |
| Arena mastery badges | 6 | Done |

**Files:** `js/config/badges.js`, `js/systems/badges.js`

---

### Epic: Leaderboard System
**Status:** Done

Local top 10 with name entry, score tracking, and badge display.

**Files:** `js/config/leaderboard.js`, `js/systems/leaderboard.js`, `js/ui/leaderboardUI.js`

---

### Epic: PULSE Adaptive Music
**Status:** Done

Procedural music that adapts to gameplay intensity, arena, and boss phases.

| Feature | Status |
|---------|--------|
| Arena-specific profiles | Done |
| Intensity layering | Done |
| Boss phase music | Done |
| Game event stingers | Done |
| M key toggle | Done |

**Files:** `js/systems/pulseMusic.js`  
**Design Doc:** `docs/PULSE_MUSIC_SYSTEM.md`

---

## Planned Features

### Epic: Sound Effects
**Status:** Planned

Add sound effects for gameplay actions.

| Feature | Status |
|---------|--------|
| Hit sounds | Planned |
| Pickup sounds | Planned |
| UI sounds | Planned |
| Enemy sounds | Planned |

---

### Epic: Visual Polish
**Status:** Idea

Enhance visual feedback and effects.

| Feature | Status |
|---------|--------|
| Screen shake | Idea |
| Post-processing | Idea |
| Better particles | Idea |

---

### Epic: Gameplay Enhancements
**Status:** Idea

Future gameplay additions.

| Feature | Status |
|---------|--------|
| Weapon variety | Idea |
| Active abilities | Idea |
| Combo system | Idea |
| Score multipliers | Idea |

---

### Epic: Quality of Life
**Status:** Idea

Player experience improvements.

| Feature | Status |
|---------|--------|
| Settings menu | Idea |
| Statistics tracking | Idea |
| Run history | Idea |

---

## How to Update This Document

When starting work on a feature:
1. Change status from "Planned" to "In Progress"
2. Add any relevant sub-tasks
3. Note the files being modified

When completing a feature:
1. Change status to "Done"
2. Update the files list
3. Add any follow-up tasks discovered

When adding new epics:
1. Add a new section with Status, description, task table
2. Include relevant file paths
3. Add acceptance criteria if complex

