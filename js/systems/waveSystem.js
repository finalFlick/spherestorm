import { gameState } from '../core/gameState.js';
import { enemies, getCurrentBoss } from '../core/entities.js';
import { player } from '../entities/player.js';
import { spawnWaveEnemy, spawnPillarPoliceOnAllPillars } from '../entities/enemies.js';
import { spawnBoss } from '../entities/boss.js';
import { WAVE_STATE } from '../config/constants.js';
import { ARENA_CONFIG, getArenaWaves } from '../config/arenas.js';
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
    updateUI 
} from '../ui/hud.js';

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
    }
    gameState.waveTimer++;
    
    if (gameState.waveTimer > 120) {
        gameState.waveState = WAVE_STATE.WAVE_ACTIVE;
        gameState.waveTimer = 0;
        
        const base = 6 + gameState.currentArena * 3;  // More enemies per wave
        const scaling = 1 + (gameState.currentWave - 1) * 0.25;
        gameState.enemiesToSpawn = Math.floor(base * scaling);
        gameState.waveEnemiesRemaining = gameState.enemiesToSpawn;
        gameState.lastWaveSpawn = 0;
        
        // Spawn Pillar Police on all pillars in Arena 2-3
        if (gameState.currentArena >= 2 && gameState.currentArena <= 3) {
            spawnPillarPoliceOnAllPillars();
        }
        
        hideWaveAnnouncement();
    }
}

function handleWaveActive() {
    const now = Date.now();
    const spawnInterval = Math.max(250, 900 - gameState.currentArena * 60 - gameState.currentWave * 30);  // Faster spawning
    
    if (gameState.enemiesToSpawn > 0 && now - gameState.lastWaveSpawn > spawnInterval) {
        // 20% chance for burst spawn (2-3 enemies at once)
        const burstCount = Math.random() < 0.2 ? (2 + Math.floor(Math.random() * 2)) : 1;
        for (let i = 0; i < burstCount && gameState.enemiesToSpawn > 0; i++) {
            spawnWaveEnemy();
            gameState.enemiesToSpawn--;
        }
        gameState.lastWaveSpawn = now;
    }
    
    if (enemies.length === 0 && gameState.enemiesToSpawn === 0 && !getCurrentBoss()) {
        gameState.waveState = WAVE_STATE.WAVE_CLEAR;
        gameState.waveTimer = 0;
    }
}

function handleWaveClear() {
    if (gameState.waveTimer === 0) {
        PulseMusic.onWaveClear();
    }
    gameState.waveTimer++;
    
    if (gameState.waveTimer > 90) {
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
    }
    gameState.waveTimer++;
    
    if (gameState.waveTimer > 180) {
        spawnBoss(gameState.currentArena);
        gameState.bossActive = true;
        gameState.waveState = WAVE_STATE.BOSS_ACTIVE;
        gameState.waveTimer = 0;
        hideBossAnnouncement();
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
    
    if (gameState.waveTimer > 180) {
        gameState.waveState = WAVE_STATE.ARENA_TRANSITION;
        gameState.waveTimer = 0;
    }
}

function handleArenaTransition() {
    gameState.waveTimer++;
    
    if (gameState.waveTimer > 60) {
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
