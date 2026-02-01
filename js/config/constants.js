// Game constants
export const DAMAGE_COOLDOWN = 500;
export const PLAYER_JUMP_VELOCITY = 0.4;
export const PLAYER_GRAVITY = 0.018;
export const BOUNCE_FACTORS = [0.45, 0.2, 0.08];
export const TRAIL_MAX = 60;
export const TRAIL_LIFETIME = 90;
export const TRAIL_SPAWN_DISTANCE = 0.3;
export const UI_UPDATE_INTERVAL = 100;

export const HEART_DROP_CHANCE = { normal: 0.03, elite: 0.10, boss: 1.0 };
export const HEART_HEAL = { normal: 15, elite: 25, boss: 50 };
export const HEART_TTL = 600;

export const WAVE_STATE = {
    WAVE_INTRO: 'WAVE_INTRO',
    WAVE_ACTIVE: 'WAVE_ACTIVE',
    WAVE_CLEAR: 'WAVE_CLEAR',
    BOSS_INTRO: 'BOSS_INTRO',
    BOSS_ACTIVE: 'BOSS_ACTIVE',
    BOSS_DEFEATED: 'BOSS_DEFEATED',
    ARENA_TRANSITION: 'ARENA_TRANSITION'
};
