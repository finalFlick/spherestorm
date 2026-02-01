# Boss System Documentation

This document provides comprehensive reference for SPHERESTORM's boss system, including all boss behaviors, abilities, and implementation details.

## Table of Contents

- [Boss System Overview](#boss-system-overview)
- [Boss Roster](#boss-roster)
- [Ability System Reference](#ability-system-reference)
- [Phase System](#phase-system)
- [Implementation Guide](#implementation-guide)

---

## Boss System Overview

SPHERESTORM uses a **modular ability inheritance system** where each boss inherits ALL abilities from previous bosses and adds their own signature mechanic. This creates progressive complexity while maintaining familiar patterns.

### Core Concepts

**Ability Inheritance:**
- Boss 1 has abilities A + B
- Boss 2 has A + B + C + D
- Boss 3 has A + B + C + D + E
- And so on...

**Phase System:**
- All bosses have 3 health-based phases
- Phase 1: 100-66% HP
- Phase 2: 66-33% HP
- Phase 3: 33-0% HP

**Progressive Difficulty:**
- Telegraph times decrease per phase (faster attacks)
- Cooldowns decrease per phase (more frequent attacks)
- Ability weights shift (signature moves more common)
- Combo attacks unlock in Phase 2+

### Design Philosophy

Bosses are **puzzle tests**, not HP sponges:
- Each boss teaches a specific mechanic
- Phase transitions add complexity
- Patterns are learnable through repetition
- Fair telegraphs allow skilled play

---

## Boss Roster

### Arena 1: RED PUFFER KING

**Tagline:** Guardian of the First Gate

**Stats:**
- Health: 1,250 (scales with player level)
- Damage: 25
- Speed: 0.06
- Size: 2.5
- Color: Red (0xff2222)

**Signature Abilities:**
- **Charge** - Rushes at player with high speed
- **Summon** - Spawns Fast Bouncer minions

**Shield Mechanic:**
- Activates shield when summoning minions
- 75% damage reduction while active
- Loud ricochet feedback on hit
- 12-second failsafe timeout (prevents softlock)
- Shield breaks when all summoned minions are killed

**Exposed State:**
- Duration: 300 frames (5 seconds)
- Damage multiplier: 1.25x
- Visual: Rapid flashing effect

**Phase Progression:**

| Phase | HP Range | Charge Weight | Summon Weight | Behavior |
|-------|----------|---------------|---------------|----------|
| 1     | 100-66%  | 1.0           | 0.3           | Basic patterns |
| 2     | 66-33%   | 1.2           | 0.5           | Charge → Summon combos |
| 3     | 33-0%    | 1.5           | 0.7           | Aggressive combos |

**Arena Enemies:**
- Red Puffers (primary wave enemy)
- Fast Bouncers (boss summons)

**Design Lesson:** "Can you survive pressure?" - Tests basic movement, timing, and target prioritization.

---

### Arena 2: THE MONOLITH

**Tagline:** Master of Terrain

**Stats:**
- Health: 2,750
- Damage: 24
- Speed: 0.035
- Size: 2.8
- Color: Green (0x44ff88)

**Inherited Abilities:**
- Charge
- Summon

**Signature Abilities:**
- **Jump Slam** - Leaps into air and slams down, creating shockwave
- **Hazards** - Creates persistent danger zones

**Pillar Perch Mechanic:**
- Jumps onto nearby pillars when available
- Perch duration: 105 frames (1.75 seconds)
- Slam charge time: 45 frames (0.75 seconds)
- Slam radius: 6 units
- Slam damage: 30
- Cooldown: 360 frames (6 seconds)
- **Warning:** Visual marker appears before slam, giving reaction time

**Phase Progression:**

| Phase | HP Range | Jump Slam Weight | Hazards Weight | Key Combos |
|-------|----------|------------------|----------------|------------|
| 1     | 100-66%  | 1.0              | 0.8            | Individual attacks |
| 2     | 66-33%   | 1.3              | 1.0            | Jump Slam → Hazards |
| 3     | 33-0%    | 1.5              | 1.2            | Charge → Jump Slam |

**Arena Enemies:**
- Shielded (70% spawn ratio - arena signature)
- Red Puffers
- Fast Bouncers

**Design Lesson:** "Cover isn't safety - it's geometry." - Teaches that obstacles can become traps.

---

### Arena 3: THE ASCENDANT

**Tagline:** Beyond Space and Time

**Stats:**
- Health: 3,500
- Damage: 28
- Speed: 0.04
- Size: 3.0
- Color: Purple (0xaa44ff)

**Inherited Abilities:**
- Charge
- Summon
- Jump Slam
- Hazards

**Signature Ability:**
- **Teleport** - Warps to random positions, prefers elevated platforms

**Teleport Configuration:**
- Elevated platform preference: 70%
- Vulnerability window: 60 frames (1 second) after teleporting
- Visual: Origin and destination VFX markers

**Combo Delays (Fair Reaction Windows):**
- Teleport → Charge: 25 frames (0.4s gap)
- Teleport → Jump Slam: 20 frames (0.33s gap)

**Phase Progression:**

| Phase | HP Range | Teleport Weight | Key Feature |
|-------|----------|-----------------|-------------|
| 1     | 100-66%  | 1.0             | Basic teleports |
| 2     | 66-33%   | 1.3             | Teleport combos begin |
| 3     | 33-0%    | 1.6             | Aggressive chaining |

**Arena Enemies:**
- Pillar Police (signature - anti-camping)
- Shielded
- Red Puffers
- Fast Bouncers

**Minion Spawns:**
- Summons Teleporter minions

**Design Lesson:** "Distance is a lie." - Demands spatial awareness and vertical thinking.

---

### Arena 4: THE OVERGROWTH

**Tagline:** Endless Multiplication

**Stats:**
- Health: 4,250
- Damage: 26
- Speed: 0.03
- Size: 3.2
- Color: Cyan (0x44ffff)

**Inherited Abilities:**
- Charge
- Summon
- Jump Slam
- Hazards
- Teleport

**Signature Abilities:**
- **Growth** - Boss size increases over time
- **Split** - At 25% HP, splits into 3 mini-bosses

**Lane Walls Configuration:**
- Creates temporary corridor walls (foreshadows Arena 5 tunnels)
- Wall count: 2
- Wall duration: 180 frames (3 seconds)
- Wall height: 4 units
- Wall length: 20 units
- Warning time: 45 frames (0.75 seconds)
- Cooldown: 300 frames (5 seconds)

**Split Mechanic:**
- Triggers at 25% HP
- Creates 3 mini-bosses with reduced health
- Each retains dangerous abilities
- Player must eliminate all three to win

**Phase Progression:**

| Phase | HP Range | Growth Weight | Split Weight | Key Feature |
|-------|----------|---------------|--------------|-------------|
| 1     | 100-66%  | 1.0           | 0.0          | Steady growth |
| 2     | 66-33%   | 1.2           | 0.5          | Growth → Summon combos |
| 3     | 33-0%    | 1.4           | 1.0          | Split activation possible |

**Arena Enemies:**
- Fast Bouncers (high spawn rate)
- Splitters
- Shielded
- Red Puffers

**Minion Spawns:**
- Summons Water Balloon minions (grow and explode)

**Design Lesson:** "Space control through multiplicity." - Teaches retreat and resource management.

---

### Arena 5: THE BURROWER

**Tagline:** Terror From Below

**Stats:**
- Health: 5,000
- Damage: 32
- Speed: 0.035
- Size: 3.5
- Color: Magenta (0xff44ff)

**Inherited Abilities:**
- Charge
- Summon
- Jump Slam
- Hazards
- Teleport
- Growth
- Split

**Signature Ability:**
- **Burrow** - Digs underground, becomes invulnerable, emerges near player

**Burrow Configuration:**
- Emerge warning time: 45 frames (0.75 seconds)
- Emerge damage radius: 5 units
- Emerge hazard zone:
  - Radius: 3 units
  - Duration: 180 frames (3 seconds)

**Combo Delays:**
- Burrow → Charge: 40 frames (0.67s gap)
- Burrow → Jump Slam: 35 frames (0.58s gap)
- Teleport → Burrow: 20 frames (short delay)

**Phase Progression:**

| Phase | HP Range | Burrow Weight | Key Combos |
|-------|----------|---------------|------------|
| 1     | 100-66%  | 1.0           | Basic burrows |
| 2     | 66-33%   | 1.3           | Burrow → Charge |
| 3     | 33-0%    | 1.6           | Multi-ability chains |

**Arena Enemies:**
- Splitters (signature - corridor threats)
- All previous enemy types
- Heavy focus on crowd control

**Design Lesson:** "You don't see the threat until it's behind you." - Corridor navigation becomes deadly.

---

### Arena 6: CHAOS INCARNATE

**Tagline:** The Final Examination

**Stats:**
- Health: 7,500
- Damage: 40
- Speed: 0.05
- Size: 4.0
- Color: White (0xffffff) - shifts based on cycle

**All Abilities:**
- Charge
- Summon
- Jump Slam
- Hazards
- Teleport
- Growth
- Split
- Burrow

**Cyclic Pattern System:**

Boss cycles through three predictable phases:

1. **Movement Phase** (Red 0xff4444)
   - Emphasis: Teleport, Burrow, Charge
   - High mobility, hard to pin down

2. **Area Control Phase** (Green 0x44ff44)
   - Emphasis: Jump Slam, Hazards, Growth
   - Zone denial, positioning pressure

3. **Summons Phase** (Blue 0x4444ff)
   - Emphasis: Summon, Split
   - Minion pressure, target prioritization

**Color Shifts:**
- Boss color changes to match current cycle
- Provides visual feedback for pattern prediction

**Phase 3 Combos (2-ability chains):**
- Teleport → Charge
- Burrow → Jump Slam
- Growth → Summon
- Jump Slam → Hazards

**Combo Delays:**
- Teleport → Charge: 30 frames (0.5s)
- Burrow → Jump Slam: 35 frames (0.58s)
- Growth → Summon: 25 frames (0.42s)
- Jump Slam → Hazards: 20 frames (0.33s)

**Arena Enemies:**
- Teleporters (signature)
- All unlocked enemy types
- Breather waves at waves 3, 6, 9
- Most diverse enemy pool

**Design Lesson:** "The program stops teaching. It measures." - Pattern mastery and synthesis.

---

## Ability System Reference

### Core Abilities

#### 1. Charge
**Description:** Boss locks onto player position and rushes forward at high speed.

**Mechanics:**
- Speed: 0.35 (base boss speed × 7-10)
- Creates damage trail in Phase 2+ (Red Puffer King)
- Visual telegraph before charge begins

**Cooldowns:**
- Base: 90 frames (1.5 seconds)

**Telegraph Times:**
- Phase 1: 30 frames (0.5s)
- Phase 2: 25 frames (0.42s)
- Phase 3: 18 frames (0.3s)

**Used By:** All bosses

---

#### 2. Summon
**Description:** Spawns enemy minions to overwhelm the player.

**Mechanics:**
- Summoned enemies link to boss with tethers
- Red Puffer King: Spawns Fast Bouncers, activates shield
- Other bosses: Various minion types

**Cooldowns:**
- Base: 150 frames (2.5 seconds)

**Telegraph Times:**
- Phase 1: 25 frames
- Phase 2: 20 frames
- Phase 3: 15 frames

**Used By:** All bosses

---

#### 3. Jump Slam
**Description:** Boss leaps into air and slams down, creating damaging shockwave.

**Mechanics:**
- Jump target selected during telegraph
- Slam radius: 6 units (default)
- Can land on pillars (Monolith)
- Creates hazard zones on impact

**Cooldowns:**
- Base: 120 frames (2 seconds)

**Telegraph Times:**
- Phase 1: 40 frames (0.67s)
- Phase 2: 30 frames (0.5s)
- Phase 3: 22 frames (0.37s)

**Used By:** Monolith, Ascendant, Overgrowth, Burrower, Chaos Incarnate

---

#### 4. Hazards
**Description:** Creates persistent danger zones that damage on contact.

**Mechanics:**
- Duration: 180-300 frames (3-5 seconds)
- Visual: Glowing danger circles
- Can spawn from jump slams or independently
- Water Balloon explosions create hazards

**Cooldowns:**
- Base: 100 frames (1.67 seconds)

**Telegraph Times:**
- Phase 1: 20 frames
- Phase 2: 15 frames
- Phase 3: 10 frames

**Used By:** Monolith, Ascendant, Overgrowth, Burrower, Chaos Incarnate

---

#### 5. Teleport
**Description:** Boss vanishes and reappears at a new location.

**Mechanics:**
- Prefers elevated platforms (70% chance)
- 60-frame vulnerability window after arrival
- Origin and destination VFX
- Can combo into other abilities

**Cooldowns:**
- Base: 80 frames (1.33 seconds)

**Telegraph Times:**
- Phase 1: 25 frames
- Phase 2: 20 frames
- Phase 3: 12 frames

**Used By:** Ascendant, Overgrowth, Burrower, Chaos Incarnate

---

#### 6. Growth
**Description:** Boss gradually increases in size over time.

**Mechanics:**
- Size increases throughout fight
- Affects hitbox and threat presence
- Can spawn vine DOT zones (Overgrowth Phase 2+)

**Cooldowns:**
- Base: 200 frames (3.33 seconds)

**Telegraph Times:**
- Phase 1: 30 frames
- Phase 2: 25 frames
- Phase 3: 18 frames

**Used By:** Overgrowth, Burrower, Chaos Incarnate

---

#### 7. Split
**Description:** Boss fragments into multiple copies.

**Mechanics:**
- Triggers at 25% HP (Overgrowth)
- Creates 3 mini-bosses
- Each retains abilities but reduced health
- All must be defeated to win

**Cooldowns:**
- Base: 300 frames (5 seconds)

**Telegraph Times:**
- Phase 1: 40 frames
- Phase 2: 30 frames
- Phase 3: 20 frames

**Used By:** Overgrowth, Burrower, Chaos Incarnate

---

#### 8. Burrow
**Description:** Boss digs underground, becomes invulnerable, emerges elsewhere.

**Mechanics:**
- Boss disappears (invulnerable)
- 45-frame warning at emerge location
- 5-unit damage radius on emerge
- Leaves 3-second hazard zone

**Cooldowns:**
- Base: 150 frames (2.5 seconds)

**Telegraph Times:**
- Phase 1: 35 frames
- Phase 2: 28 frames
- Phase 3: 20 frames

**Used By:** Burrower, Chaos Incarnate

---

### Combo System

**Phase 2+ Unlock:**
- Bosses begin chaining abilities together
- Combo delays ensure fair reaction windows

**Combo Mechanics:**
- Boss locks into combo sequence
- Visual tether connects abilities
- Chain indicator shows upcoming ability
- Delays between combo steps vary by combination

**Example Combos:**
- Teleport → Charge (0.4s delay)
- Burrow → Jump Slam (0.58s delay)
- Jump Slam → Hazards (0.33s delay)
- Growth → Summon (0.42s delay)

**Fair Play Design:**
- Every combo has mandatory delay
- Telegraphs still appear for each ability
- Player always has reaction window

---

## Phase System

### Health Thresholds

All bosses transition through phases based on remaining HP:

```
Phase 1: 100% → 66% HP (learning phase)
Phase 2: 66% → 33% HP (complexity increase)
Phase 3: 33% → 0% HP (desperation/mastery test)
```

### Phase Transition Mechanics

**Delay:** 60 frames (1 second) after threshold is crossed

**Visual Feedback:**
- Phase announcement UI
- Boss color intensity change
- Music layer increase

### Per-Phase Changes

#### Telegraph Times
Abilities execute faster in later phases:

| Ability | Phase 1 | Phase 2 | Phase 3 |
|---------|---------|---------|---------|
| Charge | 30f | 25f | 18f |
| Summon | 25f | 20f | 15f |
| Jump Slam | 40f | 30f | 22f |
| Teleport | 25f | 20f | 12f |
| Burrow | 35f | 28f | 20f |

#### Ability Weights
Signature abilities become more likely:

**Example (Burrower):**
- Phase 1: Burrow weight 1.0
- Phase 2: Burrow weight 1.3 (+30%)
- Phase 3: Burrow weight 1.6 (+60%)

#### Combo Availability
- Phase 1: Single abilities only
- Phase 2: 2-ability combos unlock
- Phase 3: More frequent combos, faster execution

---

## Implementation Guide

### Adding a New Boss

**1. Configuration (`js/config/bosses.js`):**

```javascript
export const BOSS_CONFIG = {
    7: { // New boss number
        name: 'THE NEW BOSS',
        health: 6000,
        damage: 35,
        size: 3.8,
        color: 0xffaa00,
        speed: 0.045,
        
        // Roster display
        tagline: 'Short catchy phrase',
        description: 'Lore-friendly explanation of role',
        behaviorText: 'What it does in gameplay',
        
        // Abilities (inherit all + add signature)
        abilities: {
            charge: true,
            summon: true,
            jumpSlam: true,
            hazards: true,
            teleport: true,
            growth: true,
            split: true,
            burrow: true,
            newAbility: true  // Your signature ability
        },
        
        // Ability weights per phase
        abilityWeights: {
            charge: [0.5, 0.6, 0.7],
            summon: [0.3, 0.4, 0.5],
            // ... others
            newAbility: [1.0, 1.3, 1.6]
        },
        
        // Phase-specific combos
        phaseCombos: {
            2: [['newAbility', 'charge']],
            3: [['newAbility', 'charge'], ['teleport', 'newAbility']]
        },
        
        // Combo delays (fair reaction windows)
        comboDelays: {
            'newAbility_charge': 30,
            'teleport_newAbility': 25
        }
    }
};
```

**2. Implementation (`js/entities/boss.js`):**

Add AI state handling in `updateBossAI()` function:

```javascript
if (boss.abilities.newAbility && shouldUseAbility(boss, 'newAbility')) {
    boss.aiState = 'newAbility';
    boss.aiTimer = 0;
    boss.abilityCooldowns.newAbility = ABILITY_COOLDOWNS.newAbility;
}

// Add state handler
if (boss.aiState === 'newAbility') {
    handleNewAbility(boss);
}
```

**3. Arena Badge (`js/config/badges.js`):**

```javascript
{
    id: 'arena_7',
    name: 'Arena 7 Champion',
    description: 'Defeated THE NEW BOSS',
    icon: '⚔️',
    arena: 7,
    persistent: true
}
```

**4. Arena Configuration (`js/config/arenas.js`):**

```javascript
7: {
    name: 'The New Arena',
    waves: 8,
    features: ['flat', 'pillars', 'vertical', 'platforms', 'tunnels', 'hazards', 'newFeature'],
    color: 0x4a3a2a,
    lore: 'Description of the arena',
    teaches: 'What mechanic this arena teaches',
    bossLesson: 'What the boss tests',
    lessonEnemy: 'enemyType'
}
```

### Adding a New Ability

**1. Define in Constants (`js/config/bosses.js`):**

```javascript
export const ABILITY_COOLDOWNS = {
    // ... existing
    newAbility: 120
};

export const ABILITY_TELLS = {
    // ... existing
    newAbility: { phase1: 35, phase2: 28, phase3: 20 }
};
```

**2. Implement Behavior (`js/entities/boss.js`):**

```javascript
function handleNewAbility(boss) {
    const tell = getAbilityTell(boss, 'newAbility');
    
    if (boss.aiTimer < tell) {
        // Telegraph phase - show warning VFX
        if (boss.aiTimer === 0) {
            createAbilityTelegraph(boss, 'newAbility');
        }
    } else if (boss.aiTimer === tell) {
        // Execution phase - do the thing
        executeNewAbility(boss);
    } else if (boss.aiTimer > tell + abilityDuration) {
        // Cleanup and return to idle
        cleanupAbilityVFX(boss, 'newAbility');
        boss.aiState = 'idle';
        boss.aiTimer = 0;
    }
}

function executeNewAbility(boss) {
    // Your ability logic here
}
```

**3. Add to Boss Configs:**

Update any bosses that should use this ability in their `abilities` and `abilityWeights` objects.

### Modifying Existing Boss

**To adjust difficulty:**
- Change `health`, `damage`, or `speed` values
- Adjust `abilityWeights` to make certain attacks more/less common
- Modify telegraph times in `ABILITY_TELLS`

**To change behavior:**
- Update `phaseCombos` to add/remove combo chains
- Adjust `comboDelays` for reaction time balance
- Modify special mechanics (shield config, teleport config, etc.)

**To add combos:**
- Add to `phaseCombos` object in boss config
- Define delay in `comboDelays` object
- Test for fairness (player must have time to react)

---

## File References

**Configuration Files:**
- `js/config/bosses.js` - Boss stats, abilities, weights, combos
- `js/config/constants.js` - Global boss constants, damage values
- `js/config/badges.js` - Arena completion badges

**Implementation Files:**
- `js/entities/boss.js` - Boss AI, ability execution, state machine
- `js/systems/visualFeedback.js` - Boss VFX (telegraphs, markers, effects)
- `js/systems/waveSystem.js` - Boss spawning, arena progression
- `js/ui/hud.js` - Boss health bar, phase announcements

**Related Documentation:**
- `docs/ENEMIES.md` - Enemy types (including boss summons)
- `docs/ARENA.md` - Arena system and progression
- `docs/PULSE_MUSIC_SYSTEM.md` - Boss music integration
