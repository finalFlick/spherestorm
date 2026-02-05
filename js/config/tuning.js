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

  // XP gem despawn timer in seconds.
  xpDespawnSeconds: 15
};

