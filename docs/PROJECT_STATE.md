# Manta Sphere - Project State

Current implementation status and known issues. Update this as the codebase evolves.

**Last Updated:** 2026-02-01

---

## What's Working

### Core Gameplay
- Player movement (WASD), jumping (SPACE), dashing (SHIFT)
- Third-person camera with mouse look
- Automatic shooting at nearest enemy
- Vertical aim lock-on to enemies
- Collision with obstacles and platforms
- Multi-bounce landing system

### Visual Effects
- Neon player trail (cyan → blue fade)
- Particle effects on hits, pickups, deaths
- Damage flash screen effect
- Enemy shrink-on-damage and hit flash
- Boss glow aura

### Arena System
- 6 arenas with progressive complexity
- Tiered wave counts (3/5/6/8/8/10)
- Arena-specific geometry generation
- Smooth arena transitions

### Enemy System
- 8 enemy types with distinct behaviors
- Config-driven visual profiles (unique silhouette attachments per type)
- Movement signatures (sway, strafe, wobble, squash, stutter, etc.)
- Telegraph cues before attacks (visual glow, compression, flicker)
- Unique death VFX per enemy type (burst, shatter, splash, glitch, etc.)
- Weighted spawn system
- Arena-gated enemy unlocks
- Enemy scaling with progression
- Enemy jumping (unlocked after Arena 2)
- Size bands: Swarm (0.30-0.40), Standard (0.45-0.62), Heavy (0.70-0.95)

### Boss System
- 6 unique bosses with modular ability system
- Accumulated tactics (each boss inherits previous boss abilities)
- Boss health bar UI
- Phase transitions at 66% and 33% HP (with combo patterns in later phases)
- Anti-stuck heuristics (strafe, jump bailout, teleport bailout)
- Guaranteed heart drop on defeat
- Persistent arena badge on defeat

### Progression
- XP gems from kills
- Level-up with 3 random upgrade choices
- 8 upgrade types
- Heart pickups for healing

### Badge System
- 8 stat badges (earned during run)
- 6 arena mastery badges (persistent)
- Badge panel in HUD
- Badge unlock celebrations

### Leaderboard
- Top 10 local scores
- Name entry (3 characters)
- Tracks score, arena, wave, level, badges, time
- Viewable from main menu

### Music (PULSE System)
- Procedural adaptive music
- Arena-specific profiles
- Intensity-based layering
- Boss phase transitions
- Game event stingers
- M key toggle

### UI
- Health bar, XP bar, level display
- Arena/wave indicators
- Timer and score
- Kill counter
- Pause menu (ESC)
- Game over screen with stats

---

## Known Issues

*No critical issues currently documented.*

### Minor Issues
- None documented yet

### Technical Debt
- None documented yet

---

## What Each System Should Do

### Player (`js/entities/player.js`)
- Handle all player input and movement
- Manage dash cooldown
- Track player mesh and position
- Provide player state to other systems

### Enemies (`js/entities/enemies.js`)
- Spawn enemies based on wave config
- Build enemy meshes from visual profiles (silhouette attachments)
- Update enemy AI each frame with movement signatures
- Handle enemy-specific behaviors (shoot, teleport, split, etc.)
- Manage telegraph state before attacks
- Manage enemy death with type-specific VFX

### Boss (`js/entities/boss.js`)
- Spawn arena-appropriate boss after final wave
- Run unified modular AI with ability modules
- Each boss inherits ALL previous boss abilities (accumulated tactics)
- Anti-stuck detection and recovery (strafe, jump bailout, teleport bailout)
- Track boss phases (100-66%, 66-33%, 33-0%) with pattern changes
- Phase combos: higher phases chain abilities together
- Handle boss defeat and rewards

### Wave System (`js/systems/waveSystem.js`)
- Progress through wave states (intro → active → clear)
- Spawn enemies per wave config
- Trigger boss after final wave
- Handle arena transitions

### Badges (`js/systems/badges.js`)
- Track stat thresholds during run
- Award stat badges when thresholds met
- Award arena badges on boss defeat
- Persist arena badges to localStorage

### Leaderboard (`js/systems/leaderboard.js`)
- Save scores to localStorage
- Load and sort leaderboard
- Check if score qualifies for top 10
- Format entries for display

### PULSE Music (`js/systems/pulseMusic.js`)
- Generate arena music profiles from config
- Layer music based on intensity
- Respond to wave and boss state changes
- Play event stingers

### Arena Generator (`js/arena/generator.js`)
- Clear previous arena geometry
- Generate arena-specific obstacles
- Create ground, pillars, platforms, tunnels, hazards
- Set arena lighting and colors

---

## Architecture Overview

```
index.html
    ↓ loads
js/main.js (entry point, game loop)
    ↓ imports
├── js/core/
│   ├── gameState.js    ← Central state object
│   ├── entities.js     ← Shared entity arrays
│   ├── scene.js        ← Three.js scene/camera/renderer
│   └── input.js        ← Input handling
│
├── js/config/          ← Data-driven configuration
│   ├── arenas.js
│   ├── bosses.js
│   ├── enemies.js
│   ├── badges.js
│   ├── upgrades.js
│   └── constants.js
│
├── js/entities/        ← Game objects
│   ├── player.js
│   ├── enemies.js
│   └── boss.js
│
├── js/systems/         ← Game logic
│   ├── waveSystem.js
│   ├── badges.js
│   ├── leaderboard.js
│   ├── pulseMusic.js
│   ├── damage.js
│   ├── pickups.js
│   └── projectiles.js
│
├── js/arena/
│   └── generator.js    ← Procedural arena building
│
├── js/effects/
│   ├── particles.js
│   └── trail.js
│
└── js/ui/
    ├── hud.js
    ├── menus.js
    └── leaderboardUI.js
```

---

## State Flow

```
MAIN MENU
    ↓ Start Game
ARENA 1, WAVE 1
    ↓ Clear wave
ARENA 1, WAVE 2
    ↓ ...
ARENA 1, WAVE 3 (final)
    ↓ Clear wave
BOSS FIGHT (Arena 1)
    ↓ Defeat boss
ARENA 2, WAVE 1
    ↓ ...repeat...
ARENA 6 BOSS
    ↓ Defeat
VICTORY → Leaderboard
```

---

## How to Update This Document

**When fixing a bug:**
1. Remove it from Known Issues
2. Note the fix in commit message

**When finding a bug:**
1. Add to Known Issues with description
2. Note steps to reproduce if complex

**When adding a feature:**
1. Add to "What's Working" section
2. Update system descriptions if behavior changed

**When refactoring:**
1. Update Architecture Overview if structure changed
2. Update system descriptions

