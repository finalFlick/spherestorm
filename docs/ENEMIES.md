# Enemy System Documentation

This document provides comprehensive reference for SPHERESTORM's enemy system, including all enemy types, behaviors, spawn mechanics, and implementation details.

## Table of Contents

- [Enemy System Overview](#enemy-system-overview)
- [Enemy Roster](#enemy-roster)
- [Spawn Mechanics](#spawn-mechanics)
- [Behavioral Patterns](#behavioral-patterns)
- [Visual Profiles](#visual-profiles)
- [Implementation Guide](#implementation-guide)

---

## Enemy System Overview

SPHERESTORM uses a **weighted spawn system** with **cognitive caps** to create challenging but readable combat encounters. Enemies unlock progressively across arenas, teaching mechanics incrementally.

**Important:** Enemy HP does **not** scale with arena or wave progression. Hit counts remain consistent and learnable within a difficulty mode. Difficulty comes from **spawn count, composition, and enemy damage** rather than HP bloat.

### Core Concepts

**Spawn Weighting:**
- Each enemy has a `spawnWeight` value
- Higher weight = more common spawns
- Weight 0 = boss minion or elite-only

**Arena Gating:**
- Enemies have `arenaIntro` values
- Only enemies from current or previous arenas can spawn
- Some enemies have `maxArena` restrictions

**Cognitive Caps:**
- Maximum enemy types per wave limited by arena
- Prevents overwhelming visual chaos
- Featured enemy always included in wave pool

**Size Bands:**
- **Swarm:** 0.25-0.35 units (tiny, fast threats)
- **Standard:** 0.45-0.55 units (baseline enemies)
- **Heavy:** 0.90-1.20 units (tanky, slow threats)

### Enemy Categories

**Wave Spawns:**
- Appear during normal wave progression
- Weighted spawn selection
- Subject to threat budget system

**Boss Minions:**
- Only spawn via boss summon ability
- `isBossMinion: true` flag
- Examples: Shooter, Water Balloon

**Elite-Only:**
- Require "elite" wave modifier
- `isEliteOnly: true` flag
- Example: Shield Breaker

---

## Enemy Roster

### Red Puffer

**Tagline:** Spawn of the King

**Stats:**
- Size: 0.65 (Standard - noticeably bigger than tiny)
- Health: 12
- Speed: 0.055
- Damage: 10
- Color: Mid Red (0xff4444)
- XP Value: 1

**Spawn Info:**
- Weight: 40 (very common)
- Arena Intro: 1
- Min Wave: 2 (only spawns Wave 2+)
- Availability: All arenas

**Behavior:** Chase
- Mindlessly pursues player
- No special mechanics
- Pure threat through numbers

**Visual Profile:**
- Type: Mini Porcupinefish (matches Red Puffer King boss)
- Body sphere with glow effect
- Eyes with pupils, tail fin, side fins, dorsal fin
- Same visual style as Boss 1, but smaller

**Movement Signature:** Sway

**Death VFX:** Burst (12 particles, red)

**Description:** Standard offspring of the Red Puffer King. These aggressive puffers swarm in numbers, overwhelming through sheer persistence. What they lack in size, they make up for in relentless pursuit.

**Teaching Purpose:** Movement fundamentals, basic dodging

---

### Tiny Puffer

**Tagline:** Spawn of the Spawn

**Stats:**
- Size: 0.35 (Small but visible)
- Health: 4 (1-shot at base damage)
- Speed: 0.07 (Fastest puffer variant)
- Damage: 5
- Color: Pink (0xffaaaa)
- XP Value: 0.5

**Spawn Info:**
- Weight: 35 (dominant in early waves)
- Arena Intro: 1
- Min Wave: 1 (spawns from Wave 1+)
- Availability: All arenas

**Behavior:** Chase
- Mindlessly pursues player
- Dies in one shot
- Overwhelming in swarms

**Visual Profile:**
- Type: Mini Porcupinefish (smallest variant)
- Slightly brighter glow for visibility at small size
- Same visual style as Boss 1 and other puffers

**Movement Signature:** Sway

**Death VFX:** Burst (6 particles, pink)

**Description:** The smallest of the Red Puffer brood. These hyperactive fry dart around in swarms, individually weak but overwhelming in numbers. One shot dispatches them, but can you hit them all?

**Teaching Purpose:** Target tracking, snap aiming at small fast targets

---

### Big Puffer

**Tagline:** The Elder Spawn

**Stats:**
- Size: 1.1 (Heavy - very large and intimidating)
- Health: 30 (3-shot at base damage)
- Speed: 0.04 (Slowest puffer variant)
- Damage: 15
- Color: Dark Red (0x991111)
- XP Value: 3

**Spawn Info:**
- Weight: 15 (less common pressure element)
- Arena Intro: 1
- Min Wave: 3 (only spawns Wave 3+)
- Availability: All arenas

**Behavior:** Chase
- Mindlessly pursues player
- Takes 3 hits to kill
- Anchors swarms with bulk

**Visual Profile:**
- Type: Mini Porcupinefish (largest grunt variant)
- Deeper glow for ominous presence
- Same visual style as Boss 1 and other puffers

**Movement Signature:** Sway

**Death VFX:** Burst (16 particles, dark red)

**Description:** A mature Red Puffer that has grown larger and more resilient. Slower but more dangerous, these elders anchor the swarm with their bulk.

**Teaching Purpose:** Target prioritization, threat assessment (kill high-value targets first)

---

### Shooter

**Tagline:** Death From a Distance

**Stats:**
- Size: 0.45 (Standard, smaller)
- Health: 8
- Speed: 0.035
- Damage: 8
- Color: Bright Green (0x22ff22)
- XP Value: 2

**Spawn Info:**
- Weight: 0 (boss minion only)
- Arena Intro: N/A
- `isBossMinion: true`
- `isEliteOnly: true` (elite variant)

**Behavior:** Shooter
- Maintains distance from player
- Fires projectiles every 2 seconds
- Retreats when player approaches
- Shoot range: 15 units

**Visual Profile:**
- Type: Glow
- Glow Intensity: 0.5
- Pulse Speed: 0.05 (pulses when ready to fire)

**Movement Signature:** Strafe

**Telegraph:** Flash (300ms, light green 0x88ff88)

**Death VFX:** Spark Ring (10 particles, green)

**Description:** Cowardly but deadly. Shooters prefer to engage from range, retreating when threatened. Their projectiles are slow but punishing if you ignore them.

**Teaching Purpose:** Target prioritization, threat awareness

---

### Guardian Crab

**Tagline:** Anemone-Bearer

**Stats:**
- Size: 1.00 (Heavy - larger than standard)
- Health: 25
- Speed: 0.035
- Damage: 10 (contact only)
- Color: Bright Blue (0x4466ff)
- XP Value: 12 (high priority kill reward)

**Spawn Info:**
- Weight: 30 (common, Arena 2 signature)
- Arena Intro: 2
- **Arena 2 Signature Enemy**

**Behavior:** Warden Support (new behavior type)
- **Does NOT have a shield bubble** — its anemone core absorbs damage first
- Projects shields (12 HP each) onto nearby allies within 7-unit radius
- Maximum 5 shielded allies at a time (performance + readability cap)
- Seeks the centroid of nearby allies (hangs with the pack, doesn't rush player)
- Falls back to chase behavior if no allies nearby

**Aura Mechanics:**
- Aura Radius: 7 units (~14m diameter)
- Shield HP per ally: 12
- Max Shielded: 5
- **Anemone Core HP:** 12
- Breaking the anemone core disables the aura and **shatters all granted shields instantly**
- Shield granted uses existing shield bubble visual (blue)
- **Shield Visibility:** Newly granted shields stay fully visible for ~2 seconds (readability fix)
- On Guardian Crab death: **all granted shields shatter instantly** (cascade effect)
  - Slow-mo + cascade audio feedback
  - Individual shield break VFX per protected enemy

**Visual Profile:**
- Type: Warden Aura (pulsing ground ring)
- Ring pulses outward from 0 to aura radius, then resets (sawtooth wave)
- Ring fades as it expands (opacity 0.3 → 0)
- Ring Color: 0x4466ff
- Glow Intensity: 0.5

**Movement Signature:** Scuttle

**Death VFX:** Cascade (20 particles, blue) + shield shatter on all protected allies

**Audio:**
- `onShieldGrant()` — subtle ascending ding when shield is applied
- `onShieldCascade(count)` — dramatic cascade shatter when shields shatter (scales with count)

**Tutorial Callout:** "Break the anemone core to disable shields!" (first encounter)

**Description:** A hulking crab that projects shields onto nearby allies. Its anemone core is the true shield source — break it to collapse the aura and shatter all granted shields.

**Teaching Purpose:** Target prioritization — identify and eliminate the force multiplier before cleaning up the pack

---

### Fast Bouncer

**Tagline:** Chaos in Motion

**Stats:**
- Size: 0.28 (Swarm - tiny!)
- Health: 6
- Speed: 0.12 (very fast)
- Damage: 8
- Color: Pure Yellow (0xffff00)
- XP Value: 3

**Spawn Info:**
- Weight: 20 (increased for Arena 4)
- Arena Intro: 4
- **Arena 4 Signature Enemy**

**Behavior:** Bouncer
- Ricochets off walls and obstacles
- Slight homing toward player
- Homing Strength: 0.0015
- Unpredictable trajectory

**Visual Profile:**
- Type: Glow (enhanced)
- Glow Intensity: 0.9 (very bright)
- Pulse Speed: 0.2 (fast pulse)
- Trail Enabled: true

**Movement Signature:** Squash

**Death VFX:** Streak (8 particles, yellow)

**Description:** Hyperactive and unpredictable. Fast Bouncers ricochet off walls and obstacles like living pinballs, gradually homing toward their target. Their erratic paths make them hard to track.

**Teaching Purpose:** Tracking moving threats, spatial awareness

---

### Splitter

**Tagline:** Death Breeds More Death

**Stats:**
- Size: 1.10 (Heavy - very large)
- Health: 20
- Speed: 0.045
- Damage: 10
- Color: Bright Magenta (0xff00ff)
- XP Value: 4

**Spawn Info:**
- Weight: 8 (rare)
- Arena Intro: 5
- **Arena 5 Signature Enemy**

**Behavior:** Chase + Split on Death
- Pursues player like Red Puffer
- On death: splits into 3 smaller versions
- Split Count: 3
- Split versions are faster, smaller

**Visual Profile:**
- Type: Pulse
- Glow Intensity: 0.5
- Pulse Speed: 0.08
- Pulse Range: 0.3

**Movement Signature:** Inertia

**Telegraph:** Crack Glow (400ms, light magenta 0xff88ff)

**Death VFX:** Crack Split (15 particles, magenta)

**Description:** A ticking time bomb of multiplication. When destroyed, Splitters fragment into three smaller, faster versions of themselves. Killing one is never the end.

**Teaching Purpose:** Kill order, crowd control, burst damage timing

---

### Shield Breaker

**Tagline:** The Charging Menace

**Stats:**
- Size: 0.55 (Standard)
- Health: 15
- Speed: 0.055 (normal), 0.15 (rush)
- Damage: 18 (high)
- Color: Orange (0xff8800)
- XP Value: 4

**Spawn Info:**
- Weight: 0 (elite-only)
- Arena Intro: N/A
- `isEliteOnly: true`

**Behavior:** Shield Breaker
- Approaches calmly until in range
- Rush Range: 8 units
- Rush Speed: 0.15 (nearly 4x normal speed)
- Aggressive positioning punisher

**Visual Profile:**
- Type: Glow (intensifies before charge)
- Glow Intensity: 0.5
- Pulse Speed: 0

**Movement Signature:** Jitter

**Telegraph:** Compress (350ms, light orange 0xffaa44)

**Death VFX:** Shock Cone (14 particles, orange)

**Description:** Aggressive and deceptively patient. Shield Breakers approach calmly until you enter their rush range, then explode forward at devastating speed. Their high damage punishes careless positioning.

**Teaching Purpose:** Spacing, range awareness, respect for aggression

---

### Water Balloon

**Tagline:** The Ticking Time Bomb

**Stats:**
- Size: 0.40 (Standard, grows to 1.2)
- Health: 25
- Speed: 0.015 (very slow)
- Damage: 5 (contact), zone damage (explosion)
- Color: Cyan (0x00ffff)
- XP Value: 6

**Spawn Info:**
- Weight: 0 (boss minion only)
- Arena Intro: N/A
- `isBossMinion: true`

**Behavior:** Water Balloon
- Slowly approaches player
- Grows continuously: Rate 0.002 per frame
- Max Size: 1.2 units
- Explodes at max size or on death
- Explosion Radius: 4 units
- Creates hazard zone

**Visual Profile:**
- Type: Transparent
- Opacity: 0.6
- Glow Intensity: 0.4 (inner glow)
- Pulse Speed: 0.06

**Movement Signature:** Wobble

**Telegraph:** Pulse (500ms, light cyan 0x88ffff)

**Death VFX:** Splash (20 particles, cyan)

**Description:** Slow but insidious. Water Balloons swell larger with each passing moment, eventually bursting into a damaging hazard zone. Kill them before they reach critical mass - or suffer the splash.

**Teaching Purpose:** Priority targeting, proactive threat elimination, hazard awareness

---

### Teleporter

**Tagline:** Now You See Me...

**Stats:**
- Size: 0.42 (Standard, smaller)
- Health: 12
- Speed: 0.03
- Damage: 15
- Color: Purple (0x8800ff)
- XP Value: 5

**Spawn Info:**
- Weight: 4 (rare)
- Arena Intro: 6
- **Arena 6 Signature Enemy**

**Behavior:** Teleporter
- Approaches player slowly
- Teleports to random position near player
- Teleport Cooldown: 3000ms (3 seconds)
- Teleport Range: 8 units

**Visual Profile:**
- Type: Flicker
- Glow Intensity: 0.6
- Flicker Speed: 0.2

**Movement Signature:** Stutter

**Telegraph:** Flicker (250ms, light purple 0xaa66ff)

**Death VFX:** Glitch (12 particles, purple)

**Description:** Masters of spatial manipulation. Teleporters blink to random positions near you every few seconds, making them frustratingly hard to pin down. Their unpredictable movement demands constant vigilance.

**Teaching Purpose:** Dealing with mobility, prediction, adaptation

---

### Treasure Runner

**Tagline:** Fleeing Fortune

**Stats:**
- Size: 0.50 (Standard)
- Health: 8 (low - easy to kill if caught)
- Speed: 0.08 (fast - challenging to catch)
- Damage: 5 (low damage, not a threat, just runs)
- Color: Gold (0xffd700)
- XP Value: 0 (no base XP - reward comes from drop)

**Spawn Info:**
- Weight: 0 (special spawn only, not in normal wave pool)
- Arena Intro: 2
- **Special Spawn:** Mid-wave, probability-based

**Behavior:** Flee
- Spawns mid-wave (30-45 seconds into wave)
- Attempts to flee toward arena edge
- Paths away from player using steering behavior
- If blocked, performs zig-zag + dash burst
- If stuck >2 seconds, teleports to new position
- Despawns if reaches escape radius (5 units from edge)
- Max 1 per wave, max 2 per run

**Spawn Rules:**
- Only spawns in Arena 2+
- Does not spawn during boss fights
- Does not spawn during stress pauses
- 30% probability if conditions met
- Spawns at random position near player

**Visual Profile:**
- Type: Glow
- Glow Intensity: 0.9 (very bright)
- Pulse Speed: 0.15 (fast pulse)
- Distinct gold color makes it highly visible

**Movement Signature:** Dash

**Telegraph:** None (non-threatening, no telegraph needed)

**Death VFX:** Burst (20 particles, gold 0xffd700)

**Reward:**
- Drops bonus XP reward orb (15 XP) if killed before escaping
- Reward orb has distinct gold visual with pulsing animation
- High contrast makes reward easy to spot

**Audio:**
- `onRunnerSpawn()` - Ascending chime when runner spawns
- `onRunnerKilled()` - Victory chime when runner is killed
- `onRunnerEscape()` - Subtle descending note if runner escapes

**Description:** A rare treasure carrier that spawns mid-wave and attempts to escape to the arena edge. Kill it before it escapes to claim bonus rewards! Creates an optional risk/reward moment: ignore for safety or chase for rewards.

**Teaching Purpose:** Risk/reward decision-making, optional objectives

---

### Pillar Police

**Tagline:** No Safe Haven

**Stats:**
- Size: 0.38 (Small-medium, agile)
- Health: 10
- Speed: 0.06 (ground), 0.4 (hop)
- Damage: 12
- Color: White (0xffffff)
- XP Value: 4

**Spawn Info:**
- Weight: 25 (common)
- Arena Intro: 3
- Max Arena: 4 (only spawns in Arena 3-4)
- **Arena 3 Signature Enemy**

**Behavior:** Pillar Hopper
- Hops between pillar tops
- Fast hop speed: 0.4
- Pause Duration: 30 frames (0.5s) after landing
- Detection Range: 6 units (detects player on same pillar)
- Aggressively pursues campers

**Visual Profile:**
- Type: Orbiter (two spheres orbiting each other)
- Glow Intensity: 0.8
- Orbit Speed: 0.15
- Orbit Radius: 0.5

**Movement Signature:** Orbiter

**Telegraph:** Crouch (200ms, light gray 0xcccccc)

**Death VFX:** Burst (10 particles, white)

**Description:** Vigilant enforcers of the arena. Pillar Police patrol the high ground, leaping between pillar tops with alarming speed. Think you can camp on a pillar? Think again.

**Teaching Purpose:** Anti-camping, vertical awareness, no safe zones

**Special Notes:**
- Only appears in arenas with pillars (Arena 3-4)
- Grace period: 1.5s after landing before hunting
- Corner pillars have ramp access

---

## Spawn Mechanics

### Spawn Safety

All spawns enforce post-clamp validation to prevent unfair placement:

- **Minimum Distance:** All enemies must spawn at least 8 units from the player (hardcoded `MIN_SPAWN_DIST = 8`)
- **Obstacle/Hazard Check:** Spawns are validated using `isValidEnemyPosition()` to prevent placement inside obstacles or hazard zones
- **Retry Logic:** If validation fails, spawns retry with new positions up to 10 times (single spawns) or skip the spawn (school followers)
- **Applies To:** Single spawns, school leaders, school followers, and bouncer spawns all validate distance and position

- **Minimum distance from player:** 8 units (enemies never spawn on top of the player)
- **Obstacle/hazard check:** `isValidEnemyPosition()` rejects spawns inside obstacles or hazard zones
- **Retry logic:** Up to 10 attempts with center-biased fallback if all retries fail
- **School spawns:** Follower positions also validated and adjusted if inside obstacles
- **`TUNING.spawnSafeZoneRadius`:** Additional distance floor (applies on top of the hard 8-unit minimum)

### Weighted Spawn System

Enemies are selected based on spawn weights during wave progression:

**Weight Categories:**
- **40+** (Very Common): Red Puffers
- **20-30** (Common): Guardian Crab, Fast Bouncers, Pillar Police
- **4-8** (Rare): Splitters, Teleporters
- **0** (Special): Boss minions, elite-only

**Selection Process:**
1. Filter enemies by arena availability
2. Apply cognitive type limit (max types per wave)
3. Weight each eligible enemy
4. Random weighted selection
5. Deduct threat budget cost

### Threat Budget System

Each wave has a total threat budget based on:
- Wave type (lesson, integration, exam)
- Arena scaling factor
- Wave modifier multiplier

**Enemy Costs:**
```
Cost = Durability Cost + Damage Cost

Durability Cost: Based on health
Damage Cost: Based on damage output
```

**Example Costs:**
- Red Puffer: ~15-20 points
- Guardian Crab: ~35-40 points (support force multiplier)
- Fast Bouncer: ~20-25 points
- Splitter: ~30-35 points (splits increase cost)
- Teleporter: ~25-30 points

### Cognitive Limits

**Max Types Per Wave (by Arena):**

| Arena | Max Enemy Types |
|-------|-----------------|
| 1     | 1               |
| 2     | 2               |
| 3     | 3               |
| 4     | 4               |
| 5     | 4               |
| 6     | 4               |

**Purpose:** Prevents visual chaos and maintains readable combat

**Featured Enemy:**
- Arena's `lessonEnemy` always included in wave pool
- Guarantees players encounter the lesson mechanic

### Arena Progression

**Enemy Unlock Timeline:**

| Arena | New Enemies | Available Pool |
|-------|-------------|----------------|
| 1     | Red Puffer | Red Puffer |
| 2     | Guardian Crab | Red Puffer, Guardian Crab |
| 3     | Pillar Police | Red Puffer, Guardian Crab, Pillar Police |
| 4     | Fast Bouncer | Red Puffer, Guardian Crab, Fast Bouncer (no PP) |
| 5     | Splitter | Red Puffer, Guardian Crab, Fast Bouncer, Splitter |
| 6     | Teleporter | All enemies |

**Note:** Pillar Police only spawn in Arena 3-4 (requires pillars)

### Boss Minion Spawns

Certain enemies ONLY spawn via boss summon ability:

**Shooter:**
- Summoned by bosses with `summon` ability
- Also appears as elite variant in elite waves
- Provides ranged pressure during boss fights

**Water Balloon:**
- Summoned by Overgrowth boss
- Creates hazard zone pressure
- Forces proactive elimination

**Fast Bouncer:**
- Summoned by Red Puffer King boss
- Also spawns normally in Arena 4+
- Tests dodging under pressure

### Elite Wave Modifiers

**Shield Breaker:**
- Only spawns in waves with "elite" modifier
- Represents upgraded, dangerous versions
- Higher threat, higher XP

---

## Behavioral Patterns

### Chase Behavior
**Enemies:** Red Puffer, Splitter

**Mechanics:**
- Direct pursuit of player
- Pathfinding around obstacles
- No special abilities
- Pure positioning threat

**Counter-play:** Movement, kiting, spacing

---

### Shooter Behavior
**Enemies:** Shooter

**Mechanics:**
- Maintains distance from player
- Fires projectiles at regular intervals
- Retreats when player approaches
- Preferred range: 10-15 units

**Shooting:**
- Cooldown: 2000ms (2 seconds)
- Projectile speed: Slow
- Telegraph: Flash before firing

**Counter-play:** Aggressive pursuit, dodge projectiles

---

### Bouncer Behavior
**Enemies:** Fast Bouncer

**Mechanics:**
- Bounces off walls and obstacles
- Slight homing toward player
- Maintains velocity between bounces
- Unpredictable trajectory

**Physics:**
- Velocity preserved on bounce
- Homing gradually adjusts direction
- Can bounce infinitely

**Counter-play:** Prediction, tracking, spatial awareness

---

### Shield Breaker Behavior
**Enemies:** Shield Breaker

**Mechanics:**
- Normal chase outside rush range
- Rush Range: 8 units
- When player enters range:
  - Telegraph (compress animation)
  - Rush at 4x speed
  - High damage on contact

**Counter-play:** Spacing, respect 8-unit danger zone, dodge rush

---

### Water Balloon Behavior
**Enemies:** Water Balloon

**Mechanics:**
- Slow approach
- Continuous growth
- Explodes at max size or on death
- Creates hazard zone

**Growth:**
- Rate: 0.002 per frame
- Visual: Size increases, intensity increases
- Unstoppable once started

**Counter-play:** Prioritize before critical mass

---

### Teleporter Behavior
**Enemies:** Teleporter

**Mechanics:**
- Slow walk toward player
- Teleport Cooldown: 3 seconds
- Teleports to random position within 8 units
- Visual telegraph before teleport

**Counter-play:** Damage between teleports, prediction

---

### Pillar Hopper Behavior
**Enemies:** Pillar Police

**Mechanics:**
- Hops between pillar tops
- Detects player on same pillar (6-unit range)
- Pause after landing (0.5s)
- Aggressive pursuit of campers

**Hopping:**
- Fast hop speed (0.4)
- Targets nearest pillar or player position
- Can hop to ground if player is there

**Counter-play:** Don't camp pillars, constant movement

---

## Visual Profiles

Visual profiles create distinct, recognizable enemies without geometric complexity.

### Glow Profile
**Type:** Steady or pulsing glow around sphere

**Properties:**
- Glow Intensity: 0.4-0.9
- Pulse Speed: 0-0.2 (0 = steady)

**Used By:** Red Puffer (mini porcupinefish), Shooter, Shield Breaker, Fast Bouncer

**Purpose:** Basic visibility, activity indication

---

### Pulse Profile
**Type:** Rhythmic size/intensity oscillation

**Properties:**
- Glow Intensity: 0.5
- Pulse Speed: 0.06-0.08
- Pulse Range: 0.3

**Used By:** Splitter

**Purpose:** Instability indication, warning

---

### Orbit Profile
**Type:** Particles orbiting the main sphere

**Properties:**
- Orbit Count: 3
- Orbit Radius: 0.5
- Orbit Speed: 0.05

**Used By:** (Legacy) None in current roster

**Purpose:** Shield visualization, durability indication

---

### Flicker Profile
**Type:** Intermittent visibility, phasing effect

**Properties:**
- Glow Intensity: 0.6
- Flicker Speed: 0.2

**Used By:** Teleporter

**Purpose:** Mobility indication, unstable presence

---

### Transparent Profile
**Type:** Semi-transparent with inner glow

**Properties:**
- Opacity: 0.6
- Glow Intensity: 0.4
- Pulse Speed: 0.06

**Used By:** Water Balloon

**Purpose:** Growth visibility, liquid appearance

---

### Orbiter Profile
**Type:** Two spheres orbiting each other

**Properties:**
- Glow Intensity: 0.8
- Orbit Speed: 0.15
- Orbit Radius: 0.5

**Used By:** Pillar Police

**Purpose:** Agility indication, paired patrol feel

---

## Implementation Guide

### Adding a New Enemy

**1. Configuration (`js/config/enemies.js`):**

```javascript
export const ENEMY_TYPES = {
    newEnemy: {
        name: 'New Enemy',
        size: 0.50,          // Choose size band
        health: 15,
        speed: 0.05,
        damage: 12,
        color: 0xff0000,     // Distinct color
        xpValue: 3,
        behavior: 'chase',   // Or custom behavior
        spawnWeight: 15,     // 0 for boss minion
        arenaIntro: 3,       // When it unlocks
        
        // Roster display (required)
        tagline: 'Short catchy phrase',
        description: 'Lore-friendly explanation',
        behaviorText: 'What it does in gameplay',
        
        // Visual profile
        visualProfile: {
            type: 'glow',
            glowIntensity: 0.5,
            pulseSpeed: 0.1
        },
        
        movementSignature: 'sway',
        telegraph: { type: 'flash', duration: 300, color: 0xff8888 },
        deathVfx: { color: 0xff0000, count: 12, type: 'burst' }
    }
};
```

**2. Behavior Implementation (`js/entities/enemies.js`):**

If using custom behavior:

```javascript
function updateEnemyAI(enemy, delta) {
    if (enemy.behavior === 'newBehavior') {
        handleNewBehavior(enemy, delta);
    }
}

function handleNewBehavior(enemy, delta) {
    // Your custom AI logic here
    // Update position, state, timers, etc.
}
```

**3. Threat Budget Cost (`js/config/constants.js`):**

```javascript
export const THREAT_BUDGET = {
    costs: {
        // ... existing
        newEnemy: {
            durability: 15,  // Based on health/shields
            damage: 10,      // Based on damage output
            cognitive: 1     // Cognitive load (1-3)
        }
    }
};
```

**4. Testing:**
- Spawn in appropriate arena
- Verify visual profile renders correctly
- Test behavior against player
- Confirm spawn weight feels appropriate
- Check XP value is balanced

### Modifying Existing Enemy

**To adjust difficulty:**
- Change `health`, `speed`, or `damage` values
- Adjust `spawnWeight` to make more/less common

**To change availability:**
- Modify `arenaIntro` to change unlock timing
- Add `maxArena` to restrict to certain arenas
- Set `spawnWeight: 0` and `isBossMinion: true` for boss-only

**To update visuals:**
- Modify `visualProfile` properties
- Change `color` value
- Update `deathVfx` configuration

**To add special mechanics:**
- Add new properties to enemy config
- Implement handling in behavior functions
- Consider adding telegraph if needed

### Boss Minion Setup

To make an enemy boss-minion only:

```javascript
{
    spawnWeight: 0,
    arenaIntro: null,
    isBossMinion: true
}
```

Then in boss summon ability, spawn specific enemy type.

### Elite Variant Setup

To make an enemy elite-only:

```javascript
{
    spawnWeight: 0,
    arenaIntro: null,
    isEliteOnly: true
}
```

Enemy will only spawn when "elite" wave modifier is active.

---

## File References

**Configuration Files:**
- `js/config/enemies.js` - Enemy stats, behaviors, visual profiles
- `js/config/constants.js` - Threat budget costs, global enemy constants
- `js/config/arenas.js` - Arena enemy progression

**Implementation Files:**
- `js/entities/enemies.js` - Enemy AI, behavior functions, spawn logic
- `js/systems/waveSystem.js` - Enemy spawning, wave management
- `js/effects/particles.js` - Enemy visual effects

**Related Documentation:**
- `docs/BOSS.md` - Boss system (includes boss summons)
- `docs/ARENA.md` - Arena progression and wave system
- `docs/PULSE_MUSIC_SYSTEM.md` - Enemy sound integration
