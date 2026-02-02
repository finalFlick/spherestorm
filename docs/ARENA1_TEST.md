# Arena 1 Features Test Document

This document lists all Arena 1 features implemented, organized for manual testing with debug logging.

---

## Terminology

**Wave vs Segment:**
- **Wave**: Individual combat encounter (global counter: 1, 2, 3, 4, 5, 6, 7)
- **Segment**: Group of waves between boss encounters
  - Segment 1 = Waves 1-3
  - Segment 2 = Waves 4-5  
  - Segment 3 = Waves 6-7
- **Boss Encounter**: Boss fight after each segment (Phase 1, Phase 2, Phase 3)

**Total Arena 1 Structure:** 7 waves + 3 boss encounters

---

## Epic 1: Enemy Size Ramp System

**Goal:** Arena 1 introduces enemies gradually by size tier.

### Features
- **1.1 Tiny Puffer** - Small, 1-hit enemies exclusive to Wave 1
- **1.2 Standard Puffer** - Medium enemies introduced in Wave 2+
- **1.3 Big Puffer** - Large, tanky enemies introduced in Wave 3+
- **1.4 Size Progression** - Enemy composition scales across waves

### Test Points

| ID | Feature | Expected Behavior | Log Tag |
|----|---------|-------------------|---------|
| E1-1 | Wave 1 Composition | Only Tiny Puffers spawn | `[SizeRamp]` |
| E1-2 | Wave 2 Composition | Mix of Tiny + Standard, rare Big | `[SizeRamp]` |
| E1-3 | Wave 3 Composition | All three sizes present | `[SizeRamp]` |
| E1-4 | Tiny Health | Dies in 1 hit at base damage | `[SizeRamp]` |
| E1-5 | Big Health | Takes 3+ hits to kill | `[SizeRamp]` |

### Debug Logs
```
[SizeRamp] Wave X: Spawning TYPE (minWave=Y, current=Z)
[SizeRamp] Enemy spawned: type=TYPE, health=HP, size=SIZE
```

---

## Epic 2: School Formation System

**Goal:** Enemies spawn in coordinated groups with leader/follower behavior.

### Features
- **2.1 School Spawning** - Groups spawn together with shared cue
- **2.2 Leader/Follower** - One leader, followers maintain formation
- **2.3 Formation Holding** - Formation persists during movement
- **2.4 Leader Death Handling** - Followers scatter when leader dies
- **2.5 School Frequency Ramp** - More schools in later waves

### Test Points

| ID | Feature | Expected Behavior | Log Tag |
|----|---------|-------------------|---------|
| E2-1 | Wave 1 Schools | No schools spawn | `[School]` |
| E2-2 | Wave 2 Schools | ~10% chance per spawn | `[School]` |
| E2-3 | Wave 3 Schools | ~25% chance per spawn | `[School]` |
| E2-4 | Formation Movement | Followers track leader smoothly | `[School]` |
| E2-5 | Leader Death | Followers become independent | `[School]` |
| E2-6 | Max Schools | Never more than 2 active schools | `[School]` |

### Debug Logs
```
[School] Wave X: school chance=Y%, rolled=Z, spawning=BOOL
[School] Spawning school: size=N, leader=ID, type=TYPE
[School] Active schools: COUNT/MAX
[School] Leader ID died, followers scattered: COUNT
```

---

## Epic 3: Spawn Choreography

**Goal:** Spawn patterns create wave identity and readability.

### Features
- **3.1 Random Spawns** - Wave 1 uses random edge spawns
- **3.2 Lane Flood** - Wave 2 spawns from single direction
- **3.3 Pincer** - Wave 3 spawns from opposite edges

### Test Points

| ID | Feature | Expected Behavior | Log Tag |
|----|---------|-------------------|---------|
| E3-1 | Wave 1 Pattern | Spawns from random edges | `[Choreography]` |
| E3-2 | Wave 2 Pattern | Spawns from one dominant edge | `[Choreography]` |
| E3-3 | Wave 3 Pattern | Spawns alternate between 2 opposite edges | `[Choreography]` |

### Debug Logs
```
[Choreography] Wave X: pattern=PATTERN, direction=DIR
[Choreography] Spawn at edge: EDGE (x=X, z=Z)
```

---

## Epic 4: Boss Chase Orchestrator

**Goal:** Boss appears multiple times across Arena 1, escalating each return.

### Features
- **4.1 Chase State Init** - `arena1ChaseState` created on Arena 1 start
- **4.2 Segment Tracking** - Tracks which segment of the fight
- **4.3 Wave Counting** - Counts waves within each segment
- **4.4 Persistent HP** - Boss HP carries across encounters

### Test Points

| ID | Feature | Expected Behavior | Log Tag |
|----|---------|-------------------|---------|
| E4-1 | State Init | `arena1ChaseState` exists after Arena 1 loads | `[BossChase]` |
| E4-2 | Segment 1 | Waves 1-3 → Boss Phase 1 | `[BossChase]` |
| E4-3 | Segment 2 | Waves 4-5 → Boss Phase 2 | `[BossChase]` |
| E4-4 | Segment 3 | Waves 6-7 → Boss Phase 3 | `[BossChase]` |
| E4-5 | HP Persistence | Boss returns with same HP as retreat | `[BossChase]` |

### Debug Logs
```
[BossChase] Init: segment=1, phase=1, encounters=0
[BossChase] State: segment=X, phase=Y, encounters=Z, persistentHP=HP
[BossChase] shouldBossReturn: wave=X, segment=Y, target=Z, return=BOOL
```

---

## Epic 5: Boss Phase Locking

**Goal:** Boss is locked to specific ability kit per encounter.

### Features
- **5.1 Phase Lock Flag** - `boss.phaseLocked = true` prevents auto-transition
- **5.2 Phase 1 Kit** - Charge ability only
- **5.3 Phase 2 Kit** - Summon + Shield (static mode)
- **5.4 Phase 3 Kit** - Full ability set

### Test Points

| ID | Feature | Expected Behavior | Log Tag |
|----|---------|-------------------|---------|
| E5-1 | P1 Abilities | Boss only uses charge in Phase 1 | `[PhaseLock]` |
| E5-2 | P2 Abilities | Boss uses summon/shield, not charge | `[PhaseLock]` |
| E5-3 | P3 Abilities | Boss uses all abilities | `[PhaseLock]` |
| E5-4 | No Auto Phase | HP thresholds don't trigger phase change | `[PhaseLock]` |

### Debug Logs
```
[PhaseLock] Boss spawned: phase=X, phaseLocked=BOOL
[PhaseLock] Ability attempted: ABILITY, phase=X, allowed=BOOL
[PhaseLock] Auto-phase blocked: HP%=X, would be phase Y
```

---

## Epic 6: Boss Retreat System

**Goal:** Boss retreats at phase thresholds instead of dying.

### Features
- **6.1 Retreat Threshold** - P1 at 66% HP, P2 at 33% HP
- **6.2 Retreat Detection** - Checked on damage before death
- **6.3 Retreat State** - `BOSS_RETREAT` wave state
- **6.4 Invulnerability** - Boss can't be damaged during retreat
- **6.5 Retreat Animation** - Shrink + rise + spin

### Test Points

| ID | Feature | Expected Behavior | Log Tag |
|----|---------|-------------------|---------|
| E6-1 | P1 Retreat HP | Boss retreats at ~833 HP (66% of 1250) | `[Retreat]` |
| E6-2 | P2 Retreat HP | Boss retreats at ~416 HP (33% of 1250) | `[Retreat]` |
| E6-3 | P3 No Retreat | Boss dies at 0 HP | `[Retreat]` |
| E6-4 | Retreat Invuln | Boss takes no damage during retreat | `[Retreat]` |
| E6-5 | Wave State | State changes to BOSS_RETREAT | `[Retreat]` |

### Debug Logs
```
[Retreat] Check: HP=X, threshold=Y, canRetreat=BOOL
[Retreat] Triggered! Phase X cleared, HP=Y
[Retreat] Animation: frame=X/60, scale=Y
[Retreat] Complete: segment now=X, encounters=Y
```

---

## Epic 7: Boss Return Logic

**Goal:** Boss returns after segment waves are cleared.

### Features
- **7.1 Return Trigger** - `shouldBossReturn()` check in wave clear
- **7.2 Phase Increment** - Next encounter uses next phase kit
- **7.3 HP Restoration** - Uses persistent HP, not max HP

### Test Points

| ID | Feature | Expected Behavior | Log Tag |
|----|---------|-------------------|---------|
| E7-1 | Return After W5 | Boss returns for P2 after wave 5 clear | `[BossReturn]` |
| E7-2 | Return After W7 | Boss returns for P3 after wave 7 clear | `[BossReturn]` |
| E7-3 | HP Value | Returned boss has same HP as retreat | `[BossReturn]` |

### Debug Logs
```
[BossReturn] Wave clear: wave=X, checking return...
[BossReturn] Returning for Phase X, persistentHP=Y
[BossReturn] Boss spawned with HP=X (from persistent=Y)
```

---

## Epic 8: Transition Safety

**Goal:** No cheap hits during boss entrance/exit.

### Features
- **8.1 Entrance Invuln** - Boss can't damage player for 60 frames
- **8.2 Enemy Freeze** - Enemies frozen for 60 frames on retreat
- **8.3 Center Clear** - Enemies cleared near boss spawn area
- **8.4 No Damage Flag** - `boss.canDamagePlayer = false` during entrance

### Test Points

| ID | Feature | Expected Behavior | Log Tag |
|----|---------|-------------------|---------|
| E8-1 | Entrance Safety | Standing near boss on spawn = no damage | `[Safety]` |
| E8-2 | Retreat Safety | No enemy damage during transition | `[Safety]` |
| E8-3 | Freeze Duration | Enemies resume after ~1 second | `[Safety]` |

### Debug Logs
```
[Safety] Entrance: frame=X/60, canDamagePlayer=BOOL
[Safety] Enemies frozen: COUNT enemies for FRAMES frames
[Safety] Center cleared: removed COUNT enemies
[Safety] Freeze expired for enemy ID
```

---

## Epic 9: Retreat VFX and Feedback

**Goal:** Clear visual/audio feedback on phase victory.

### Features
- **9.1 Phase Banner** - "PHASE CLEARED!" announcement
- **9.2 Screen Flash** - Green flash on retreat
- **9.3 Slow-Mo** - Brief slow motion effect
- **9.4 Retreat Pulse** - Expanding ring VFX
- **9.5 Particle Burst** - Particles on retreat

### Test Points

| ID | Feature | Expected Behavior | Log Tag |
|----|---------|-------------------|---------|
| E9-1 | Banner | "PHASE CLEARED!" shows on retreat | `[VFX]` |
| E9-2 | Flash | Green screen flash occurs | `[VFX]` |
| E9-3 | Ring | Expanding ring VFX visible | `[VFX]` |
| E9-4 | Audio | Phase change audio plays | `[VFX]` |

### Debug Logs
```
[VFX] Retreat pulse spawned at (X, Y, Z)
[VFX] Screen flash: color=0xCOLOR
[VFX] Slow-mo: frames=X, scale=Y
```

---

## Epic 10: Wave Speed Bonus

**Goal:** Reward fast wave clears with score bonus.

### Features
- **10.1 Timer Tracking** - Wave start time recorded
- **10.2 Bonus Formula** - Up to 300 points for fast clears

### Test Points

| ID | Feature | Expected Behavior | Log Tag |
|----|---------|-------------------|---------|
| E10-1 | Fast Clear | Sub-10s clear = +200 points | `[SpeedBonus]` |
| E10-2 | Normal Clear | 20s clear = +100 points | `[SpeedBonus]` |
| E10-3 | Slow Clear | 30s+ clear = no bonus | `[SpeedBonus]` |

### Debug Logs
```
[SpeedBonus] Wave start recorded: TIME
[SpeedBonus] Wave cleared in Xs, bonus=+POINTS
```

---

## Full Run Test Sequence

### Pre-flight
- [ ] Hard refresh browser (clear cache)
- [ ] Open browser console (F12)
- [ ] Filter console by relevant tags

### Test Run

1. **Start fresh Arena 1 run**
   - Verify `[BossChase] Init` log appears

2. **Wave 1** (Tiny only, random spawns)
   - [ ] E1-1: Only Tiny Puffers
   - [ ] E2-1: No schools
   - [ ] E3-1: Random edge spawns

3. **Wave 2** (Mix, lane flood)
   - [ ] E1-2: Tiny + Standard mix
   - [ ] E2-2: ~10% school chance
   - [ ] E3-2: Single edge spawns

4. **Wave 3** (All sizes, pincer)
   - [ ] E1-3: All three sizes
   - [ ] E2-3: ~25% school chance
   - [ ] E3-3: Alternating edges

5. **Boss Phase 1**
   - [ ] E4-2: Boss spawns after wave 3
   - [ ] E5-1: Charge ability only
   - [ ] E6-1: Retreats at ~833 HP
   - [ ] E8-1: No damage during entrance

6. **Waves 4-5**
   - [ ] E7-1: Boss returns after wave 5

7. **Boss Phase 2**
   - [ ] E5-2: Summon + Shield only
   - [ ] E6-2: Retreats at ~416 HP
   - [ ] E4-5: HP matches retreat value

8. **Waves 6-7**
   - [ ] E7-2: Boss returns after wave 7

9. **Boss Phase 3**
   - [ ] E5-3: Full ability kit
   - [ ] E6-3: Dies at 0 HP
   - [ ] Portal spawns

---

## Log Tag Reference

| Tag | Epic | Description |
|-----|------|-------------|
| `[SizeRamp]` | 1 | Enemy size tier spawning |
| `[School]` | 2 | School formation system |
| `[Choreography]` | 3 | Spawn pattern selection |
| `[BossChase]` | 4 | Chase state management |
| `[PhaseLock]` | 5 | Phase ability restrictions |
| `[Retreat]` | 6 | Boss retreat mechanics |
| `[BossReturn]` | 7 | Boss return after waves |
| `[Safety]` | 8 | Transition safety systems |
| `[VFX]` | 9 | Visual feedback effects |
| `[SpeedBonus]` | 10 | Wave clear speed bonus |
