// Main entry point - coordinates all modules
import { gameState, resetGameState } from './core/gameState.js';
import { initScene, createGround, onWindowResize, render, scene, renderer, camera } from './core/scene.js';
import { initInput, resetInput } from './core/input.js';
import { resetAllEntities, enemies, getCurrentBoss } from './core/entities.js';
import { WAVE_STATE, UI_UPDATE_INTERVAL, DEBUG, GAME_TITLE } from './config/constants.js';

import { createPlayer, updatePlayer, resetPlayer, player } from './entities/player.js';
import { updateEnemies, clearEnemyGeometryCache } from './entities/enemies.js';
import { updateBoss } from './entities/boss.js';

import { updateWaveSystem } from './systems/waveSystem.js';
import { spawnSpecificEnemy } from './entities/enemies.js';
import { spawnBoss } from './entities/boss.js';
import { shootProjectile, updateProjectiles, resetLastShot, initProjectilePool } from './systems/projectiles.js';
import { updateXpGems, updateHearts } from './systems/pickups.js';
import { resetDamageTime, setPlayerRef, clearDamageLog } from './systems/damage.js';
import { initBadges, resetActiveBadges, updateStatBadges } from './systems/badges.js';
import { initLeaderboard } from './systems/leaderboard.js';
import { PulseMusic } from './systems/pulseMusic.js';

import { generateArena, updateHazardZones } from './arena/generator.js';

import { initTrailPool, updateTrail, resetTrail } from './effects/trail.js';
import { initParticlePool, updateParticles, resetParticles } from './effects/particles.js';
import { updateSlowMo, updateScreenFlash, getTimeScale, updateCinematic, isCinematicActive, endCinematic, clearGeometryCache, startIntroCinematic, updateIntroCinematic, isIntroActive } from './systems/visualFeedback.js';

import { 
    updateUI, 
    hideStartScreen,
    showStartScreen, 
    showGameOver, 
    hideGameOver,
    hidePauseIndicator,
    hideBossHealthBar,
    setGameStartTime,
    getElapsedTime,
    updateMasteryDisplay,
    showArenaSelect,
    hideArenaSelect,
    showDebugMenu,
    hideDebugMenu,
    initAnnouncementSkip,
    showStartBanner
} from './ui/hud.js';

import {
    showLeaderboard,
    hideLeaderboard,
    showHighScoreEntry,
    checkHighScore,
    showBadgeCollection,
    hideBadgeCollection
} from './ui/leaderboardUI.js';

import { initRosterUI } from './ui/rosterUI.js';
import { MenuScene } from './ui/menuScene.js';

let lastUIUpdate = 0;
let lastFrameTime = 0;

function init() {
    // Set document title from config
    document.title = GAME_TITLE.toUpperCase();
    const titleEl = document.querySelector('#start-screen h1');
    if (titleEl) titleEl.textContent = GAME_TITLE.toUpperCase();
    
    initScene();
    createGround();
    const playerInstance = createPlayer();
    setPlayerRef(playerInstance);
    initTrailPool();
    initParticlePool();
    initProjectilePool();
    
    // Initialize persistent systems
    initBadges();
    initLeaderboard();
    PulseMusic.init();
    
    // Initialize animated menu background
    const startScreen = document.getElementById('start-screen');
    if (startScreen) {
        MenuScene.init(startScreen);
    }
    
    initInput(renderer.domElement);
    initAnnouncementSkip();
    window.addEventListener('resize', onWindowResize);
    
    // Music toggle
    window.addEventListener('keydown', (e) => {
        if (e.key === 'm' || e.key === 'M') {
            const enabled = PulseMusic.toggle();
            if (DEBUG) console.log(`[${GAME_TITLE.toUpperCase()}] Music:`, enabled ? 'ON' : 'OFF');
        }
    });
    
    // Button event listeners
    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('restart-btn').addEventListener('click', restartGame);
    
    // Leaderboard button
    const leaderboardBtn = document.getElementById('leaderboard-btn');
    if (leaderboardBtn) {
        leaderboardBtn.addEventListener('click', () => {
            showLeaderboard();
        });
    }
    
    // Close leaderboard button
    const closeLeaderboardBtn = document.getElementById('close-leaderboard');
    if (closeLeaderboardBtn) {
        closeLeaderboardBtn.addEventListener('click', hideLeaderboard);
    }
    
    // Badge collection button
    const badgesBtn = document.getElementById('badges-btn');
    if (badgesBtn) {
        badgesBtn.addEventListener('click', () => {
            showBadgeCollection();
        });
    }
    
    // Close badge collection button
    const closeBadgesBtn = document.getElementById('close-badges');
    if (closeBadgesBtn) {
        closeBadgesBtn.addEventListener('click', hideBadgeCollection);
    }
    
    // Initialize character roster UI
    initRosterUI();
    
    // Update mastery display on start screen
    updateMasteryDisplay();
    
    // Pause menu main menu button
    const pauseMainMenuBtn = document.getElementById('pause-main-menu-btn');
    if (pauseMainMenuBtn) {
        pauseMainMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent resume trigger
            returnToMainMenu();
        });
    }
    
    // Arena select button
    const arenaSelectBtn = document.getElementById('arena-select-btn');
    if (arenaSelectBtn) {
        arenaSelectBtn.addEventListener('click', () => {
            showArenaSelect();
        });
    }
    
    // Close arena select button
    const closeArenaSelectBtn = document.getElementById('close-arena-select');
    if (closeArenaSelectBtn) {
        closeArenaSelectBtn.addEventListener('click', hideArenaSelect);
    }
    
    // Listen for arena select events (avoids global namespace pollution)
    document.addEventListener('arenaSelect', (e) => {
        if (e.detail && e.detail.arena) {
            startAtArena(e.detail.arena);
        }
    });
    
    // Debug menu button - only visible when DEBUG is enabled
    const debugBtn = document.getElementById('debug-btn');
    if (debugBtn) {
        if (DEBUG) {
            debugBtn.addEventListener('click', () => {
                showDebugMenu();
            });
        } else {
            // Hide debug button in production
            debugBtn.style.display = 'none';
        }
    }
    
    // Close debug menu button
    const closeDebugBtn = document.getElementById('close-debug');
    if (closeDebugBtn) {
        closeDebugBtn.addEventListener('click', hideDebugMenu);
    }
    
    // Debug controls - only set up when DEBUG is enabled
    if (DEBUG) {
        setupDebugControls();
    }
    
    // Start menu music on first user interaction (browser autoplay policy requires this)
    // Note: startScreen already declared above for MenuScene.init()
    let menuMusicStarted = false;
    
    const tryStartMenuMusic = () => {
        if (!menuMusicStarted && !gameState.running) {
            PulseMusic.startMenuMusic();
            menuMusicStarted = true;
        }
    };
    
    // Start music on any interaction with start screen
    startScreen.addEventListener('click', tryStartMenuMusic);
    startScreen.addEventListener('keydown', tryStartMenuMusic);
    document.addEventListener('keydown', (e) => {
        if (!gameState.running) tryStartMenuMusic();
    }, { once: true });
    
    render();
}

function startGame() {
    hideStartScreen();
    resetActiveBadges();
    generateArena(1);
    
    // Position player but don't start waves yet - wait for intro
    resetPlayer();
    
    // Start intro cinematic
    startIntroCinematic(camera);
    gameState.introCinematicActive = true;
    
    gameState.running = true;
    // Don't set waveState yet - wait for intro to finish
    gameState.waveState = null;
    gameState.waveTimer = 0;
    setGameStartTime(Date.now());
    
    // Stop menu music and start adaptive arena music
    PulseMusic.stopMenuMusic();
    PulseMusic.resume();
    PulseMusic.onArenaChange(1);
    PulseMusic.startMusicLoop();
    
    animate();
}

function restartGame() {
    resetGameState();
    clearDamageLog();
    resetAllEntities(scene);
    resetTrail();
    resetParticles();
    resetPlayer();
    resetInput();
    resetLastShot();
    resetDamageTime();
    resetActiveBadges();
    
    // Reset delta time tracking for clean frame timing
    lastFrameTime = 0;
    
    // Clear geometry caches to prevent unbounded memory growth
    clearEnemyGeometryCache();
    clearGeometryCache();

    generateArena(1);
    
    hideGameOver();
    hidePauseIndicator();
    hideBossHealthBar();
    
    gameState.running = true;
    setGameStartTime(Date.now());
    
    // Restart music
    PulseMusic.resume();
    PulseMusic.onArenaChange(1);
    PulseMusic.startMusicLoop();
    
    updateUI();
    animate();
}

function returnToMainMenu() {
    // Reset all game state and entities
    resetGameState();
    clearDamageLog();
    resetAllEntities(scene);
    resetTrail();
    resetParticles();
    resetPlayer();
    resetInput();
    resetLastShot();
    resetDamageTime();
    resetActiveBadges();
    
    // Clear geometry caches to prevent unbounded memory growth
    clearEnemyGeometryCache();
    clearGeometryCache();
    
    // Stop the game and exit pointer lock
    gameState.running = false;
    document.exitPointerLock();
    
    // Hide all game UI
    hideGameOver();
    hidePauseIndicator();
    hideBossHealthBar();
    
    // Stop music and return to menu music
    PulseMusic.stopMusicLoop();
    PulseMusic.startMenuMusic();
    
    // Show main menu and resume menu scene
    showStartScreen();
    MenuScene.resume();
    updateMasteryDisplay();
}

function startAtArena(arenaNumber) {
    // Pause menu scene animation
    MenuScene.pause();
    
    // Reset game state first
    resetGameState();
    resetAllEntities(scene);
    resetTrail();
    resetParticles();
    resetPlayer();
    resetInput();
    resetLastShot();
    resetDamageTime();
    resetActiveBadges();
    
    // Reset delta time tracking for clean frame timing
    lastFrameTime = 0;
    
    // Clear geometry caches to prevent unbounded memory growth
    clearEnemyGeometryCache();
    clearGeometryCache();
    
    // Arena level scaling configuration
    const arenaScaling = {
        1: { level: 1, damage: 10, projCount: 1, speed: 0.15, maxHealth: 100 },
        2: { level: 4, damage: 16, projCount: 1, speed: 0.17, maxHealth: 125 },
        3: { level: 7, damage: 20, projCount: 2, speed: 0.19, maxHealth: 150 },
        4: { level: 10, damage: 25, projCount: 2, speed: 0.22, maxHealth: 175 },
        5: { level: 13, damage: 31, projCount: 3, speed: 0.25, maxHealth: 200 },
        6: { level: 17, damage: 39, projCount: 3, speed: 0.28, maxHealth: 250 }
    };
    
    const scaling = arenaScaling[arenaNumber];
    
    // Scale player stats
    gameState.level = scaling.level;
    gameState.stats.damage = scaling.damage;
    gameState.stats.projectileCount = scaling.projCount;
    gameState.stats.moveSpeed = scaling.speed;
    gameState.stats.maxHealth = scaling.maxHealth;
    gameState.maxHealth = scaling.maxHealth;
    gameState.health = scaling.maxHealth;
    
    // Also add some progression for other stats
    gameState.stats.attackSpeed = 1 + (arenaNumber - 1) * 0.15;
    gameState.stats.projectileSpeed = 0.8 + (arenaNumber - 1) * 0.05;
    gameState.stats.pickupRange = 3 + (arenaNumber - 1) * 0.3;
    
    // Set arena and unlock mechanics
    gameState.currentArena = arenaNumber;
    
    // Unlock all mechanics up to this arena
    if (arenaNumber >= 2) {
        gameState.unlockedMechanics.pillars = true;
    }
    if (arenaNumber >= 3) {
        gameState.unlockedMechanics.ramps = true;
        gameState.unlockedEnemyBehaviors.jumping = true;
    }
    if (arenaNumber >= 4) {
        gameState.unlockedMechanics.platforms = true;
        gameState.unlockedEnemyBehaviors.multiLevel = true;
    }
    if (arenaNumber >= 5) {
        gameState.unlockedMechanics.tunnels = true;
        gameState.unlockedEnemyBehaviors.ambush = true;
    }
    if (arenaNumber >= 6) {
        gameState.unlockedMechanics.hybridChaos = true;
    }
    
    // Generate the arena and start the game
    hideStartScreen();
    generateArena(arenaNumber);
    gameState.running = true;
    gameState.waveState = WAVE_STATE.WAVE_INTRO;
    gameState.waveTimer = 0;
    setGameStartTime(Date.now());
    
    // Stop menu music and start adaptive arena music
    PulseMusic.stopMenuMusic();
    PulseMusic.resume();
    PulseMusic.onArenaChange(arenaNumber);
    PulseMusic.startMusicLoop();
    
    updateUI();
    animate();
}

function gameOver() {
    gameState.running = false;
    document.exitPointerLock();
    
    // Stop music with game over stinger
    PulseMusic.onGameOver();
    
    const score = gameState.score;
    const arena = gameState.currentArena;
    const wave = gameState.currentWave;
    const level = gameState.level;
    const time = getElapsedTime();
    
    // Check for high score
    if (checkHighScore(score)) {
        showHighScoreEntry(score, arena, wave, level, time, (position) => {
            showGameOver();
        });
    } else {
        showGameOver();
    }
}

function animate(currentTime) {
    if (!gameState.running) return;
    requestAnimationFrame(animate);
    
    // Calculate delta time normalized to 60fps (16.67ms per frame)
    // If lastFrameTime is 0 (first frame), use 1.0 as delta
    const delta = lastFrameTime === 0 ? 1.0 : (currentTime - lastFrameTime) / 16.67;
    lastFrameTime = currentTime;
    
    // Clamp delta to prevent huge jumps (e.g., when tab is inactive)
    let clampedDelta = Math.min(delta, 3.0);
    
    // Apply slow-mo time scale
    const timeScale = getTimeScale();
    clampedDelta *= timeScale;
    
    if (!gameState.paused) {
        try {
            // Handle intro cinematic (camera pan from above before gameplay starts)
            if (gameState.introCinematicActive) {
                const stillActive = updateIntroCinematic(camera, player);
                if (!stillActive) {
                    // Intro finished - show START banner and begin gameplay
                    gameState.introCinematicActive = false;
                    showStartBanner();
                    gameState.waveState = WAVE_STATE.WAVE_INTRO;
                    gameState.waveTimer = 0;
                }
                // Only render during intro - skip all game updates
                renderer.render(scene, camera);
                return;
            }
            
            // Always update visual effect timers (even during slow-mo)
            updateSlowMo();
            updateScreenFlash();
            
            // Handle cinematic camera mode (boss intros)
            const cinematicActive = isCinematicActive();
            const currentBoss = getCurrentBoss();
            
            // Always update wave system (handles announcement timers)
            updateWaveSystem();
            
            // Skip combat updates during announcement pause (but allow wave timer to tick)
            if (gameState.announcementPaused) {
                // Only update particles and UI during announcements
                updateParticles(clampedDelta);
                const now = Date.now();
                if (now - lastUIUpdate > UI_UPDATE_INTERVAL) {
                    updateUI();
                    lastUIUpdate = now;
                }
                renderer.render(scene, camera);
                return;
            }
            
            if (cinematicActive && currentBoss) {
                // Update cinematic camera - skip normal player camera update
                updateCinematic(camera, player);
            }
            
            // Update game systems with time-scaled delta
            if (!cinematicActive) {
                updatePlayer(clampedDelta);
            }
            updateEnemies(clampedDelta);
            updateBoss();
            updateProjectiles(clampedDelta);
            updateXpGems(clampedDelta);
            updateHearts(clampedDelta);
            updateParticles(clampedDelta);
            updateTrail();
            updateHazardZones();
            
            if (!cinematicActive) {
                shootProjectile();
            }
            
            // Update adaptive music
            PulseMusic.update(gameState, enemies, currentBoss);
            
            // Check game over
            if (gameState.health <= 0) {
                gameOver();
                return;
            }
            
            const now = Date.now();
            if (now - lastUIUpdate > UI_UPDATE_INTERVAL) {
                updateUI();
                lastUIUpdate = now;
            }
        } catch (error) {
            console.error(`[${GAME_TITLE.toUpperCase()}] Update error:`, error);
            
            // Track consecutive errors for graceful degradation
            gameState._errorCount = (gameState._errorCount || 0) + 1;
            
            // Attempt graceful recovery - reset to safe state
            if (gameState._errorCount <= 3) {
                // Try to recover by resetting problematic state
                gameState.waveState = WAVE_STATE.WAVE_ACTIVE;
                gameState.bossActive = false;
                console.warn(`[${GAME_TITLE.toUpperCase()}] Recovered from error (${gameState._errorCount}/3)`);
            } else {
                // Too many errors - stop the game to prevent cascading failures
                console.error(`[${GAME_TITLE.toUpperCase()}] Too many consecutive errors, stopping game`);
                gameState.running = false;
                gameOver();
                return;
            }
        }
        
        // Reset error count on successful frame
        gameState._errorCount = 0;
    }
    
    render();
}

// Debug menu functions
function setupDebugControls() {
    // Empty arena mode
    document.getElementById('debug-empty-arena')?.addEventListener('click', () => {
        hideDebugMenu();
        startEmptyArena();
    });
    
    // Spawn enemy
    document.getElementById('debug-spawn-enemy')?.addEventListener('click', () => {
        const enemyType = document.getElementById('debug-enemy-select').value;
        debugSpawnEnemy(enemyType);
    });
    
    // Warp to arena/wave
    document.getElementById('debug-warp-btn')?.addEventListener('click', () => {
        const arena = parseInt(document.getElementById('debug-warp-arena').value);
        const wave = parseInt(document.getElementById('debug-warp-wave').value);
        debugWarpToArenaWave(arena, wave);
    });
    
    // Spawn boss
    document.getElementById('debug-spawn-boss')?.addEventListener('click', () => {
        const bossNum = parseInt(document.getElementById('debug-boss-select').value);
        debugSpawnBoss(bossNum);
    });
    
    // Player controls
    document.getElementById('debug-give-levels')?.addEventListener('click', () => {
        debugGiveLevels(10);
    });
    
    document.getElementById('debug-toggle-invincible')?.addEventListener('click', () => {
        debugToggleInvincibility();
    });
    
    document.getElementById('debug-full-heal')?.addEventListener('click', () => {
        debugFullHeal();
    });
    
    document.getElementById('debug-unlock-all')?.addEventListener('click', () => {
        debugUnlockAllMechanics();
    });
}

function startEmptyArena() {
    // Reset and start game with no enemy spawning
    resetGameState();
    resetAllEntities(scene);
    resetTrail();
    resetParticles();
    resetPlayer();
    resetInput();
    resetLastShot();
    resetDamageTime();
    resetActiveBadges();
    
    // Enable debug mode
    gameState.debug.enabled = true;
    gameState.debug.noEnemies = true;
    
    // Unlock all mechanics for testing
    gameState.unlockedMechanics.pillars = true;
    gameState.unlockedMechanics.ramps = true;
    gameState.unlockedMechanics.platforms = true;
    gameState.unlockedMechanics.tunnels = true;
    gameState.unlockedMechanics.hybridChaos = true;
    gameState.unlockedEnemyBehaviors.jumping = true;
    gameState.unlockedEnemyBehaviors.ambush = true;
    gameState.unlockedEnemyBehaviors.multiLevel = true;
    
    // Start at arena 1
    hideStartScreen();
    generateArena(1);
    gameState.running = true;
    gameState.waveState = WAVE_STATE.WAVE_INTRO;
    gameState.waveTimer = 0;
    setGameStartTime(Date.now());
    
    PulseMusic.stopMenuMusic();
    PulseMusic.resume();
    PulseMusic.onArenaChange(1);
    PulseMusic.startMusicLoop();
    
    updateUI();
    animate();
    
    if (DEBUG) console.log('[DEBUG] Empty arena started - no enemies will spawn');
}

function debugSpawnEnemy(enemyType) {
    if (!gameState.running) {
        if (DEBUG) console.log('[DEBUG] Cannot spawn enemy - game not running');
        return;
    }
    
    // Spawn enemy at random position around player
    const angle = Math.random() * Math.PI * 2;
    const distance = 10 + Math.random() * 10;
    const x = player.position.x + Math.cos(angle) * distance;
    const z = player.position.z + Math.sin(angle) * distance;
    
    spawnSpecificEnemy(enemyType, x, 1, z);
    if (DEBUG) console.log(`[DEBUG] Spawned ${enemyType} at (${x.toFixed(1)}, 1, ${z.toFixed(1)})`);
}

function debugWarpToArenaWave(arena, wave) {
    if (!gameState.running) {
        if (DEBUG) console.log('[DEBUG] Cannot warp - game not running');
        return;
    }
    
    arena = Math.max(1, Math.min(6, arena));
    wave = Math.max(1, Math.min(10, wave));
    
    // Clear all enemies
    resetAllEntities(scene);
    
    // Set arena and wave
    gameState.currentArena = arena;
    gameState.currentWave = wave;
    gameState.waveState = WAVE_STATE.WAVE_INTRO;
    gameState.waveTimer = 0;
    gameState.bossActive = false;
    
    // Unlock appropriate mechanics
    if (arena >= 2) gameState.unlockedMechanics.pillars = true;
    if (arena >= 3) {
        gameState.unlockedMechanics.ramps = true;
        gameState.unlockedEnemyBehaviors.jumping = true;
    }
    if (arena >= 4) {
        gameState.unlockedMechanics.platforms = true;
        gameState.unlockedEnemyBehaviors.multiLevel = true;
    }
    if (arena >= 5) {
        gameState.unlockedMechanics.tunnels = true;
        gameState.unlockedEnemyBehaviors.ambush = true;
    }
    if (arena >= 6) {
        gameState.unlockedMechanics.hybridChaos = true;
    }
    
    // Regenerate arena
    generateArena(arena);
    
    // Reset player position
    resetPlayer();
    
    // Update music
    PulseMusic.onArenaChange(arena);
    
    updateUI();
    if (DEBUG) console.log(`[DEBUG] Warped to Arena ${arena}, Wave ${wave}`);
}

function debugSpawnBoss(bossNum) {
    if (!gameState.running) {
        if (DEBUG) console.log('[DEBUG] Cannot spawn boss - game not running');
        return;
    }
    
    bossNum = Math.max(1, Math.min(6, bossNum));
    
    // Spawn boss at center
    spawnBoss(bossNum);
    gameState.bossActive = true;
    
    if (DEBUG) console.log(`[DEBUG] Spawned Boss ${bossNum}`);
}

function debugGiveLevels(count) {
    if (!gameState.running) {
        if (DEBUG) console.log('[DEBUG] Cannot give levels - game not running');
        return;
    }
    
    for (let i = 0; i < count; i++) {
        gameState.level++;
        gameState.score += 50;
        
        // Apply a balanced set of upgrades
        const upgradeIndex = i % 4;
        switch(upgradeIndex) {
            case 0:
                gameState.stats.damage = Math.floor(gameState.stats.damage * 1.25);
                break;
            case 1:
                gameState.stats.attackSpeed *= 1.2;
                break;
            case 2:
                gameState.stats.moveSpeed *= 1.15;
                break;
            case 3:
                gameState.stats.maxHealth += 25;
                gameState.maxHealth = gameState.stats.maxHealth;
                gameState.health = Math.min(gameState.health + 25, gameState.maxHealth);
                break;
        }
        
        // Every 3rd level, add projectile
        if (i % 3 === 0) {
            gameState.stats.projectileCount++;
        }
    }
    
    updateUI();
    if (DEBUG) console.log(`[DEBUG] Gave ${count} levels - now level ${gameState.level}`);
}

function debugToggleInvincibility() {
    gameState.debug.invincible = !gameState.debug.invincible;
    
    const btn = document.getElementById('debug-toggle-invincible');
    if (btn) {
        btn.textContent = gameState.debug.invincible ? 'Invincibility: ON' : 'Toggle Invincibility';
        btn.style.background = gameState.debug.invincible ? 
            'linear-gradient(135deg, #116611, #118811)' : 
            'linear-gradient(135deg, #444, #555)';
    }
    
    if (DEBUG) console.log(`[DEBUG] Invincibility: ${gameState.debug.invincible ? 'ON' : 'OFF'}`);
}

function debugFullHeal() {
    if (!gameState.running) {
        if (DEBUG) console.log('[DEBUG] Cannot heal - game not running');
        return;
    }
    
    gameState.health = gameState.maxHealth;
    updateUI();
    if (DEBUG) console.log('[DEBUG] Full heal applied');
}

function debugUnlockAllMechanics() {
    gameState.unlockedMechanics.pillars = true;
    gameState.unlockedMechanics.ramps = true;
    gameState.unlockedMechanics.platforms = true;
    gameState.unlockedMechanics.tunnels = true;
    gameState.unlockedMechanics.hybridChaos = true;
    gameState.unlockedEnemyBehaviors.jumping = true;
    gameState.unlockedEnemyBehaviors.ambush = true;
    gameState.unlockedEnemyBehaviors.multiLevel = true;
    
    if (DEBUG) console.log('[DEBUG] All mechanics unlocked');
}

// Initialize when DOM is ready
window.onload = init;
