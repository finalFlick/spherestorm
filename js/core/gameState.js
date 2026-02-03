import { WAVE_STATE } from '../config/constants.js';

// Central game state management
export const gameState = {
    running: false,
    paused: false,
    announcementPaused: false,
    introCinematicActive: false,
    health: 100,
    maxHealth: 100,
    xp: 0,
    xpToLevel: 10,
    level: 1,
    kills: 0,
    score: 0,
    pendingLevelUps: 0,
    currentArena: 1,
    currentWave: 1,
    waveState: WAVE_STATE.WAVE_INTRO,
    waveTimer: 0,
    enemiesToSpawn: 0,
    waveEnemiesRemaining: 0,
    waveSpawnTimer: 0,  // Frame-based spawn cooldown counter
    waveFrameCounter: 0,  // Frames since wave start (for speed bonus)
    bossActive: false,
    unlockedMechanics: {
        pillars: false,
        ramps: false,
        platforms: false,
        tunnels: false,
        hybridChaos: false
    },
    unlockedEnemyBehaviors: {
        jumping: false,
        ambush: false,
        multiLevel: false
    },
    stats: {
        damage: 10,
        attackSpeed: 0.2,  // 3x slower initial fire rate - emphasizes positioning
        projectileCount: 1,
        projectileSpeed: 0.5,  // Reduced from 0.8 - slower bullets early game
        moveSpeed: 0.15,
        maxHealth: 100,
        pickupRange: 3,
        xpMultiplier: 1
    },
    debug: {
        enabled: false,
        noEnemies: false,
        invincible: false
    },
    
    // Dash Strike ability state (unlocked via Boss 1 module)
    dashStrikeEnabled: false,
    dashStrikeLevel: 0,
    dashStrikeConfig: null,  // { distance, cooldown, damage }
    dashStrikeCooldownTimer: 0,
    
    // Cutscene state - prevents damage and boss AI during transitions
    cutsceneActive: false,
    cutsceneInvincible: false,
    interactiveDodgeTutorial: false,  // Allows player movement during dodge tutorial
    
    // Boss intro/cutscene tracking
    bossIntroDemoPhase: 0,
    introMinions: [],
    currentBossRef: null,
    
    // Frame-based post-defeat timers (run even after boss removed)
    portalSpawnTimer: 0,
    portalSpawnPos: null,
    victoryParticleWave: undefined,  // undefined = not active, 0-2 = active waves
    victoryParticleTimer: 0,
    victoryParticlePos: null,
    combatStats: {
        damageDealt: 0,
        damageTaken: 0,
        kills: {},
        perfectWaves: 0,
        waveDamageTaken: 0,
        bossesDefeated: 0
    },
    shownModifiers: {},
    
    // Visual settings
    settings: {
        ambienceEnabled: true,      // Master toggle for underwater ambience
        ambienceBubbles: true,      // Sub-toggle: bubble particles
        ambienceKelp: true,         // Sub-toggle: decorative kelp
        ambienceFish: true,         // Sub-toggle: distant fish silhouettes
    },
    
    // Frame counter for cooldown tracking
    frameCount: 0,
    
    // Arena 1 Boss Chase state - boss appears multiple times across waves
    arena1ChaseState: null  // Initialized when Arena 1 starts
};

export function resetGameState() {
    Object.assign(gameState, {
        health: 100,
        maxHealth: 100,
        xp: 0,
        xpToLevel: 10,
        level: 1,
        kills: 0,
        score: 0,
        paused: false,
        announcementPaused: false,
        introCinematicActive: false,
        cutsceneActive: false,
        cutsceneInvincible: false,
        interactiveDodgeTutorial: false,
        currentArena: 1,
        currentWave: 1,
        waveState: WAVE_STATE.WAVE_INTRO,
        waveTimer: 0,
        bossActive: false,
        pendingLevelUps: 0,
        // Boss intro/cutscene tracking
        bossIntroDemoPhase: 0,
        introMinions: [],
        currentBossRef: null,
        // Frame-based post-defeat timers
        portalSpawnTimer: 0,
        portalSpawnPos: null,
        victoryParticleWave: undefined,
        victoryParticleTimer: 0,
        victoryParticlePos: null
    });
    gameState.unlockedMechanics = {
        pillars: false,
        ramps: false,
        platforms: false,
        tunnels: false,
        hybridChaos: false
    };
    gameState.unlockedEnemyBehaviors = {
        jumping: false,
        ambush: false,
        multiLevel: false
    };
    gameState.stats = {
        damage: 10,
        attackSpeed: 0.2,  // 3x slower initial fire rate - emphasizes positioning
        projectileCount: 1,
        projectileSpeed: 0.5,  // Reduced from 0.8 - slower bullets early game
        moveSpeed: 0.15,
        maxHealth: 100,
        pickupRange: 3,
        xpMultiplier: 1
    };
    gameState.debug = {
        enabled: false,
        noEnemies: false,
        invincible: false
    };
    
    // Reset Dash Strike ability state
    gameState.dashStrikeEnabled = false;
    gameState.dashStrikeLevel = 0;
    gameState.dashStrikeConfig = null;
    gameState.dashStrikeCooldownTimer = 0;
    
    gameState.combatStats = {
        damageDealt: 0,
        damageTaken: 0,
        kills: {},
        perfectWaves: 0,
        waveDamageTaken: 0,
        bossesDefeated: 0
    };
    gameState.shownModifiers = {};
    gameState.frameCount = 0;
    gameState.arena1ChaseState = null;
}

// Initialize Arena 1 boss chase state
// 
// IMPORTANT: Arena 1 has 7 total waves (not 3) divided into 3 segments:
// - segmentWaves defines waves per segment: {1:3, 2:2, 3:2} = 7 total
// - currentWave increments globally (1→7)
// - segment tracks which boss encounter group we're in (1→3)
// - bossEncounterCount tracks completed boss fights (0→3)
export function initArena1ChaseState() {
    gameState.arena1ChaseState = {
        enabled: true,
        segment: 1,              // 1=pre-P1, 2=between-P1-P2, 3=between-P2-P3, 4=complete
        bossPhaseToSpawn: 1,     // Which phase kit to use (1, 2, or 3)
        bossEncounterCount: 0,   // How many boss fights completed (0, 1, 2, 3)
        persistentBossHealth: null,  // Boss HP carries across encounters
        phaseThresholds: {
            1: 833,  // 66% of 1250 - retreat point for Phase 1
            2: 416   // 33% of 1250 - retreat point for Phase 2
        },
        segmentWaves: {
            1: 3,    // Waves before P1 (waves 1-3)
            2: 2,    // Waves between P1-P2 (waves 4-5)
            3: 2     // Waves between P2-P3 (waves 6-7)
        }
    };
    
    // Chase state initialized - logged at wave system level
}

// Reset Arena 1 chase state (on death/restart)
export function resetArena1ChaseState() {
    gameState.arena1ChaseState = null;
}
