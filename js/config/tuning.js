// Central tuning knobs for rapid balance iteration.
// These values are safe to tweak at runtime in debug mode.
//
// IMPORTANT:
// - Keep this small and practical. Add knobs only when they pay for themselves in iteration speed.
// - These are multipliers/seconds, not per-frame assumptions. Game uses delta-time normalized to 60fps.

export const TUNING = {
  // 1.0 = baseline. <1 = fewer spawns / slower pacing, >1 = more spawns / faster pacing.
  spawnRateMultiplier: 1.0,

  // Multiplies enemy movement speed (applied in enemy update).
  enemySpeedMultiplier: 1.0,

  // Multiplies player gravity / fall acceleration (applied in player update).
  gravityMultiplier: 1.0,

  // Wave clear delay (seconds). Higher = more breathing room between waves.
  // Default matches current WAVE_CLEAR_FRAMES (90 frames @ 60fps = 1.5s).
  breathingRoomSeconds: 1.5,

  // Stress pause trigger threshold (enemy count). If enemies >= threshold, spawning pauses.
  // Default matches PACING_CONFIG.stressPauseThreshold.
  stressPauseThreshold: 6,

  // Optional landing stun after touching ground (frames). 0 = no stun.
  landingStunFrames: 0,

  // Scales how strong the Attack Speed upgrade is (1.0 = current).
  // Applied when taking the 'attackSpeed' upgrade so baseline fire rate is unchanged.
  fireRateEffectiveness: 1.0,

  // Boss tuning (1.0 = current).
  bossHealthMultiplier: 1.0,
  bossDamageMultiplier: 1.0,

  // ==================== UX / FAIRNESS LEVERS (debug-only by default) ====================

  // Prevent spawns from getting too close to the player (units). 0 = disabled (no change).
  spawnSafeZoneRadius: 0,

  // Show a small spawn indicator when an enemy spawns close to the player.
  offScreenWarningEnabled: false,

  // Show tutorial hints (e.g., dash hint on first damage).
  tutorialHintsEnabled: false,

  // Extra retreat announcement during Arena 1 boss chase retreat.
  retreatAnnouncementEnabled: false,

  // Scales telegraph/tell durations (1.0 = current).
  telegraphDurationMult: 1.0,

  // ==================== FEATURE TOGGLES (mostly debug-driven) ====================

  // Starting lives for the run (1 = current).
  playerStartingLives: 1,

  // Difficulty scalar (1.0 = current). Used as an additional multiplier for spawn pacing + enemy/boss damage.
  difficultyMultiplier: 1.0,

  // Chance (0..1) that a newly spawned non-boss enemy becomes an Elite variant (debug-only).
  eliteSpawnChance: 0,

  // Boss rush toggle: jump to boss after the first wave clear (debug-only).
  bossRushEnabled: false,

  // Attack cone preview (currently always shown). Toggle is for experimentation.
  attackConePreviewEnabled: true,

  // XP gem despawn timer in seconds.
  xpDespawnSeconds: 15
};

