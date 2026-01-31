# SPHERESTORM - Feature List

## Design Philosophy

SPHERESTORM is an **arcade-style score runner** with:
- **Progressive arena complexity** - Each arena teaches new mechanics
- **Boss fights as mastery tests** - Bosses puzzle together learned skills
- **Fast early loops** - Short early arenas reduce friction, enable more attempts
- **Visual progression** - Badges show investment and achievement
- **Local competition** - Leaderboards drive replayability

---

## Current Features (Implemented)

### Core Gameplay

#### Player Mechanics
- [x] Third-person camera with mouse look
- [x] WASD movement with configurable speed
- [x] Jumping with physics-based gravity
- [x] Multi-bounce landing system (bounces decay: 45% → 20% → 8%)
- [x] Squash/stretch animation on landing
- [x] Dash ability with 1-second cooldown
- [x] Automatic shooting targeting nearest enemies
- [x] Vertical aim lock-on (projectiles auto-aim to enemy Y position)
- [x] Collision with obstacles (sliding along walls)
- [x] Platform interaction (can jump onto and stand on platforms)

#### Visual Effects
- [x] Neon player trail (ground-level, fades cyan → blue)
- [x] Particle effects on hits, pickups, deaths
- [x] Damage flash screen effect
- [x] Enemy shrink-on-damage feedback
- [x] Enemy hit flash (white flash on hit)
- [x] Boss glow aura

### Badge System

#### Stat-Based Badges (Earned During Run)
| Badge | Icon | Requirement |
|-------|------|-------------|
| Rapid Fire | ⚡ | Attack Speed ≥ 1.2x |
| Multi-Shot | 🎯 | Projectile Count ≥ 2 |
| Power Shot | ⚔️ | Damage ≥ 15 |
| Sniper | 💨 | Projectile Speed ≥ 1.2x |
| Speedster | 👟 | Move Speed ≥ 0.2 |
| Tank | ❤️ | Max Health ≥ 150 |
| Collector | 🧲 | Pickup Range ≥ 5 |
| Scholar | ✨ | XP Multiplier ≥ 1.4x |

#### Arena Mastery Badges (Persistent)
| Badge | Icon | Arena | Boss |
|-------|------|-------|------|
| Initiate | 🏆 | 1 | The Pillar Guardian |
| Bulwark Breaker | 🛡️ | 2 | The Slime Queen |
| Ascension Adept | ⬆️ | 3 | The Teleporting Tyrant |
| Platform Knight | 👑 | 4 | The Balloon King |
| Maze Runner | 🌀 | 5 | The Tunnel Wyrm |
| Chaos Conqueror | 💀 | 6 | Chaos Incarnate |

### Local Leaderboard

- [x] Top 10 scores saved to LocalStorage
- [x] Tracks: Name (3 chars), Score, Arena, Wave, Level, Badges, Time
- [x] High score entry form on qualifying runs
- [x] Leaderboard accessible from main menu
- [x] Sorted by score (highest first)
- [x] Persists between sessions

### Arena Progression (Tiered Waves)

| Arena | Name | Waves | New Features | What It Teaches |
|-------|------|-------|--------------|-----------------|
| 1 | The Training Grounds | 3 | Flat ground | Move, shoot, dodge |
| 2 | Obstacle Field | 5 | + Pillars, cover | Cover & movement synergy |
| 3 | Vertical Loop | 6 | + Platforms, ramps | Z-axis awareness, jumping |
| 4 | Platform Gardens | 8 | + Corner platforms | Height advantage, gap management |
| 5 | The Labyrinth | 8 | + Tunnel walls | Corridor pressure, line control |
| 6 | Chaos Realm | 10 | + Hazard zones | Everything combined |

### Enemy System
- [x] 8 unique enemy types with different behaviors
- [x] Weighted spawn system (rarer enemies in later waves)
- [x] Arena-gated enemy unlocks
- [x] Enemy scaling with arena/wave progression
- [x] Enemy jumping (unlocked after Arena 2 boss)

**Enemy Types:**
| Type | Behavior | Min Arena |
|------|----------|-----------|
| Grunt | Basic chase AI | 1 |
| Shooter | Maintains distance, fires projectiles | 1 |
| Shielded | 50% damage reduction | 1 |
| Fast Bouncer | Bounces off walls, slight homing | 2 |
| Splitter | Splits into 3 smaller enemies on death | 2 |
| Shield Breaker | Charges at player when in range | 3 |
| Water Balloon | Grows over time, explodes into hazard zone | 3 |
| Teleporter | Teleports near player periodically | 4 |

### Boss System

Bosses are **puzzle tests** of arena mechanics, not just bullet sponges.

| Boss | Arena | Mechanics Tested | Puzzle Element |
|------|-------|------------------|----------------|
| The Pillar Guardian | 1 | Movement, dodging | Charge attack timing, minion management |
| The Slime Queen | 2 | Cover usage | Hazard avoidance, spawn control |
| The Teleporting Tyrant | 3 | Spatial awareness | Predict teleport patterns |
| The Balloon King | 4 | Platform control | Height management, split phase |
| The Tunnel Wyrm | 5 | Corridor navigation | Burrow prediction, emerge timing |
| Chaos Incarnate | 6 | All mechanics | Adapting to cycling abilities |

**Boss Features:**
- [x] Phase-based difficulty (phases at 66% and 33% health)
- [x] Boss-specific AI patterns
- [x] Boss health bar UI
- [x] Guaranteed heart drop on boss kill
- [x] Boss minion spawning
- [x] Persistent badge awarded on defeat

### Upgrade System
- [x] Level up on XP thresholds
- [x] 3 random upgrades offered per level
- [x] 8 upgrade types affecting different stats
- [x] Multiplicative and additive stat modifiers

### Pickups
- [x] XP gems from killed enemies
- [x] Heart pickups for healing (15/25/50 HP)
- [x] Magnetic attraction to player
- [x] Heart TTL with fade-out

### UI/HUD
- [x] Health bar with percentage fill
- [x] XP bar with level display
- [x] Arena and wave indicators (with tiered counts)
- [x] Timer and score display
- [x] Kill counter
- [x] **Badge panel** showing active stat badges
- [x] Boss health bar
- [x] Wave/Boss announcements
- [x] Unlock notifications
- [x] **Badge unlock celebrations**
- [x] Pause indicator
- [x] Game over screen with stats
- [x] **Leaderboard screen**
- [x] **High score entry form**
- [x] **Badge collection screen**

---

## Replayability Design

### Why Players Return
1. **Beat your score** - Leaderboard competition
2. **Earn badges** - Visual progression markers
3. **Master arenas** - Each arena has distinct skills
4. **Unlock cosmetics** - Persistent arena mastery badges
5. **Faster loops** - Short early arenas = more attempts

### Progression Loops

| Loop | Duration | Reward |
|------|----------|--------|
| Wave | 30-60s | XP, health |
| Arena | 2-8 min | Boss fight, badge |
| Run | 15-30 min | Leaderboard position |
| Meta | Sessions | Mastery badge collection |

---

## Potential Future Features

### Gameplay Enhancements
- [ ] Weapon variety (different shooting patterns)
- [ ] Active abilities with cooldowns
- [ ] Combo system for chained kills
- [ ] Critical hits
- [ ] Score multipliers for combos

### Enemy Enhancements
- [ ] Elite enemy variants with modifiers
- [ ] Enemy formations/group tactics
- [ ] Flying enemies

### Arena Enhancements
- [ ] Moving platforms
- [ ] Destructible obstacles
- [ ] Arena modifiers (low gravity, darkness)

### Progression
- [ ] Daily challenges
- [ ] Challenge modes (time attack, boss rush)
- [ ] Achievements
- [ ] Ghost replay of top runs

### Visual/Audio
- [ ] Sound effects
- [ ] Music
- [ ] Screen shake on impacts
- [ ] Post-processing effects

### Quality of Life
- [ ] Settings menu
- [ ] Statistics tracking
- [ ] Run history

---

## Known Limitations

1. **No audio** - Game is currently silent
2. **No cloud saves** - Progress is local only
3. **Desktop only** - No mobile support
4. **Single player** - No multiplayer
