// Game Identity
import { log } from '../systems/debugLog.js';

export const GAME_TITLE = 'Manta Sphere';
export const VERSION = '0.4.0';  // Semantic versioning - see VERSION file and .cursorrules
export const STORAGE_PREFIX = GAME_TITLE.toLowerCase().replace(/\s+/g, '') + '_';

// ==================== BUILD-TIME ENVIRONMENT CONFIG ====================
// These globals are injected by esbuild at build time from .env file
// Dev build (npm run dev): ENV_DEBUG_SECRET=true
// Prod build (npm run build): ENV_DEBUG_SECRET=false
// Unbundled dev (index.dev.html): window.__DEV_MODE__ = true
// See .env.example for configuration template

/* global ENV_DEBUG_SECRET, ENV_PLAYTEST_URL, ENV_PLAYTEST_TOKEN, ENV_COMMIT_HASH */
// Build-injected globals (exist when bundled)
// Falls back to window.__DEV_MODE__ for unbundled dev
const RUNTIME_CONFIG = (typeof window !== 'undefined' && window.__RUNTIME_CONFIG__) || null;

// Debug is disabled by default unless explicitly enabled:
// Priority: 1) runtime (Docker) config, 2) build-time injected flag, 3) unbundled dev mode.
const DEBUG_SECRET =
    (RUNTIME_CONFIG && RUNTIME_CONFIG.debug === true) ||
    (typeof ENV_DEBUG_SECRET !== 'undefined' ? ENV_DEBUG_SECRET : false) ||
    ((typeof window !== 'undefined' && window.__DEV_MODE__) || false);

// Playtest config can be overridden at runtime (Docker env) or at build time (.env -> esbuild define)
const PLAYTEST_URL =
    (RUNTIME_CONFIG && typeof RUNTIME_CONFIG.playtestUrl === 'string' && RUNTIME_CONFIG.playtestUrl) ||
    (typeof ENV_PLAYTEST_URL !== 'undefined' ? ENV_PLAYTEST_URL : '');
const PLAYTEST_TOKEN =
    (RUNTIME_CONFIG && typeof RUNTIME_CONFIG.playtestToken === 'string' && RUNTIME_CONFIG.playtestToken) ||
    (typeof ENV_PLAYTEST_TOKEN !== 'undefined' ? ENV_PLAYTEST_TOKEN : '');

// Commit hash (bundled builds) - useful for debug/version display
const COMMIT_HASH_VALUE =
    (RUNTIME_CONFIG && typeof RUNTIME_CONFIG.commitHash === 'string' && RUNTIME_CONFIG.commitHash) ||
    (typeof ENV_COMMIT_HASH !== 'undefined' ? ENV_COMMIT_HASH : '');
export const COMMIT_HASH = COMMIT_HASH_VALUE || 'dev';

// Playtest feedback configuration (from .env)
export const PLAYTEST_CONFIG = PLAYTEST_URL ? {
    url: PLAYTEST_URL,
    token: PLAYTEST_TOKEN
} : null;

// ==================== DEBUG MODE ====================
let DEBUG_ENABLED = false;

// Enable debug mode if build was configured with DEBUG_SECRET=true
export function enableDebugMode() {
    if (!DEBUG_SECRET) return false;
    DEBUG_ENABLED = true;
    DEBUG_CONFIG.level = 'info';
    DEBUG_CONFIG.tags.WAVE = true;
    DEBUG_CONFIG.tags.SPAWN = true;
    DEBUG_CONFIG.tags.BOSS = true;
    DEBUG_CONFIG.tags.SCORE = true;
    DEBUG_CONFIG.tags.STATE = true;
    DEBUG_CONFIG.tags.SAFETY = true;
    DEBUG_CONFIG.tags.DEBUG = true;
    log('DEBUG', 'debug_mode_enabled', { build: 'dev' });
    return true;
}

// Export DEBUG_ENABLED for dynamic debug checks
export { DEBUG_ENABLED };

// Debug Logging Configuration
// Level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent'
// Tags: Enable/disable logging per category
export const DEBUG_CONFIG = {
    level: 'silent',  // Default: off (enableDebugMode() turns on if conditions met)
    tags: {
        WAVE: false,
        SPAWN: false,
        BOSS: false,
        SCORE: false,
        STATE: false,
        SAFETY: false,
        PERF: false,
        DEBUG: false,    // Debug menu operations
        MUSIC: false,    // PulseMusic system
        PLAYTEST: false  // Playtest feedback system
    }
};

// Backward compatibility alias (getter function to check current state)
export function DEBUG() {
    return DEBUG_ENABLED;
}

// Game constants
export const DAMAGE_COOLDOWN = 500;
export const CINEMATIC_BOSS_HOLD_FRAMES = 120;  // 2 seconds at 60fps - camera holds on boss then returns
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
export const DEFAULT_LIVES = 3;  // Default starting lives for new runs

// Difficulty modes configuration
export const DIFFICULTY_CONFIG = {
    easy: { 
        hpMult: 0.7, 
        dpsMult: 0.6, 
        spawnMult: 0.8, 
        telegraphMult: 1.5, 
        scoreMult: 0.5 
    },
    normal: { 
        hpMult: 1.0, 
        dpsMult: 1.0, 
        spawnMult: 1.0, 
        telegraphMult: 1.0, 
        scoreMult: 1.0 
    },
    hard: { 
        hpMult: 1.3, 
        dpsMult: 1.2, 
        spawnMult: 1.2, 
        telegraphMult: 0.8, 
        scoreMult: 1.5 
    },
    nightmare: { 
        hpMult: 1.6, 
        dpsMult: 1.5, 
        spawnMult: 1.4, 
        telegraphMult: 0.65, 
        scoreMult: 2.0 
    }
};

export const WAVE_STATE = {
    WAVE_INTRO: 'WAVE_INTRO',
    WAVE_ACTIVE: 'WAVE_ACTIVE',
    WAVE_CLEAR: 'WAVE_CLEAR',
    BOSS_INTRO: 'BOSS_INTRO',
    BOSS_ACTIVE: 'BOSS_ACTIVE',
    BOSS_RETREAT: 'BOSS_RETREAT',  // NEW: Boss retreating after phase defeat
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
        gruntTiny: { durability: 4, damage: 5, cognitive: 1 },  // 1-shot enemy, lower cost
        gruntBig: { durability: 30, damage: 15, cognitive: 2 },  // 3-shot enemy, higher cost
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
        lesson: { total: 800, maxCognitive: 20 },        // Doubled from 400, 15
        integration: { total: 1500, maxCognitive: 40 },  // Doubled from 750, 30
        exam: { total: 2500, maxCognitive: 50 }          // Doubled from 1250, 40
    },
    // Arena-specific budget overrides (applied before arena scaling)
    arenaBudgetOverrides: {
        1: {
            lesson: { total: 700 },      // Doubled from 350 - more tiny puffers
            integration: { total: 1100 }, // Doubled from 550 - more mixed enemies
            exam: { total: 1500 }         // Doubled from 750 - more pressure
        }
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
    maxTypesPerWave: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 4, 6: 4 },  // Arena 1: 3 types (gruntTiny, grunt, gruntBig)
    featuredTypeBonus: 2.0  // Lesson enemy gets double spawn weight
};

// School formation configuration (true leader/follower formations)
export const SCHOOL_CONFIG = {
    enabled: true,
    // Wave-based frequency by arena (schools ramp up across waves)
    chanceByWave: {
        arena1: { 1: 0, 2: 0.10, 3: 0.25 },     // No schools Wave 1, rare Wave 2, more Wave 3
        arena2: { 1: 0.05, 2: 0.15, 3: 0.20 },
        default: { 1: 0.05, 2: 0.15, 3: 0.20 }
    },
    schoolSize: { min: 3, max: 6 },
    formationSpacing: 1.5,        // Distance between followers in formation
    formationTightness: 0.08,     // How quickly followers catch up (0-1, higher = tighter)
    maxActiveSchools: 2,          // Safety cap - max schools alive at once
    excludeTypes: ['shielded', 'splitter', 'waterBalloon', 'gruntBig'],  // Heavy enemies don't school
    leaderDeathBehavior: 'promote',  // 'promote' first follower or 'disband'
    spawnCooldownFrames: 60       // Minimum frames between school spawns (prevent back-to-back)
};

// Spawn choreography configuration (directional spawning)
export const SPAWN_CHOREOGRAPHY = {
    enabled: true,
    // Choreography type per arena and wave
    // 'random': default random spawning
    // 'lane': all enemies from one direction (edge)
    // 'pincer': enemies from two opposite edges
    arena1: {
        1: 'random',  // Wave 1: learning, random spawns
        2: 'lane',    // Wave 2: lane flood from one direction
        3: 'pincer'   // Wave 3: pincer from two directions
    },
    // Other arenas use random by default (can be extended)
    edgeSpawnDistance: 40,   // How far from center to spawn (near arena edge)
    edgeSpread: 25,          // Spread along the edge
    directions: ['north', 'south', 'east', 'west']
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

// Boss intro cutscene timing (frames at 60fps)
export const BOSS_INTRO_MINION_COUNT = 3;          // Number of minions to spawn during intro
export const BOSS_INTRO_TOTAL_DURATION = 1800;     // 30 seconds total intro demo (after spawn)

// Boss 1 intro demo sequence timing (frames after boss spawn)
// Extended showcase: Title -> Charge x4 (with text) -> Fight
// Boss prowls continuously in intro_showcase state
// Can be skipped by holding Space or Enter
export const BOSS1_INTRO_DEMO = {
    // Title phase (boss spawns, starts prowling)
    TITLE_CARD: 0,               // "THE GATEKEEPER AWAKENS" appears at spawn
    
    // Demo charge #1 (slow-mo, full telegraph)
    CHARGE_DEMO_1: 360,          // First demo charge (6s mark)
    CHARGE_1_SLOWMO_DURATION: 90,
    CHARGE_1_SLOWMO_SCALE: 0.4,  // 40% speed for readability
    
    // Teaching text (after first demo so player sees it first)
    TEXT_LESSON: 600,            // "Watch the wind-up -> dodge -> punish" (10s mark)
    
    // Demo charge #2 (normal speed, same tells)
    CHARGE_DEMO_2: 900,          // Second demo charge (15s mark)
    
    // Demo charge #3 (shows pattern repeats)
    CHARGE_DEMO_3: 1200,         // Third demo charge (20s mark)
    
    // Demo charge #4 (reinforces pattern)
    CHARGE_DEMO_4: 1440,         // Fourth demo charge (24s mark)
    
    // End sequence
    TEXT_FIGHT: 1680,            // "FIGHT!" (28s mark)
    SEQUENCE_END: 1800           // 30 seconds total
};

// Phase 2 cutscene timing (frames at 60fps) - Teach shield + minion dependency
export const PHASE2_CUTSCENE = {
    TOTAL_DURATION: 720,         // 12 seconds
    TEXT_PHASE: 60,              // "PHASE 2" text appears (1s)
    SHIELD_MANIFEST: 120,        // Shield becomes visible (2s)
    MINION_SPAWN: 180,           // Tethered minions appear (3s)
    TEXT_EXPLAIN: 300,           // "Kill tethered minions to break the shield!" (5s)
    DEMO_KILL: 420,              // Scripted minion death demonstration (7s)
    TEXT_READY: 600              // "Now you try!" (10s)
};

// Phase 3 cutscene timing (frames at 60fps) - Teach shielded chase twist
export const PHASE3_CUTSCENE = {
    TOTAL_DURATION: 600,         // 10 seconds
    TEXT_PHASE: 60,              // "FINAL PHASE" text appears (1s)
    SHIELD_REASSERT: 120,        // Shield turns red/aggressive (2s)
    DEMO_CHASE: 180,             // Boss briefly moves toward player (3s)
    DEMO_CHARGE: 300,            // Demo charge with slow-mo (5s)
    TEXT_SURVIVE: 480            // "Shield rule still applies - survive the chase!" (8s)
};

// Visual feedback constants
export const SLOW_MO_LERP_SPEED = 0.1;  // Interpolation speed for slow-mo transitions
export const SCREEN_FLASH_DEFAULT_DURATION = 6;  // Default frames for screen flash effect
export const SPLITLING_SPAWN_STUN_FRAMES = 30;  // Stun frames for newly spawned splitlings

// Underwater ambience configuration
export const AMBIENCE_CONFIG = {
    enabled: true,  // Master toggle (default ON)
    
    // Bubbles - occasional ambient bubbles across arena edges
    bubbles: {
        maxCount: 40,
        spawnRate: 0.3,                        // Spawns per frame (0.3 = ~18/sec)
        lifetime: { min: 120, max: 240 },      // 2-4 seconds at 60fps
        size: { min: 0.08, max: 0.2 },
        opacity: { min: 0.2, max: 0.5 },
        riseSpeed: { min: 0.02, max: 0.05 },
        wobbleIntensity: 0.01,
        spawnRadius: { min: 35, max: 48 },     // Near walls, not center
        color: 0x88ddff,                       // Soft cyan
    },
    
    // Kelp - decorative plants near perimeter
    kelp: {
        countPerArena: 12,
        placementRadius: { min: 38, max: 47 }, // Near perimeter
        height: { min: 4, max: 8 },
        swaySpeed: 0.02,
        swayIntensity: 0.15,
        color: 0x225533,                       // Dark teal-green
        opacity: 0.4,
    },
    
    // Distant Fish - background silhouettes for depth
    fish: {
        maxCount: 8,
        distanceRadius: { min: 55, max: 70 },  // Beyond arena walls
        height: { min: 3, max: 12 },
        speed: { min: 0.01, max: 0.03 },
        size: { min: 0.8, max: 1.5 },
        opacity: 0.25,                         // Faded/distant
        color: 0x446688,
    },
    
    // Combat safe zone (bubbles/fish avoid this area)
    safeZoneRadius: 25,                        // Center 25 units is combat area
};
