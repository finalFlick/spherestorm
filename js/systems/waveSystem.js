import { gameState } from '../core/gameState.js';
import { enemies, getCurrentBoss } from '../core/entities.js';
import { player } from '../entities/player.js';
import { spawnWaveEnemy } from '../entities/enemies.js';
import { spawnBoss } from '../entities/boss.js';
import { WAVE_STATE, WAVE_CONFIG, ENEMY_CAPS, THREAT_BUDGET, PACING_CONFIG, WAVE_MODIFIERS, COGNITIVE_LIMITS, BOSS_INTRO_CINEMATIC_DURATION, BOSS_INTRO_SLOWMO_DURATION, BOSS_INTRO_SLOWMO_SCALE } from '../config/constants.js';
import { ARENA_CONFIG, getArenaWaves } from '../config/arenas.js';
import { ENEMY_TYPES } from '../config/enemies.js';
import { generateArena } from '../arena/generator.js';
import { awardArenaBadge } from './badges.js';
import { PulseMusic } from './pulseMusic.js';
import { 
    showWaveAnnouncement, 
    hideWaveAnnouncement, 
    showBossAnnouncement, 
    hideBossAnnouncement,
    showUnlockNotification,
    showBadgeUnlock,
    showModifierAnnouncement,
    updateUI 
} from '../ui/hud.js';
import { startCinematic, triggerSlowMo, endCinematic } from './visualFeedback.js';

// Timing constants (in frames at 60fps) - 3x longer for readability
const WAVE_INTRO_FRAMES = 360;       // 6 seconds (3x original)
const WAVE_CLEAR_FRAMES = 270;       // 4.5 seconds (3x original)
const BOSS_INTRO_FRAMES = 540;       // 9 seconds (3x original)
const BOSS_DEFEATED_FRAMES = 180;    // 3 seconds
const ARENA_TRANSITION_FRAMES = 60;  // 1 second

export function updateWaveSystem() {
    switch (gameState.waveState) {
        case WAVE_STATE.WAVE_INTRO: handleWaveIntro(); break;
        case WAVE_STATE.WAVE_ACTIVE: handleWaveActive(); break;
        case WAVE_STATE.WAVE_CLEAR: handleWaveClear(); break;
        case WAVE_STATE.BOSS_INTRO: handleBossIntro(); break;
        case WAVE_STATE.BOSS_ACTIVE: handleBossActive(); break;
        case WAVE_STATE.BOSS_DEFEATED: handleBossDefeated(); break;
        case WAVE_STATE.ARENA_TRANSITION: handleArenaTransition(); break;
    }
}

// Get max waves for current arena (tiered progression)
function getMaxWaves() {
    return getArenaWaves(gameState.currentArena);
}

function handleWaveIntro() {
    if (gameState.waveTimer === 0) {
        showWaveAnnouncement();
        PulseMusic.onWaveStart(gameState.currentWave);
        gameState.announcementPaused = true;  // Pause during announcement
    }
    gameState.waveTimer++;
    
    if (gameState.waveTimer > WAVE_INTRO_FRAMES) {
        gameState.waveState = WAVE_STATE.WAVE_ACTIVE;
        gameState.waveTimer = 0;
        gameState.announcementPaused = false;  // Unpause when announcement ends
        
        const maxWaves = getMaxWaves();
        const isLessonWave = (gameState.currentWave === 1);
        const isExamWave = (gameState.currentWave === maxWaves);
        
        // Determine wave type and base budget
        let waveType = 'integration';
        if (isLessonWave) waveType = 'lesson';
        else if (isExamWave) waveType = 'exam';
        
        const baseBudget = THREAT_BUDGET.waveBudgets[waveType];
        const arenaScale = THREAT_BUDGET.arenaScaling[gameState.currentArena] || 1.0;
        
        // Select wave modifier (if any)
        gameState.waveModifier = selectWaveModifier(gameState.currentArena, gameState.currentWave, maxWaves, isLessonWave);
        const modifierMult = gameState.waveModifier ? (WAVE_MODIFIERS[gameState.waveModifier].budgetMult || 1.0) : 1.0;
        
        // Announce modifier to player (only once per arena)
        if (gameState.waveModifier && WAVE_MODIFIERS[gameState.waveModifier]) {
            const arena = gameState.currentArena;
            
            // Initialize arena's shown modifiers set if needed
            if (!gameState.shownModifiers[arena]) {
                gameState.shownModifiers[arena] = new Set();
            }
            
            // Only show announcement if not previously shown in this arena
            if (!gameState.shownModifiers[arena].has(gameState.waveModifier)) {
                const modifier = WAVE_MODIFIERS[gameState.waveModifier];
                const announcement = modifier.announcement || modifier.name;
                showModifierAnnouncement(announcement);
                gameState.shownModifiers[arena].add(gameState.waveModifier);
            }
            
            // Trigger breather music mode for breather waves (always, even if not announced)
            if (gameState.waveModifier === 'breather') {
                PulseMusic.onBreatherStart();
            }
        }
        
        // Initialize threat budget
        gameState.waveBudgetRemaining = Math.floor(baseBudget.total * arenaScale * modifierMult);
        
        // Apply cognitive cap from modifier if specified (breather waves have lower cognitive load)
        const modifierConfig = gameState.waveModifier ? WAVE_MODIFIERS[gameState.waveModifier] : null;
        gameState.waveCognitiveMax = modifierConfig?.cognitiveMax || baseBudget.maxCognitive;
        gameState.waveCognitiveUsed = 0;
        gameState.waveSpawnCount = 0;
        gameState.lastWaveSpawn = 0;
        
        // Micro-breather tracking
        gameState.microBreatherActive = false;
        gameState.microBreatherTimer = 0;
        gameState.stressPauseActive = false;
        gameState.waveSpawnWarned = false; // Reset spawn warning flag
        
        // Initialize enemy pool for cognitive caps
        initializeWaveEnemyPool();
        
        // Legacy compatibility - estimate enemy count for UI
        const avgCost = 20;
        gameState.enemiesToSpawn = Math.ceil(gameState.waveBudgetRemaining / avgCost);
        gameState.waveEnemiesRemaining = gameState.enemiesToSpawn;
        
        hideWaveAnnouncement();
    }
}

// Select wave modifier based on arena and wave
function selectWaveModifier(arena, wave, maxWaves, isLessonWave) {
    // No modifiers on lesson waves
    if (isLessonWave) return null;
    
    // Check for breather waves from arena config (takes priority)
    const arenaConfig = ARENA_CONFIG.arenas[arena];
    if (arenaConfig?.breatherWaves?.includes(wave)) {
        return 'breather';
    }
    
    // Final wave before boss always gets harbingers (if unlocked enemies exist)
    if (wave === maxWaves && arena >= 3) {
        return 'harbingers';
    }
    
    // Chance of modifier increases with arena
    const modifierChance = 0.10 + arena * 0.05;
    if (Math.random() > modifierChance) return null;
    
    // Select random modifier
    const options = ['elite', 'rush', 'swarm'];
    return options[Math.floor(Math.random() * options.length)];
}

// Initialize the enemy pool for this wave (cognitive caps)
function initializeWaveEnemyPool() {
    const arena = gameState.currentArena;
    const maxTypes = COGNITIVE_LIMITS.maxTypesPerWave[arena] || 4;
    const arenaConfig = ARENA_CONFIG.arenas[arena];
    const lessonEnemy = arenaConfig?.lessonEnemy || 'grunt';
    
    // Check if modifier forces specific types
    if (gameState.waveModifier && WAVE_MODIFIERS[gameState.waveModifier].forceTypes) {
        gameState.waveEnemyPool = WAVE_MODIFIERS[gameState.waveModifier].forceTypes;
        return;
    }
    
    // Always include the arena's featured enemy
    const pool = [lessonEnemy];
    
    // Get all available enemy types for this arena
    const available = getAvailableEnemyTypesForArena(arena);
    const others = available.filter(t => t !== lessonEnemy);
    
    // Shuffle and fill remaining slots
    shuffleArray(others);
    while (pool.length < maxTypes && others.length > 0) {
        pool.push(others.pop());
    }
    
    gameState.waveEnemyPool = pool;
}

// Get enemy types available in this arena
function getAvailableEnemyTypesForArena(arena) {
    const types = [];
    
    for (const [name, data] of Object.entries(ENEMY_TYPES)) {
        if (data.spawnWeight <= 0) continue;
        if (data.arenaIntro && data.arenaIntro > arena) continue;
        if (data.maxArena && data.maxArena < arena) continue;
        types.push(name);
    }
    
    return types;
}

// Fisher-Yates shuffle
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function handleWaveActive() {
    // Skip enemy spawning if debug mode is enabled with noEnemies flag
    if (gameState.debug && gameState.debug.noEnemies) {
        return;
    }
    
    const now = Date.now();
    const maxWaves = getMaxWaves();
    const isLessonWave = (gameState.currentWave === 1);
    const isExamWave = (gameState.currentWave === maxWaves);
    
    // Check for stress pause (too many enemies alive)
    if (enemies.length >= PACING_CONFIG.stressPauseThreshold) {
        if (!gameState.stressPauseActive) {
            gameState.stressPauseActive = true;
            // Optional: signal music to dip
        }
        // Don't spawn more until player clears some
        checkWaveComplete();
        return;
    }
    gameState.stressPauseActive = false;
    
    // Check for micro-breather
    if (gameState.waveSpawnCount > 0 && 
        gameState.waveSpawnCount % PACING_CONFIG.microBreatherInterval === 0 && 
        !gameState.microBreatherActive &&
        gameState.waveBudgetRemaining > 0) {
        
        gameState.microBreatherActive = true;
        gameState.microBreatherTimer = 0;
        PulseMusic.onBreatherStart();
    }
    
    // Handle micro-breather duration
    if (gameState.microBreatherActive) {
        gameState.microBreatherTimer++;
        if (gameState.microBreatherTimer < PACING_CONFIG.microBreatherDuration) {
            checkWaveComplete();
            return; // Pause spawning
        }
        // Breather complete
        gameState.microBreatherActive = false;
        gameState.microBreatherTimer = 0;
        PulseMusic.onBreatherEnd();
    }
    
    // Determine spawn interval based on wave type
    let spawnInterval;
    let burstChance;
    
    if (isLessonWave) {
        spawnInterval = WAVE_CONFIG.lessonWave.interval;
        burstChance = WAVE_CONFIG.lessonWave.burstChance;
    } else if (isExamWave) {
        spawnInterval = WAVE_CONFIG.examWave.interval;
        burstChance = WAVE_CONFIG.examWave.burstChance;
    } else {
        // Integration wave
        spawnInterval = Math.max(
            WAVE_CONFIG.integrationWave.intervalMin,
            WAVE_CONFIG.integrationWave.intervalBase - gameState.currentWave * 30
        );
        burstChance = Math.min(
            WAVE_CONFIG.integrationWave.burstChanceMax,
            WAVE_CONFIG.integrationWave.burstChanceBase + gameState.currentWave * 0.02
        );
    }
    
    // Apply modifier effects
    if (gameState.waveModifier && WAVE_MODIFIERS[gameState.waveModifier]) {
        const modifier = WAVE_MODIFIERS[gameState.waveModifier];
        if (modifier.intervalMult) {
            spawnInterval *= modifier.intervalMult;
        }
        // Breather waves have no burst spawns
        if (gameState.waveModifier === 'breather') {
            burstChance = 0;
        }
    }
    
    // Arena 5 special: reduce burst chance (tunnels amplify unfairness)
    if (gameState.currentArena === 5) {
        burstChance *= 0.5;
    }
    
    // Budget-based spawning
    if (gameState.waveBudgetRemaining > 0 && now - gameState.lastWaveSpawn > spawnInterval) {
        // Burst spawns
        const shouldBurst = Math.random() < burstChance;
        const burstCount = shouldBurst ? (2 + Math.floor(Math.random() * 2)) : 1;
        
        for (let i = 0; i < burstCount && gameState.waveBudgetRemaining > 0; i++) {
            const spawned = spawnWaveEnemy();
            if (!spawned) {
                // No affordable enemy available - exhaust budget to prevent infinite loop
                // Rate-limit warning to avoid console spam (only warn once per wave)
                if (gameState.waveBudgetRemaining > 0 && !gameState.waveSpawnWarned) {
                    console.warn('[WaveSystem] No affordable enemy found, budget:', gameState.waveBudgetRemaining, 'cognitive:', gameState.waveCognitiveUsed, '/', gameState.waveCognitiveMax);
                    gameState.waveSpawnWarned = true;
                }
                gameState.waveBudgetRemaining = 0;
                break;
            }
            
            // Deduct cost from budget
            const cost = getEnemyThreatCost(spawned.enemyType);
            gameState.waveBudgetRemaining -= cost;
            gameState.waveCognitiveUsed += THREAT_BUDGET.costs[spawned.enemyType]?.cognitive || 1;
            gameState.waveSpawnCount++;
            
            // Update legacy counter for UI
            if (gameState.enemiesToSpawn > 0) {
                gameState.enemiesToSpawn--;
            }
        }
        gameState.lastWaveSpawn = now;
    }
    
    checkWaveComplete();
}

// Calculate threat cost for an enemy type
function getEnemyThreatCost(enemyType) {
    const costs = THREAT_BUDGET.costs[enemyType];
    if (!costs) return 20; // Default cost
    return costs.durability + costs.damage;
}

// Check if wave is complete
function checkWaveComplete() {
    const budgetExhausted = gameState.waveBudgetRemaining <= 0;
    const allEnemiesDead = enemies.length === 0;
    
    // Wave completes when all enemies are dead - XP collection not required
    if (budgetExhausted && allEnemiesDead && !getCurrentBoss()) {
        gameState.waveState = WAVE_STATE.WAVE_CLEAR;
        gameState.waveTimer = 0;
    }
}

function handleWaveClear() {
    if (gameState.waveTimer === 0) {
        PulseMusic.onWaveClear();
        
        // End breather music mode if this was a breather wave
        if (gameState.waveModifier === 'breather') {
            PulseMusic.onBreatherEnd();
        }
        
        // Track perfect wave (no damage taken)
        if (gameState.combatStats && gameState.combatStats.waveDamageTaken === 0) {
            gameState.combatStats.perfectWaves++;
        }
        // Reset wave damage tracker for next wave
        if (gameState.combatStats) {
            gameState.combatStats.waveDamageTaken = 0;
        }
    }
    gameState.waveTimer++;
    
    if (gameState.waveTimer > WAVE_CLEAR_FRAMES) {
        const maxWaves = getMaxWaves();
        if (gameState.currentWave >= maxWaves) {
            gameState.waveState = WAVE_STATE.BOSS_INTRO;
        } else {
            gameState.currentWave++;
            gameState.waveState = WAVE_STATE.WAVE_INTRO;
        }
        gameState.waveTimer = 0;
        updateUI();
    }
}

function handleBossIntro() {
    if (gameState.waveTimer === 0) {
        showBossAnnouncement();
        PulseMusic.onBossStart(gameState.currentArena);
        gameState.announcementPaused = true;  // Pause during announcement
    }
    gameState.waveTimer++;
    
    if (gameState.waveTimer > BOSS_INTRO_FRAMES) {
        const boss = spawnBoss(gameState.currentArena);
        gameState.bossActive = true;
        gameState.waveState = WAVE_STATE.BOSS_ACTIVE;
        gameState.waveTimer = 0;
        gameState.announcementPaused = false;  // Unpause when announcement ends
        hideBossAnnouncement();
        
        // Trigger cinematic camera focus on boss with slow-mo
        if (boss) {
            startCinematic(boss, BOSS_INTRO_CINEMATIC_DURATION, true);
            triggerSlowMo(BOSS_INTRO_SLOWMO_DURATION, BOSS_INTRO_SLOWMO_SCALE);
        }
    }
}

function handleBossActive() {
    if (!getCurrentBoss() || !gameState.bossActive) {
        gameState.waveState = WAVE_STATE.BOSS_DEFEATED;
        gameState.waveTimer = 0;
    }
}

function handleBossDefeated() {
    if (gameState.waveTimer === 0) {
        unlockArenaMechanics(gameState.currentArena);
        PulseMusic.onBossDefeat();
        
        // Award persistent arena badge
        const badge = awardArenaBadge(gameState.currentArena);
        if (badge) {
            showBadgeUnlock(badge);
        }
    }
    gameState.waveTimer++;
    
    if (gameState.waveTimer > BOSS_DEFEATED_FRAMES) {
        gameState.waveState = WAVE_STATE.ARENA_TRANSITION;
        gameState.waveTimer = 0;
    }
}

function handleArenaTransition() {
    gameState.waveTimer++;
    
    if (gameState.waveTimer > ARENA_TRANSITION_FRAMES) {
        gameState.currentArena++;
        gameState.currentWave = 1;
        generateArena(gameState.currentArena);
        player.position.set(0, 1, 0);
        player.velocity.set(0, 0, 0);
        gameState.waveState = WAVE_STATE.WAVE_INTRO;
        gameState.waveTimer = 0;
        
        // Load new arena music profile
        PulseMusic.onArenaChange(gameState.currentArena);
        
        updateUI();
    }
}

function unlockArenaMechanics(defeatedArena) {
    let unlockMessage = '';
    
    switch (defeatedArena) {
        case 1:
            gameState.unlockedMechanics.pillars = true;
            unlockMessage = 'PILLARS & COVER';
            break;
        case 2:
            gameState.unlockedMechanics.ramps = true;
            gameState.unlockedEnemyBehaviors.jumping = true;
            unlockMessage = 'VERTICALITY - Enemies can jump!';
            break;
        case 3:
            gameState.unlockedMechanics.platforms = true;
            gameState.unlockedEnemyBehaviors.multiLevel = true;
            unlockMessage = 'MULTI-PLATFORM COMBAT';
            break;
        case 4:
            gameState.unlockedMechanics.tunnels = true;
            gameState.unlockedEnemyBehaviors.ambush = true;
            unlockMessage = 'TUNNELS & AMBUSHES';
            break;
        case 5:
            gameState.unlockedMechanics.hybridChaos = true;
            unlockMessage = 'CHAOS MODE UNLOCKED';
            break;
    }
    
    if (unlockMessage) showUnlockNotification(unlockMessage);
}
