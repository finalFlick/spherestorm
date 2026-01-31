# SPHERESTORM - Feature List

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

#### Enemy System
- [x] 8 unique enemy types with different behaviors
- [x] Weighted spawn system (rarer enemies in later waves)
- [x] Arena-gated enemy unlocks (some enemies only appear in later arenas)
- [x] Enemy scaling with arena/wave progression
- [x] Enemy jumping (unlocked after Arena 2 boss)

**Enemy Types:**
| Type | Behavior |
|------|----------|
| Grunt | Basic chase AI |
| Shooter | Maintains distance, fires projectiles |
| Shielded | 50% damage reduction |
| Fast Bouncer | Bounces off walls, slight homing |
| Splitter | Splits into 3 smaller enemies on death |
| Shield Breaker | Charges at player when in range |
| Water Balloon | Grows over time, explodes into hazard zone |
| Teleporter | Teleports near player periodically |

#### Boss System
- [x] 6 unique bosses, one per arena
- [x] Phase-based difficulty (phases at 66% and 33% health)
- [x] Boss-specific AI patterns
- [x] Boss health bar UI
- [x] Guaranteed heart drop on boss kill
- [x] Boss minion spawning

**Boss Abilities:**
| Boss | Arena | Abilities |
|------|-------|-----------|
| Pillar Guardian | 1 | Charge attack, summons Fast Bouncers |
| Slime Queen | 2 | Jump attack, leaves hazard pools, spawns Grunts |
| Teleporting Tyrant | 3 | Teleports around, spawns Teleporters |
| Balloon King | 4 | Grows larger, spawns Water Balloons, splits into mini-bosses |
| Tunnel Wyrm | 5 | Burrows underground, emerges near player |
| Chaos Incarnate | 6 | Cycles through all boss abilities |

#### Arena Progression System
- [x] 6 distinct arenas with progressive complexity
- [x] 10 waves per arena + boss fight
- [x] Mechanic unlocks tied to boss defeats
- [x] Arena geometry builds incrementally (each arena adds to previous)

**Arena Progression:**
| Arena | New Features |
|-------|--------------|
| 1 - Proving Grounds | Flat ground only |
| 2 - Pillar Sanctum | + Pillars, cover blocks |
| 3 - Sky Rise | + Vertical platforms, stepped ramps |
| 4 - Platform Gardens | + Corner platforms, bridges |
| 5 - The Labyrinth | + Tunnel walls |
| 6 - Chaos Realm | + Hazard zones |

#### Wave System
- [x] State machine: Intro → Active → Clear → (Boss Intro → Boss Active → Boss Defeated → Transition)
- [x] Wave announcements with arena name
- [x] Progressive enemy count scaling
- [x] Dynamic spawn intervals (faster in later waves/arenas)

#### Upgrade System
- [x] Level up on XP thresholds
- [x] 3 random upgrades offered per level
- [x] 8 upgrade types affecting different stats
- [x] Multiplicative and additive stat modifiers
- [x] Multiple pending level-ups queue properly

#### Pickups
- [x] XP gems from killed enemies
- [x] Heart pickups for healing (15/25/50 HP for normal/elite/boss)
- [x] Magnetic attraction to player (configurable range)
- [x] Heart TTL with fade-out
- [x] Floating bob animation

#### UI/HUD
- [x] Health bar with percentage fill
- [x] XP bar with level display
- [x] Arena and wave indicators
- [x] Timer and score display
- [x] Kill counter
- [x] Boss health bar (appears during boss fights)
- [x] Wave/Boss announcements
- [x] Unlock notifications
- [x] Pause indicator
- [x] Game over screen with stats

#### Technical
- [x] ES Module architecture
- [x] Modular file structure
- [x] Performance optimizations (reusable Vector3, ring buffer for trails)
- [x] Pointer lock for immersive controls
- [x] Responsive canvas sizing

---

## Potential Future Features

### Gameplay Enhancements
- [ ] Weapon variety (different shooting patterns)
- [ ] Active abilities with cooldowns
- [ ] Combo system for chained kills
- [ ] Critical hits
- [ ] Shield/armor system
- [ ] Dodging with i-frames

### Enemy Enhancements
- [ ] Elite enemy variants with modifiers
- [ ] Enemy formations/group tactics
- [ ] Flying enemies
- [ ] Ranged enemy projectile patterns
- [ ] Mini-boss waves mid-arena

### Arena Enhancements
- [ ] Moving platforms
- [ ] Destructible obstacles
- [ ] Environmental hazards (lava, spikes)
- [ ] Arena modifiers (low gravity, darkness)
- [ ] Secret areas with bonus loot

### Progression
- [ ] Meta-progression (permanent unlocks between runs)
- [ ] Character selection with different abilities
- [ ] Difficulty modes
- [ ] Challenge modes (time attack, boss rush)
- [ ] Achievements

### Visual/Audio
- [ ] Sound effects
- [ ] Music
- [ ] Screen shake on impacts
- [ ] Post-processing effects (bloom, vignette)
- [ ] Better enemy death animations
- [ ] Projectile trails

### Quality of Life
- [ ] Settings menu (sensitivity, volume)
- [ ] Control rebinding
- [ ] Mobile touch controls
- [ ] Save/load game state
- [ ] Statistics tracking

---

## Known Limitations

1. **No audio** - Game is currently silent
2. **No persistence** - Progress resets on page refresh
3. **Desktop only** - No mobile support
4. **Single player** - No multiplayer functionality
5. **Fixed arena sizes** - All arenas are 100x100 units
