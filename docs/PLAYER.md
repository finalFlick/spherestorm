# Player System Documentation

This document provides comprehensive reference for SPHERESTORM's player character, including movement mechanics, combat system, stats, controls, and implementation details.

## Table of Contents

- [Player Overview](#player-overview)
- [Movement System](#movement-system)
- [Combat System](#combat-system)
- [Stats & Progression](#stats--progression)
- [Damage & Recovery](#damage--recovery)
- [Visual Feedback](#visual-feedback)
- [Controls Reference](#controls-reference)
- [Implementation Guide](#implementation-guide)

---

## Player Overview

The player character in SPHERESTORM is a **manta ray-inspired flying entity** that glides through 3D arenas, automatically targeting enemies within a 180° forward arc.

### Visual Design

**Body Structure:**
- **Core Body:** Wide, flat ellipsoid (1.5x width, 0.4x height, 1.2x depth)
- **Wings:** Two cone-shaped wings extending from sides
- **Tail:** Single cone extending backward
- **Color:** Blue (0x44aaff) with cyan emissive glow

**Visual Effects:**
- Soft glow aura (15% opacity, matches body color)
- Movement-based lean animations
- Ground trail when moving
- Attack direction indicator (180° cyan arc on ground)

**Size:** ~1.8 units wide, ~0.8 units tall (including wings)

**Design Philosophy:** Sleek, agile appearance that conveys speed and maneuverability

---

## Movement System

### Ground Movement

**WASD Controls:**
- **W** - Move forward (relative to camera)
- **S** - Move backward (relative to camera)
- **A** - Strafe left (50% speed - encourages camera turning)
- **D** - Strafe right (50% speed - encourages camera turning)

**Base Speed:** 0.15 units/frame

**Movement Characteristics:**
- Camera-relative direction (always moves where you're looking)
- Instant acceleration/deceleration (arcade feel)
- Strafing reduced to 50% speed (promotes active camera control)
- Works on both ground and platforms

---

### Dash Strike (Unlocked After Boss 1)

There is **no basic dash** at the start of the game.

**Unlock Condition:** Defeat **Boss 1** (Red Puffer King) once (Phase 3 kill) to unlock the **Dash Strike** module.

**Activation:** Hold Shift while moving (once unlocked)

**Notes:**
- Before unlock: Shift does nothing
- After unlock: Shift performs Dash Strike (see [Module System](#module-system))

---

### Jump & Bounce System

**Activation:** Spacebar (when grounded)

**Jump Velocity:** 0.4 units/frame (upward)

**Gravity:** 0.018 units/frame² (downward acceleration)

**Bounce Mechanics:**

When landing from a jump, the player bounces up to 3 times with diminishing height:

| Bounce # | Height Multiplier | Squash Duration |
|----------|-------------------|-----------------|
| 1 | 50% | 6 frames |
| 2 | 40% | 4 frames |
| 3 | 30% | 2 frames |
| 4+ | 0% (grounded) | 0 frames |

**Squash/Stretch Animation:**
- Squashes vertically on bounce
- Stretches horizontally (XZ scale increases)
- Visual feedback for bounce count

**Platform Interaction:**
- Can land on elevated platforms
- Smooth platform detection
- Maintains horizontal momentum while in air

**Landing Particle:** Blue particle burst on first bounce

---

### Collision System

**Player Hitbox:** 0.5 unit radius (spherical)

**Arena Bounds:** 45 × 45 unit square (hard boundary)

**Platform Collision:**
- Horizontal collision (pushes player away from edges)
- Vertical collision (can stand on top)
- Edge detection (prevents clipping into obstacles)

**Collision Priority:**
1. Arena bounds (hard limit)
2. Platform horizontal blocking
3. Platform top landing
4. Ground level (Y = 1)

---

### Lean Animation

**Purpose:** Visual feedback for movement direction

**Lean Angles:**
- **W/S (Forward/Back):** ±0.15 radians (±8.6°)
- **A/D (Left/Right):** ±0.15 radians (±8.6°)

**Smoothing:** 15% interpolation per frame (smooth, responsive)

**Application:**
- Applied to body group only (not parent transform)
- Does NOT affect gameplay hitbox
- Does NOT affect camera or attack indicator

**Visual Effect:** Creates dynamic, responsive feel during movement

---

## Combat System

### Auto-Targeting

**Targeting Mode:** Automatic lock-on within forward arc

**Target Selection:**
1. Find all enemies within 180° forward arc (dot >= 0)
2. **Close-range override:** Enemies within 3 units are always targetable regardless of facing
3. Filter by max range (25 units)
4. Sort by distance (nearest first)
5. Select up to `projectileCount` targets

**Forward Arc Calculation:**
- Uses dot product of player forward direction
- Positive or zero dot values (0° to 180°, inclusive of perpendicular)
- **Close-range override**: dot check skipped for enemies within 3 units (prevents point-blank misses)

**Target Priority:** Distance only (no threat-based priority)

---

### Projectile System

**Firing:**
- **Trigger:** Hold Left Mouse Button (automatic fire)
- **Fire Rate:** 500ms / attackSpeed stat
- **Blocked During:** Hit recovery (invulnerability frames)

**Projectile Properties:**
- Size: 0.15 unit radius
- Speed: 0.8 × projectileSpeed stat
- Damage: Base damage stat
- Color: Cyan (0x44ffff)
- Lifespan: 120 frames (2 seconds, sim-time)
- Max Range: 25 units from spawn position

**Timing Note:**
- Projectile movement and lifespan scale with delta (pause/slow-mo safe)

**Mild Homing:**
- Projectiles steer toward their target each frame at a low turn rate (~0.04 rad/frame)
- If the target dies mid-flight, the projectile flies straight
- Prevents small/fast enemies from trivially dodging auto-fired shots
- Forward arc still matters — homing only adjusts trajectory, not acquisition

**Multi-Shot:**
- Each projectile homes to nearest target in arc
- If more projectiles than targets, projectiles distribute
- Vertical lock-on: Aims at enemy center (3D targeting)

**Object Pooling:**
- Pool size: 60 projectiles
- Pre-created at game start
- Reuses oldest when pool exhausted
- Prevents memory leaks

**Projectile Item Modifiers (Blueprint System):**
Items collected from chests are **blueprints** that require a level-up choice to activate:
- **Pierce**: Projectile passes through 1 extra target before being consumed
- **Chain**: On hit, a secondary bolt arcs to 1 nearby enemy (50% damage, 12-unit range)
- **Explosion**: On hit, deals 40% AoE damage within 3-unit radius
- **Combo — Razor Swarm**: Having both Pierce and Chain active

**Blueprint Unlock Flow:**
1. Pick up chest → Item added to "pending blueprints" (not active yet)
2. On next level-up → Blueprint appears as an upgrade choice
3. Select blueprint → Item becomes active for the rest of the run
4. Once active, item works exactly as before (minimal code churn)

---

### Attack Indicator

**Visual:** 180° cyan arc on ground in front of player

**Properties:**
- Radius: 10 units
- Opacity: 15% (area), 40% (edge glow)
- Position: 5 units forward from player
- Rotation: Matches camera facing direction

**Purpose:**
- Shows attack direction
- Indicates which enemies can be targeted
- Visual feedback for aiming

**Implementation Note:**
- Separate from player group (not affected by lean)
- Manually positioned each frame
- Always lies flat on ground (Y = 0.15)

---

## Stats & Progression

### Base Stats

Starting values (level 1, no upgrades):

| Stat | Base Value | Description |
|------|------------|-------------|
| Health | 100 | Current HP |
| Max Health | 100 | Maximum HP |
| Damage | 10 | Projectile damage |
| Attack Speed | 1.0 | Fire rate multiplier |
| Projectile Count | 1 | Simultaneous shots |
| Projectile Speed | 0.8 | Projectile velocity multiplier |
| Move Speed | 0.15 | Ground movement speed |
| Pickup Range | 3 | XP/heart collection radius |
| XP Multiplier | 1.0 | Experience gain multiplier |

---

### Upgrades

The game uses a two-tier upgrade system with per-arena caps to prevent runaway stat growth:

#### Baseline Auto-Scaling

When starting at later arenas (or accumulating XP), stats automatically scale with reduced multipliers:
- **Damage:** +5% per level (cycles every 4 levels)
- **Attack Speed:** +4% per level (cycles every 4 levels)
- **Move Speed:** +2% per level (cycles every 4 levels) - **Capped at 0.22** (prevents "Flash-speed" by Arena 2)
- **Max Health:** +10 HP per level (cycles every 4 levels)
- **Projectile Count:** +1 every 6 levels (slowed from every 3)

**Per-Arena Caps:** Each arena limits how many times each stat can be upgraded (baseline + manual combined):
- **Arena 1:** damage: 2, attackSpeed: 2, moveSpeed: 1, maxHealth: 2, pickupRange: 2, projectileCount: 1
- **Arena 2:** damage: 3, attackSpeed: 3, moveSpeed: 2, maxHealth: 3, pickupRange: 3, projectileCount: 2
- **Arena 3+:** Progressively higher caps

**Hard Maximums:** Even with caps, stats cannot exceed:
- **Move Speed:** 0.22 (prevents Arena 2 zooming)
- **Damage:** 50
- **Attack Speed:** 0.8
- **Projectile Count:** 8

#### Core Upgrades (Always Available)

These 4 upgrades are always in the level-up pool from game start:

**Damage Up**
- **Icon:** ⚔️
- **Effect:** +10% damage (multiplicative)
- **Stat:** `damage`
- **Stacking:** Multiplicative (1.10x per upgrade)
- **Per-Arena Cap:** Limited upgrades per arena to encourage build variety

**Attack Speed**
- **Icon:** ⚡
- **Effect:** +8% fire rate (multiplicative)
- **Stat:** `attackSpeed`
- **Formula:** Fire rate = 500ms / attackSpeed
- **Stacking:** Multiplicative (1.08x per upgrade)
- **Per-Arena Cap:** Limited upgrades per arena to prevent runaway scaling

**Max Health**
- **Icon:** ❤️
- **Effect:** +15 max HP (additive)
- **Stat:** `maxHealth`
- **Stacking:** Additive (+15 per upgrade)
- **Note:** Does NOT heal current HP
- **Per-Arena Cap:** Limited upgrades per arena

**XP Magnet**
- **Icon:** 🧲
- **Effect:** +20% pickup range (multiplicative)
- **Stat:** `pickupRange`
- **Stacking:** Multiplicative (1.20x per upgrade)
- **Per-Arena Cap:** Limited upgrades per arena

#### Future Unlockable Upgrades

These upgrades are locked at game start and will be unlockable through progression:

**Multi Shot**
- **Icon:** 🎯
- **Effect:** +1 projectile
- **Unlock:** Arena 2+ (planned)

**XP Boost**
- **Icon:** ✨
- **Effect:** +20% XP gain (multiplicative)
- **Unlock:** Arena 2+ (planned)

**Bullet Speed**
- **Icon:** 💨
- **Effect:** +25% projectile speed (multiplicative)
- **Unlock:** Arena 2+ (planned)

---

### Module System

Modules are persistent upgrades that carry across runs and feature mastery progression.

#### Speed Module

**Unlock:** Hidden pickup in Arena 1 (exploration)

**Mastery Levels:**
- **L1 (1 find):** +15% move speed
- **L2 (3 finds):** +25% move speed
- **L3 (8 finds):** +30% move speed

**Type:** Passive stat boost

**Persistence:** Unlocks and mastery level persist across runs

#### Dash Strike

**Unlock:** Defeat Boss 1 (Red Puffer King) Phase 3

**Mastery Levels:**
- **L1 (1 kill):** 16 range, 5s cooldown, 15 damage
- **L2 (5 kills):** 20 range, 4s cooldown, 20 damage
- **L3 (15 kills):** 24 range, 3s cooldown, 25 damage

**Type:** Active ability (press Shift to dash)

**Persistence:** Unlocks and mastery level persist across runs

**Behavior:**
- Dash in current movement direction
- Damage enemies you pass through (each enemy can be hit once per dash)
- Deal AoE damage at impact point (won't double-hit enemies already clipped during transit)
- Invulnerable to enemy/boss contact and projectiles during dash + brief landing grace (hazards still damage)
- Cooldown displayed in UI
- Leaves a Boss 1-style cyan ground trail + bubbles during the dash for readability
- Plays a short target ping at dash start to help read the landing direction

---

### Level System

**Starting XP:** 0 XP

**First Level-Up:** 10 XP required

**XP Scaling:** XP to next level increases by 1.25x (rounded down)
- Level 1 → 2: 10 XP
- Level 2 → 3: 12 XP
- Level 3 → 4: 15 XP
- Level 4 → 5: 18 XP

**Level-Up Process:**
1. Collect XP from defeated enemies
2. XP bar fills automatically
3. Game pauses when level reached
4. Choose 1 of 3 random upgrades
5. Game resumes after selection

**Upgrade Selection:**
- 3 random upgrades offered
- Can repeat upgrades (stacking)
- Choice made via UI buttons

---

### Difficulty Modes

The game supports selectable difficulty modes that adjust enemy scaling, spawn budgets, and telegraph windows:

**Available Modes:**
- **Easy** - Reduced enemy HP/DPS, more generous telegraphs, lower spawn budgets
- **Normal** - Baseline difficulty (default)
- **Hard** - Increased enemy HP/DPS, tighter telegraphs, higher spawn budgets
- **Nightmare** - Maximum challenge with aggressive scaling

**Difficulty Selection:**
- Selectable from main menu before starting a run
- Selection persists to localStorage between sessions
- Cannot be changed mid-run (ensures leaderboard integrity)
- Current difficulty displayed in HUD

**Scaling Effects:**
- **Enemy HP:** Multiplied by difficulty HP multiplier
- **Enemy Damage:** Multiplied by difficulty DPS multiplier
- **Spawn Budgets:** Multiplied by difficulty spawn multiplier
- **Telegraph Windows:** Adjusted by difficulty telegraph multiplier
- **Score Multiplier:** Affects final score (higher difficulty = higher scores)

**Leaderboard Integration:**
- Leaderboard entries show difficulty badge (E/N/H/NM)
- Scores are comparable within the same difficulty mode

---

### Lives & Checkpoint System

The game uses a **3-life system** (configurable via `DEFAULT_LIVES` constant) to reduce frustration from instant permadeath:

**Default Lives:** 3

**Life Consumption:**
- Death with lives remaining consumes 1 life
- Arena restarts cleanly (wave resets, enemies cleared, pickups reset)
- Player respawns at arena start position
- Upgrades and progress within the arena are retained

**Game Over:**
- Triggers when all lives are exhausted (0 lives remaining)
- Shows game over screen with score and death recap
- Lives display visible in HUD at all times

**Life Persistence:**
- Lives carry across arena transitions
- Lives reset to default when starting a new run
- Lives are NOT restored between sessions (each run starts fresh)

**Visual Feedback:**
- Lives displayed as heart icons in HUD
- Death screen shows remaining lives count
- Clear indication when life is consumed vs game over

---

## Damage & Recovery

### Taking Damage

**Damage Sources:**
- Enemy contact
- Enemy projectiles
- Hazard zones (DoT)
- Boss attacks

**Damage Processing:**
1. Check invulnerability (recovery state)
2. Check debug invincibility flag
3. Subtract health
4. Apply knockback
5. Start recovery state
6. Log damage for death recap
7. Play visual/audio feedback

---

### Knockback System

**Strength:** 0.3 units/frame (initial velocity)

**Direction:**
- Away from damage source (if position provided)
- Backward from facing direction (default)

**Mechanics:**
- Applies horizontal velocity to player
- Velocity decays at 15% per frame (0.85 multiplier)
- Stops when velocity < 0.01
- Does NOT interrupt player input

**Purpose:** Visual feedback, forced repositioning

---

### Invulnerability Frames (i-frames)

**Duration:** 90 frames (1.5 seconds at 60fps)

**Properties:**
- Blocks ALL damage during recovery
- Blocks shooting (cannot attack)
- Does NOT block movement
- Visual flashing indicates active

**Flash Animation:**
- Opacity cycles: 0.3 to 1.0
- Sine wave pattern
- Speed: 0.4 radians per frame
- Color: No color change (opacity only)

**Purpose:**
- Prevents instant death from rapid hits
- Gives player recovery window
- Visible to player for clarity

---

### Hazard Zone Damage

**Frame-Based Ticking:**
- Damage applies every N frames (not wall-clock time)
- Respects slow-mo and time scaling
- Tick counter resets when exiting hazard

**Default Configuration:**
- Damage per tick: Variable by hazard type
- Tick interval: Variable by hazard type
- Detection: Circular radius check + height check

**Example:**
```javascript
hz.tickTimer++;
if (hz.tickTimer >= hz.damageTickInterval) {
    takeDamage(hz.damagePerTick, 'Hazard Zone', 'hazard');
    hz.tickTimer = 0;
}
```

---

### Death & Game Over

**Triggered When:** Health reaches 0

**Process:**
1. Health clamped to 0
2. Game loop checks health
3. Game over screen displays
4. Damage log shows last 5 hits
5. Death tip shown (based on killing blow)

**Death Recap:**
- Last 5 damage sources
- Damage amount per hit
- Health after each hit
- Timestamp

**Death Tips:**
- Context-aware advice
- Based on killing blow source
- Helps player learn from mistakes

---

## Visual Feedback

### Movement Trail

**Appearance:** Fading blue trail particles

**Spawn Conditions:**
- Player is moving (WASD or Dash Strike)
- Player is grounded
- Distance since last trail > threshold (0.5 units)

**Trail Properties:**
- Color: Matches player (0x44aaff)
- Fades over time
- Ground-level only
- Not created while airborne

**Purpose:** Shows movement history, enhances speed feel

---

### Damage Flash

**Screen Flash:**
- Red overlay on screen
- Opacity: 1.0 → 0
- Duration: 100ms
- Element: `#damage-flash`

**Player Flash:**
- Emissive color: Blue → Red
- Emissive intensity: 0.3 → 1.0
- Duration: 200ms (DAMAGE_COOLDOWN)
- Returns to normal after duration

---

### Squash/Stretch

**Triggered By:** Bounce landing

**Scale Changes:**
- X/Z (horizontal): 1.0 → 1.0 + (squashTime × 0.02)
- Y (vertical): 1.0 → 1.0 - (squashTime × 0.03)

**Duration:** 6 frames (1st bounce), decreases per bounce

**Purpose:** Cartoon-style impact feedback

---

### Camera System

**Camera Position:**
- Distance: 8 units behind player
- Height: 4 + player Y + vertical angle offset
- Vertical angle range: -0.5 to 1.0 radians

**Camera Look Target:**
- Player position + (0, 1, 0) offset
- Always centered on player
- Smooth third-person perspective

**Mouse Sensitivity:**
- Horizontal: 0.002 radians per pixel
- Vertical: 0.002 radians per pixel
- Movement clamped: ±50 pixels per event (anti-jitter)

**Pointer Lock:**
- Click to lock cursor
- ESC to unlock (auto-pauses)
- First mouse event skipped (prevents jump)

---

## Controls Reference

### In-Game Controls Overlay (HUD)

During gameplay, a small key-cap diagram appears in the **bottom-right** of the screen showing **WASD**, **SPACE**, and **SHIFT**. Keys **light up while pressed** to confirm the game is receiving your inputs. The overlay hides while paused.

### Keyboard

| Key | Action | Notes |
|-----|--------|-------|
| W | Move Forward | Camera-relative |
| A | Strafe Left | 50% speed |
| S | Move Backward | Camera-relative |
| D | Strafe Right | 50% speed |
| Space | Jump | Only when grounded |
| Shift | Dash Strike | Unlocked after Boss 1 |
| ESC | Pause/Unlock | Exits pointer lock |

### Mouse

| Input | Action | Notes |
|-------|--------|-------|
| Mouse Movement | Camera Control | Requires pointer lock |
| Left Click | Click to Lock | Only when game running |
| Hold Left Click | Auto-Fire | Targets enemies in 180° arc |

### Pointer Lock

**How It Works:**
1. Click canvas while game running
2. Cursor hides, mouse controls camera
3. ESC to exit (pauses game)
4. Indicators show lock state

**Pause Behavior:**
- Unlocking pointer pauses game
- Music pauses with game
- Audio volume sliders (Master/Music/SFX) persist between sessions
- "PAUSED" indicator displays

---

## Implementation Guide

### Creating the Player

**Function:** `createPlayer()` in `js/entities/player.js`

```javascript
export function createPlayer() {
    player = new THREE.Group();
    
    // Body group for lean animation (local space)
    const bodyGroup = new THREE.Group();
    player.add(bodyGroup);
    player.bodyGroup = bodyGroup;
    
    // Create visual model (body, wings, tail, glow)
    // Add to bodyGroup
    
    // Create attack indicator (separate from player)
    const attackIndicator = new THREE.Group();
    scene.add(attackIndicator);  // Not a child of player
    player.attackIndicator = attackIndicator;
    
    // Initialize properties
    player.velocity = new THREE.Vector3();
    player.isGrounded = true;
    player.bounceCount = 0;
    // ... etc
    
    return player;
}
```

**Key Points:**
- Use Group for player (allows body subgroup)
- Body group receives lean rotation
- Attack indicator separate (no lean inheritance)
- Initialize all state properties

---

### Updating the Player

**Function:** `updatePlayer(delta)` in `js/entities/player.js`

**Update Order:**
1. Calculate movement direction (WASD + camera)
2. Apply Dash Strike or normal movement
3. Platform collision (horizontal)
4. Jump input check
5. Apply gravity
6. Platform collision (vertical landing)
7. Bounce mechanics
8. Squash/stretch animation
9. Knockback velocity decay
10. Hit recovery state update
11. Arena bounds clamping
12. Trail spawning
13. Hazard damage detection
14. Lean animation interpolation
15. Attack indicator positioning
16. Camera follow

**Critical:**
- Process collision AFTER movement
- Clamp to bounds AFTER all movement
- Update camera LAST

---

### Damage System Integration

**Setup:**
```javascript
import { setPlayerRef } from '../systems/damage.js';

// After creating player
setPlayerRef(player);
```

**Taking Damage:**
```javascript
import { takeDamage } from '../systems/damage.js';

// From damage source
takeDamage(amount, 'Source Name', 'sourceType', sourcePosition);
```

**Parameters:**
- `amount`: Damage to apply
- `source`: Display name for recap
- `sourceType`: 'enemy', 'projectile', 'hazard', etc.
- `sourcePosition`: THREE.Vector3 (for knockback direction)

---

### Stat Modification

**Direct Modification:**
```javascript
gameState.stats.damage *= 1.25;  // +25% damage
gameState.stats.projectileCount += 1;  // +1 projectile
gameState.maxHealth += 25;  // +25 max HP
```

**Through Upgrade System:**
```javascript
import { UPGRADES } from '../config/upgrades.js';

function applyUpgrade(upgradeName) {
    const upgrade = UPGRADES.find(u => u.name === upgradeName);
    if (upgrade.mult) {
        gameState.stats[upgrade.stat] *= upgrade.mult;
    }
    if (upgrade.add) {
        gameState.stats[upgrade.stat] += upgrade.add;
    }
}
```

---

### Reset System

**Function:** `resetPlayer()` in `js/entities/player.js`

**Resets:**
- Position to origin (0, 1, 0)
- Velocity to zero
- Rotation to zero
- Grounded state to true
- Bounce count to zero
- Recovery state to inactive
- Material opacity to 1.0

**When to Call:**
- Game restart
- Arena transition
- Death/respawn

---

### Adding New Movement Mechanics

**Steps:**

1. **Add State Variables:**
```javascript
player.newMechanicActive = false;
player.newMechanicTimer = 0;
```

2. **Check Input in Update:**
```javascript
if (keys['KeyX'] && canUseNewMechanic()) {
    player.newMechanicActive = true;
    player.newMechanicTimer = DURATION;
}
```

3. **Apply Mechanic:**
```javascript
if (player.newMechanicActive) {
    player.newMechanicTimer--;
    // Apply effect
    if (player.newMechanicTimer <= 0) {
        player.newMechanicActive = false;
    }
}
```

4. **Add Visual Feedback:**
```javascript
if (player.newMechanicActive) {
    // Spawn particles, change color, etc.
}
```

---

### Adding New Stats

**Steps:**

1. **Add to gameState.stats:**
```javascript
// In js/core/gameState.js
stats: {
    // ... existing stats
    newStat: 1.0
}
```

2. **Add to resetGameState:**
```javascript
gameState.stats = {
    // ... existing stats
    newStat: 1.0
};
```

3. **Create Upgrade:**
```javascript
// In js/config/upgrades.js
{ 
    name: 'New Stat Up', 
    icon: '🆕', 
    desc: '+20% new stat', 
    stat: 'newStat', 
    mult: 1.2 
}
```

4. **Use in Gameplay:**
```javascript
const effectiveValue = baseValue * gameState.stats.newStat;
```

---

### Debug Features

**Invincibility:**
```javascript
gameState.debug.invincible = true;  // No damage taken
```

**Position Override:**
```javascript
player.position.set(x, y, z);  // Teleport player
```

**Stat Testing:**
```javascript
gameState.stats.damage = 1000;  // One-shot everything
gameState.stats.moveSpeed = 1.0;  // Super speed
```

---

## Combat Stats Tracking

The player system tracks detailed combat statistics:

### Tracked Stats

| Stat | Description |
|------|-------------|
| damageDealt | Total damage to all enemies |
| damageTaken | Total damage received |
| kills | Enemy kill counts by type |
| perfectWaves | Waves completed without damage |
| waveDamageTaken | Damage in current wave (resets per wave) |
| bossesDefeated | Total bosses killed |

**Usage:**
- Badge thresholds
- Death recap
- Performance feedback
- Leaderboard data

---

## File References

**Player Files:**
- `js/entities/player.js` - Player entity, movement, visuals
- `js/systems/damage.js` - Damage, recovery, knockback
- `js/systems/projectiles.js` - Combat, auto-aim, shooting

**Configuration Files:**
- `js/config/constants.js` - Jump velocity, gravity, bounce factors
- `js/config/upgrades.js` - Upgrade definitions and effects
- `js/core/gameState.js` - Player stats, health, progression

**Input & Camera:**
- `js/core/input.js` - Keyboard, mouse, pointer lock
- `js/core/scene.js` - Camera setup

**Related Systems:**
- `js/systems/pickups.js` - XP and heart collection
- `js/effects/particles.js` - Visual feedback
- `js/effects/trail.js` - Movement trail
- `js/ui/hud.js` - Health bar, XP bar

**Related Documentation:**
- `docs/ENEMIES.md` - Targets for combat system
- `docs/BOSS.md` - Boss combat mechanics
- `docs/ARENA.md` - Movement space and obstacles
- `docs/PULSE_MUSIC_SYSTEM.md` - Player action sounds
