# Playtest Checklist (Issue Verification + Balance Feel Tests)

Use this document to verify every open issue and capture “what feels better” feedback during balance passes.

Guidance:
- Use **ratings** (1–5) for feel. Write a 1-sentence reason.
- Prefer **short sessions** (10–15 min) over marathon runs.
- Change **one variable at a time**, re-test, then decide.
- For “fresh eyes” sessions, don’t explain mechanics until after the first run.

---

## 1) Pre-Session Setup

- Build/version: `v_____`
- Date: `YYYY-MM-DD`
- Tester: `__________` (name/handle)
- Input device: `KBM / Controller`
- Audio: `On / Off` (headphones recommended)
- Starting point:
  - Arena: `1 / 2 / 3 / 4 / 5 / 6`
  - Wave: `____`
  - Boss test: `Yes / No`
- Notes (anything unusual): `________________________________________`

---

## 2) Bug Verification

### Issue #35 — Boss Trail Cleanup Bug

Goal: ensure **no ghost trails** remain after boss death/retreat.

- Step: Reach Boss Phase 2 where charge trails occur
  - Result: `Pass / Fail`
- Step: Trigger boss charge, confirm trails appear
  - Result: `Pass / Fail`
- Step: Kill boss mid-charge → trails disappear within ~0.5s
  - Result: `Pass / Fail`
  - Notes: `________________________________________`
- Step: Trigger retreat mid-charge → trails disappear within ~0.5s
  - Result: `Pass / Fail`
  - Notes: `________________________________________`
- Step: After boss is gone, player can’t take damage from trail remnants
  - Result: `Pass / Fail`

---

## 3) Tuning / Balance Feel Tests

General rubric:
- **1** = frustrating/unreadable, **3** = workable, **5** = great
- Keep runs comparable (same arena, similar upgrades)

### Issue #30 — Game Pace (Breathing Room)

Record death causes + how often you felt “forced to kite forever”.

Try variants (one per run):
- Variant A: Current baseline
- Variant B: Slightly slower spawns
- Variant C: Add a short “breathing beat” mid-wave
- Variant D: Slightly slower enemy speed

For each run:
- Variant: `A / B / C / D`
- Feel rating: `1 2 3 4 5`
- Notes: `________________________________________`
- Top death cause: `________________________________________`
- “2x speed” feeling? `Yes / No`

### Issue #28 — XP Orb Despawn

Goal: XP urgency without “I lost the run because gems vanished.”

For each run:
- XP despawn seconds: `____`
- Lost significant XP to despawns? `Yes / No`
- Did despawn create interesting routing decisions? `Yes / No`
- Feel rating: `1 2 3 4 5`
- Notes: `________________________________________`

### Issue #29 — Upgrade Balance (Fire Rate Dominance)

Goal: **2–3 viable** early build directions (not always fire rate first).

Do 3 runs:
- Run 1: play “normally” (pick what you want)
- Run 2: avoid fire rate unless forced
- Run 3: prioritize a non-fire-rate identity (damage, projectiles, range, etc.)

For each run:
- First pick: `__________`
- Build theme: `__________`
- Was it viable? `Yes / No`
- Most fun moment: `________________________________________`
- Biggest frustration: `________________________________________`

### Issue #33 — Jump / Landing Feel

Goal: manta fantasy = **graceful**, not “brick slam”.

For each run (or in an empty arena):
- Gravity multiplier: `____`
- Apex hover (if available): `On / Off`
- Soft landing (if available): `On / Off`
- Feel rating: `1 2 3 4 5`
- Notes: `________________________________________`

### Issue #48 — Enemy Color Tier Rebalance (Yellow/Blue)

Goal: players can **recognize** and **explain counterplay** quickly.

Questions (after 2 waves with Yellow + Blue present):
- Can you describe Yellow vs Red difference in 1 sentence?
  - Answer: `________________________________________`
- Does Yellow specifically punish endless kiting?
  - Result: `Yes / No`
- For Blue/shielded: is the shield break rule obvious?
  - Result: `Yes / No`
- Can you state counterplay in 1 sentence?
  - Answer: `________________________________________`

### Issue #50 — Boss Ramp & Phase Teaching

Goal: phase 1 teaches, phase 2 remixes + adds one constraint, phase 3 pressure-tests.

For each phase:
- Phase I: Could you identify the core “lesson”?
  - Result: `Yes / No`
  - Notes: `________________________________________`
- Phase II: Did you notice a clear change + understand it?
  - Result: `Yes / No`
  - Notes: `________________________________________`
- Phase III: Did difficulty increase without feeling unfair?
  - Result: `Yes / No`
  - Notes: `________________________________________`
- Any death that felt like “what hit me?”
  - Result: `Yes / No`
  - Notes: `________________________________________`

### Issue #51 — Difficulty Modes (when implemented)

- Easy feels noticeably easier (HP/DPS/spawns/telegraphs)
  - Result: `Yes / No`
- Hard feels challenging but fair
  - Result: `Yes / No`
- Mode shown on leaderboard
  - Result: `Yes / No`

---

## 4) UX / Readability Tests

### Issue #34 — Dash Discoverability

Goal: brand new player discovers dash quickly.

Fresh test (new profile / cleared storage):
- Time to discover dash: `____ seconds`
- Was the dash keybind visible somewhere?
  - Result: `Yes / No`
- Did the player understand dash is a survival tool?
  - Result: `Yes / No`
- Notes: `________________________________________`

### Issue #31 — Off-Screen Spawn Fairness

Goal: reduce cheap rear-spawn hits.

Across 5 deaths:
- # deaths from behind/off-screen: `____ / 5`
- Did you feel warned before off-screen hits? `Yes / No`
- Feel rating for spawn fairness: `1 2 3 4 5`
- Notes: `________________________________________`

### Issue #32 — Boss Retreat/Return Clarity

Goal: players understand HP persistence and phase rules.

- During retreat, could you tell whether HP persists?
  - Result: `Yes / No`
- When boss returns, is current HP immediately clear?
  - Result: `Yes / No`
- Notes: `________________________________________`

### Issue #49 — Telegraph Consistency Pass

Goal: deaths are explainable.

- Can you see windup → commit → recovery on enemy attacks?
  - Result: `Yes / No`
- Any death where the player couldn’t identify the source within ~0.5s?
  - Result: `Yes / No`
- Audio cues helped under chaos?
  - Result: `Yes / No`
- Notes: `________________________________________`

---

## 5) Feature Verification (when implemented)

### Issue #52 — Lives & Checkpoint System

- Lives visible in HUD at all times
  - Result: `Yes / No`
- Death with lives remaining restarts current arena cleanly
  - Result: `Yes / No`
- Game over only when lives exhausted
  - Result: `Yes / No`
- Lives carry across arena transitions
  - Result: `Yes / No`

---

## 6) Deferred / Larger Features (Mark N/A until implemented)

- Issue #36 — Arena Expansion (Future): `N/A`
- Issue #37 — Progression & Mastery System: `N/A`
- Issue #38 — Economy & Cosmetic Rewards (Non-P2W): `N/A`
- Issue #41 — Elite Enemy Variants: `N/A`
- Issue #42 — Active Abilities System: `N/A`
- Issue #43 — Challenge Modes (Time Attack, Boss Rush): `N/A`
- Issue #44 — Manta Scope (Attack Cone Preview): `N/A`
- Issue #47 — Settings Menu: `N/A`

---

## 7) Open Feedback (Always Ask)

- Best moment this session: `________________________________________`
- Worst moment this session: `________________________________________`
- One change that would improve the game most: `________________________________________`
- Would you play again tomorrow? `Yes / No / Maybe`

