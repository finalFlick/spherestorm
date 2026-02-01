// Game Identity
export const GAME_TITLE = 'Manta Sphere';
export const STORAGE_PREFIX = GAME_TITLE.toLowerCase().replace(/\s+/g, '') + '_';

// Game constants
export const DEBUG = false;  // Set to true for debug logging
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
export const XP_GEM_TTL = 900;  // 15 seconds at 60fps

export const WAVE_STATE = {
    WAVE_INTRO: 'WAVE_INTRO',
    WAVE_ACTIVE: 'WAVE_ACTIVE',
    WAVE_CLEAR: 'WAVE_CLEAR',
    BOSS_INTRO: 'BOSS_INTRO',
    BOSS_ACTIVE: 'BOSS_ACTIVE',
    BOSS_DEFEATED: 'BOSS_DEFEATED',
    ARENA_TRANSITION: 'ARENA_TRANSITION'
};

// Wave configuration
export const WAVE_CONFIG = {
    lessonWave: {
        countBase: 6,
        countVariance: 1,
        interval: 900,
        burstChance: 0,
        specialSpawns: false,
        maxAliveCap: 4
    },
    integrationWave: {
        countScaling: 1.15,
        intervalBase: 750,
        intervalMin: 500,
        burstChanceBase: 0.05,
        burstChanceMax: 0.15
    },
    examWave: {
        countMultiplier: 1.3,
        interval: 500,
        burstChance: 0.20
    }
};

// Enemy spawn caps (maxAlive by type)
export const ENEMY_CAPS = {
    grunt: { base: 8, max: 12 },
    shielded: {
        arena2: 2,
        arena3: 2,
        arena4: 3,
        arena5plus: 3
    },
    pillarPolice: {
        arena3: 2,
        arena4: 2
    },
    fastBouncer: {
        arena4: 2,
        arena5: 3,
        arena6: 3
    },
    splitter: {
        arena5: 1,
        arena6: 2
    },
    teleporter: {
        arena6: 2
    }
};

// Threat budget system - composition-aware wave spawning
export const THREAT_BUDGET = {
    costs: {
        grunt: { durability: 12, damage: 10, cognitive: 1 },
        shielded: { durability: 50, damage: 12, cognitive: 2 },
        fastBouncer: { durability: 6, damage: 8, cognitive: 3 },
        splitter: { durability: 60, damage: 30, cognitive: 4 },
        teleporter: { durability: 12, damage: 15, cognitive: 5 },
        pillarPolice: { durability: 10, damage: 12, cognitive: 3 },
        shooter: { durability: 8, damage: 16, cognitive: 3 },
        shieldBreaker: { durability: 15, damage: 18, cognitive: 4 },
        waterBalloon: { durability: 25, damage: 10, cognitive: 4 }
    },
    waveBudgets: {
        lesson: { total: 400, maxCognitive: 15 },
        integration: { total: 750, maxCognitive: 30 },
        exam: { total: 1250, maxCognitive: 40 }
    },
    arenaScaling: { 1: 1.0, 2: 1.2, 3: 1.4, 4: 1.6, 5: 1.8, 6: 2.0 }
};

// Mid-wave pacing configuration
export const PACING_CONFIG = {
    stressPauseThreshold: 6,     // Pause spawns if 6+ enemies alive
    stressPauseDuration: 120,    // 2 seconds at 60fps
    microBreatherInterval: 8,    // After every 8 spawns, take a breather
    microBreatherDuration: 180,  // 3 seconds at 60fps
    breatherMusicDip: 0.3        // Lower intensity during breather
};

// Wave modifiers for variety
export const WAVE_MODIFIERS = {
    elite: { 
        name: 'ELITE ASSAULT', 
        budgetMult: 0.7,
        healthMult: 2.0, 
        xpMult: 2.5,
        forceTypes: null
    },
    rush: { 
        name: 'BLITZ', 
        budgetMult: 1.3,
        intervalMult: 0.4, 
        timeLimit: 20000,
        forceTypes: null
    },
    swarm: { 
        name: 'SWARM', 
        budgetMult: 1.5,
        forceTypes: ['grunt', 'fastBouncer'], 
        healthMult: 0.5
    },
    harbingers: { 
        name: 'HARBINGERS', 
        budgetMult: 1.0,
        forceTypes: ['shooter', 'shieldBreaker', 'waterBalloon'],
        announcement: 'The boss sends its champions...'
    },
    breather: {
        name: 'BREATHER',
        budgetMult: 0.5,
        intervalMult: 1.5,
        healthMult: 0.8,
        cognitiveMax: 6,
        announcement: 'A moment to recover...'
    }
};

// Cognitive load limits per arena
export const COGNITIVE_LIMITS = {
    maxTypesPerWave: { 1: 1, 2: 2, 3: 3, 4: 3, 5: 4, 6: 4 },
    featuredTypeBonus: 2.0  // Lesson enemy gets double spawn weight
};

// Death feedback tips
export const DEATH_TIPS = {
    charge: 'Dodge perpendicular to the charge path!',
    hazard: 'Watch for orange ground warnings.',
    shielded: 'Break shields before focusing damage.',
    teleporter: 'Listen for the teleport sound cue.',
    jumpSlam: 'Clear the red circle before impact!',
    burrow: 'Watch for the rumbling ground warning!',
    grunt: 'Keep moving - grunts are relentless!',
    fastBouncer: 'Predict bounce angles off walls.',
    splitter: 'Focus fire to avoid being overwhelmed.',
    shooter: 'Close the distance or use cover.',
    shieldBreaker: 'Sidestep when you see the wind-up!'
};

// Boss AI constants
export const BOSS_STUCK_THRESHOLD = 0.02;  // Minimum movement per frame
export const BOSS_STUCK_FRAMES = 20;       // Frames before considered stuck
export const PHASE_TRANSITION_DELAY_FRAMES = 18;  // ~300ms at 60fps

// Cinematic constants (boss intro)
export const BOSS_INTRO_CINEMATIC_DURATION = 120;  // 2 seconds at 60fps
export const BOSS_INTRO_SLOWMO_DURATION = 90;      // 1.5 seconds at 60fps
export const BOSS_INTRO_SLOWMO_SCALE = 0.4;        // 40% speed

// Visual feedback constants
export const SLOW_MO_LERP_SPEED = 0.1;  // Interpolation speed for slow-mo transitions
