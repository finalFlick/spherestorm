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
    lastWaveSpawn: 0,
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
        attackSpeed: 1,
        projectileCount: 1,
        projectileSpeed: 0.8,
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
    combatStats: {
        damageDealt: 0,
        damageTaken: 0,
        kills: {},
        perfectWaves: 0,
        waveDamageTaken: 0,
        bossesDefeated: 0
    },
    shownModifiers: {}  // Track which modifiers shown per arena { arenaNum: Set(['elite', 'swarm', ...]) }
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
        currentArena: 1,
        currentWave: 1,
        waveState: WAVE_STATE.WAVE_INTRO,
        waveTimer: 0,
        bossActive: false,
        pendingLevelUps: 0
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
        attackSpeed: 1,
        projectileCount: 1,
        projectileSpeed: 0.8,
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
    gameState.combatStats = {
        damageDealt: 0,
        damageTaken: 0,
        kills: {},
        perfectWaves: 0,
        waveDamageTaken: 0,
        bossesDefeated: 0
    };
    gameState.shownModifiers = {};
}
