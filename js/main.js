// Main entry point - coordinates all modules
import { gameState, resetGameState } from './core/gameState.js';
import { initScene, createGround, onWindowResize, render, scene, renderer, camera } from './core/scene.js';
import { initInput, resetInput, checkCutsceneSkip, cleanupInput } from './core/input.js';
import { resetAllEntities, enemies, getCurrentBoss } from './core/entities.js';
import { WAVE_STATE, UI_UPDATE_INTERVAL, DEBUG, GAME_TITLE, VERSION, enableDebugMode } from './config/constants.js';

import { createPlayer, updatePlayer, resetPlayer, player } from './entities/player.js';
import { updateEnemies, clearEnemyGeometryCache } from './entities/enemies.js';
import { updateBoss } from './entities/boss.js';

import { updateWaveSystem } from './systems/waveSystem.js';
import { spawnSpecificEnemy } from './entities/enemies.js';
import { spawnBoss } from './entities/boss.js';
import { shootProjectile, updateProjectiles, resetLastShot, initProjectilePool } from './systems/projectiles.js';
import { updateXpGems, updateHearts, spawnArena1ModulePickup, updateModulePickups, clearModulePickups } from './systems/pickups.js';
import { initModuleProgress } from './systems/moduleProgress.js';
import { resetDamageTime, setPlayerRef, clearDamageLog } from './systems/damage.js';
import { initBadges, resetActiveBadges, updateStatBadges } from './systems/badges.js';
import { initLeaderboard } from './systems/leaderboard.js';
import { PulseMusic } from './systems/pulseMusic.js';
import { initLogger, setGameStateRef, resetLogState, log } from './systems/debugLog.js';
import { gpuInfo } from './systems/gpuDetect.js';

import { generateArena, updateHazardZones } from './arena/generator.js';

import { initTrailPool, updateTrail, resetTrail } from './effects/trail.js';
import { initParticlePool, updateParticles, resetParticles } from './effects/particles.js';
import { updateSlowMo, updateScreenFlash, getTimeScale, updateCinematic, isCinematicActive, endCinematic, clearGeometryCache, startIntroCinematic, updateIntroCinematic, isIntroActive, startCinematic, triggerSlowMo } from './systems/visualFeedback.js';
import { updateAmbience } from './systems/ambience.js';

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
    showStartBanner,
    showBossAnnouncement,
    hideBossAnnouncement
} from './ui/hud.js';

import {
    showLeaderboard,
    hideLeaderboard,
    showHighScoreEntry,
    checkHighScore,
    showBadgeCollection,
    hideBadgeCollection
} from './ui/leaderboardUI.js';

import { showModulesScreen, hideModulesScreen } from './ui/modulesUI.js';
import { initRosterUI } from './ui/rosterUI.js';
import { MenuScene } from './ui/menuScene.js';

let lastUIUpdate = 0;
let lastFrameTime = 0;

// Event listener cleanup tracking
const eventCleanup = [];

function addTrackedListener(target, event, handler, options) {
    target.addEventListener(event, handler, options);
    eventCleanup.push({ target, event, handler, options });
}

function cleanupAllListeners() {
    eventCleanup.forEach(({ target, event, handler, options }) => {
        target.removeEventListener(event, handler, options);
    });
    eventCleanup.length = 0;
}

// Helper: Clean up all game state and entities (reduces code duplication)
function cleanupGameState() {
    resetGameState();
    clearDamageLog();
    resetAllEntities(scene);
    resetTrail();
    resetParticles();
    resetPlayer();
    resetInput();  // Resets camera angles and key states (does NOT remove listeners)
    // NOTE: Do NOT call cleanupInput() here - input listeners must persist across game sessions.
    // They are set up once in init() and should never be removed. resetInput() handles state reset.
    resetLastShot();
    resetDamageTime();
    resetActiveBadges();
    clearModulePickups();  // Clear hidden module pickups
    clearEnemyGeometryCache();
    clearGeometryCache();
    // NOTE: Do NOT call cleanupAllListeners() here - UI button listeners must persist
    // across game sessions. They are set up once in init() and should never be removed.
    resetLogState();
    lastFrameTime = 0;
}

// Helper: Unlock all mechanics up to and including the specified arena
function unlockMechanicsForArena(arenaNumber) {
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
}

async function init() {
    // Guard against double initialization (would leak event listeners)
    if (window.__mantaSphereInitialized) {
        console.warn('init() called twice - skipping to prevent listener leaks');
        return;
    }
    window.__mantaSphereInitialized = true;
    
    // Try to enable secure debug mode (requires localhost + debug.local.js)
    try {
        const { DEBUG_SECRET } = await import('./config/debug.local.js');
        if (DEBUG_SECRET === true) {
            enableDebugMode();
        }
    } catch {
        // debug.local.js doesn't exist - debug stays off (production behavior)
    }
    
    // Initialize debug logger
    setGameStateRef(gameState);
    initLogger();
    log('STATE', 'init', { version: VERSION });
    
    // Set document title from config
    document.title = GAME_TITLE.toUpperCase();
    const titleEl = document.querySelector('#start-screen h1');
    if (titleEl) titleEl.textContent = GAME_TITLE.toUpperCase();
    
    // Show version display
    const versionEl = document.getElementById('version-display');
    if (versionEl) {
        versionEl.textContent = `v${VERSION}`;
    }
    
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
    initModuleProgress();  // Load module unlock progress from localStorage
    PulseMusic.init();
    
    // Initialize animated menu background
    const startScreen = document.getElementById('start-screen');
    if (startScreen) {
        MenuScene.init(startScreen);
    }
    
    // Check for software rendering and show warning if needed
    const loadingScreen = document.getElementById('loading-screen');
    if (!gpuInfo.supported || gpuInfo.isSoftware || gpuInfo.majorPerformanceCaveat) {
        const loadingContent = document.querySelector('.loading-content');
        if (loadingContent) {
            // Hide the loading spinner and text
            const spinner = loadingContent.querySelector('.loading-spinner');
            const loadingText = loadingContent.querySelector('p');
            if (spinner) spinner.style.display = 'none';
            if (loadingText) loadingText.style.display = 'none';
            
            // Create warning container
            const warning = document.createElement('div');
            warning.className = 'gpu-warning';
            warning.id = 'gpu-warning-modal';
            
            if (!gpuInfo.supported) {
                warning.innerHTML = `
                    <p class="warning-title">WebGL Not Available</p>
                    <p class="warning-text">This game requires WebGL to run.</p>
                    <div class="warning-buttons">
                        <button id="gpu-show-help" class="warning-btn warning-btn-primary">Show Me How to Fix</button>
                    </div>
                `;
            } else {
                warning.innerHTML = `
                    <p class="warning-title">Performance Warning</p>
                    <p class="warning-text">Hardware acceleration may be disabled. Performance may be reduced.</p>
                    <div class="warning-buttons">
                        <button id="gpu-continue" class="warning-btn warning-btn-secondary">Continue Anyway</button>
                        <button id="gpu-show-help" class="warning-btn warning-btn-primary">Show Me How to Fix</button>
                    </div>
                `;
            }
            
            // Create help instructions (hidden initially)
            const helpContent = document.createElement('div');
            helpContent.className = 'gpu-help-content';
            helpContent.id = 'gpu-help-content';
            helpContent.style.display = 'none';
            helpContent.innerHTML = `
                <p class="warning-title">Enable Hardware Acceleration</p>
                <div class="help-instructions">
                    <div class="help-section">
                        <strong>Chrome/Edge:</strong>
                        <ol>
                            <li>Open Settings → System</li>
                            <li>Enable "Use hardware acceleration when available"</li>
                            <li>Restart browser</li>
                        </ol>
                    </div>
                    <div class="help-section">
                        <strong>Firefox:</strong>
                        <ol>
                            <li>Open Settings → General → Performance</li>
                            <li>Uncheck "Use recommended performance settings"</li>
                            <li>Enable "Use hardware acceleration when available"</li>
                            <li>Restart browser</li>
                        </ol>
                    </div>
                    <div class="help-section">
                        <strong>Safari:</strong>
                        <ol>
                            <li>Check System Preferences → Energy Saver</li>
                            <li>Ensure "Automatic graphics switching" is enabled</li>
                        </ol>
                    </div>
                    <div class="help-section">
                        <strong>Still having issues?</strong>
                        <ul>
                            <li>Update your graphics drivers</li>
                            <li>Try a different browser</li>
                            <li>Check if hardware acceleration is blocked by system policy</li>
                        </ul>
                    </div>
                </div>
                <div class="warning-buttons">
                    <button id="gpu-help-continue" class="warning-btn warning-btn-primary">Continue to Game</button>
                </div>
            `;
            
            loadingContent.appendChild(warning);
            loadingContent.appendChild(helpContent);
            
            // Wait for user action (no timeout)
            await new Promise(resolve => {
                // Continue Anyway button (only if WebGL is supported)
                const continueBtn = document.getElementById('gpu-continue');
                if (continueBtn) {
                    continueBtn.addEventListener('click', resolve, { once: true });
                }
                
                // Show Me How button
                const helpBtn = document.getElementById('gpu-show-help');
                if (helpBtn) {
                    helpBtn.addEventListener('click', () => {
                        warning.style.display = 'none';
                        helpContent.style.display = 'block';
                    }, { once: true });
                }
                
                // Continue from help screen
                const helpContinueBtn = document.getElementById('gpu-help-continue');
                if (helpContinueBtn) {
                    helpContinueBtn.addEventListener('click', resolve, { once: true });
                }
            });
            
            // Clean up warning elements
            warning.remove();
            helpContent.remove();
        }
    }
    
    // Hide loading screen after MenuScene is initialized and warning shown
    if (loadingScreen) {
        loadingScreen.classList.add('fade-out');
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 500);  // Match transition duration
    }
    
    initInput(renderer.domElement);
    initAnnouncementSkip();
    addTrackedListener(window, 'resize', onWindowResize);
    
    // Music toggle
    addTrackedListener(window, 'keydown', (e) => {
        if (e.key === 'm' || e.key === 'M') {
            const enabled = PulseMusic.toggle();
            if (DEBUG) console.log(`[${GAME_TITLE.toUpperCase()}] Music:`, enabled ? 'ON' : 'OFF');
        }
    });
    
    // Button event listeners
    const startBtn = document.getElementById('start-btn');
    const restartBtn = document.getElementById('restart-btn');
    if (startBtn) addTrackedListener(startBtn, 'click', startGame);
    if (restartBtn) addTrackedListener(restartBtn, 'click', restartGame);
    
    // Leaderboard button
    const leaderboardBtn = document.getElementById('leaderboard-btn');
    if (leaderboardBtn) {
        addTrackedListener(leaderboardBtn, 'click', () => {
            showLeaderboard();
        });
    }
    
    // Close leaderboard button
    const closeLeaderboardBtn = document.getElementById('close-leaderboard');
    if (closeLeaderboardBtn) {
        addTrackedListener(closeLeaderboardBtn, 'click', hideLeaderboard);
    }
    
    // Badge collection button
    const badgesBtn = document.getElementById('badges-btn');
    if (badgesBtn) {
        addTrackedListener(badgesBtn, 'click', () => {
            showBadgeCollection();
        });
    }
    
    // Close badge collection button
    const closeBadgesBtn = document.getElementById('close-badges');
    if (closeBadgesBtn) {
        addTrackedListener(closeBadgesBtn, 'click', hideBadgeCollection);
    }
    
    // Modules button
    const modulesBtn = document.getElementById('modules-btn');
    if (modulesBtn) {
        addTrackedListener(modulesBtn, 'click', () => {
            showModulesScreen();
        });
    }
    
    // Close modules button
    const closeModulesBtn = document.getElementById('close-modules');
    if (closeModulesBtn) {
        addTrackedListener(closeModulesBtn, 'click', hideModulesScreen);
    }
    
    // Initialize character roster UI
    initRosterUI();
    
    // Update mastery display on start screen
    updateMasteryDisplay();
    
    // Pause menu main menu button
    const pauseMainMenuBtn = document.getElementById('pause-main-menu-btn');
    if (pauseMainMenuBtn) {
        addTrackedListener(pauseMainMenuBtn, 'click', (e) => {
            e.stopPropagation(); // Prevent resume trigger
            returnToMainMenu();
        });
    }
    
    // Pause menu debug button - only visible when DEBUG is enabled
    const pauseDebugBtn = document.getElementById('pause-debug-btn');
    if (pauseDebugBtn) {
        if (DEBUG) {
            pauseDebugBtn.style.display = 'inline-block';
            addTrackedListener(pauseDebugBtn, 'click', (e) => {
                e.stopPropagation(); // Prevent resume trigger
                showDebugMenu();
            });
        }
    }
    
    // Arena select button
    const arenaSelectBtn = document.getElementById('arena-select-btn');
    if (arenaSelectBtn) {
        addTrackedListener(arenaSelectBtn, 'click', () => {
            showArenaSelect();
        });
    }
    
    // Close arena select button
    const closeArenaSelectBtn = document.getElementById('close-arena-select');
    if (closeArenaSelectBtn) {
        addTrackedListener(closeArenaSelectBtn, 'click', hideArenaSelect);
    }
    
    // Listen for arena select events (avoids global namespace pollution)
    addTrackedListener(document, 'arenaSelect', (e) => {
        if (e.detail && e.detail.arena) {
            startAtArena(e.detail.arena);
        }
    });
    
    // Debug menu button - only visible when DEBUG is enabled
    const debugBtn = document.getElementById('debug-btn');
    if (debugBtn) {
        if (DEBUG) {
            addTrackedListener(debugBtn, 'click', () => {
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
        addTrackedListener(closeDebugBtn, 'click', hideDebugMenu);
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
    addTrackedListener(startScreen, 'click', tryStartMenuMusic);
    addTrackedListener(startScreen, 'keydown', tryStartMenuMusic);
    addTrackedListener(document, 'keydown', (e) => {
        if (!gameState.running) tryStartMenuMusic();
    }, { once: true });
    
    render();
}

function startGame() {
    hideStartScreen();
    resetActiveBadges();
    generateArena(1);
    spawnArena1ModulePickup();  // Spawn hidden Speed Module pickup
    
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
    cleanupGameState();
    generateArena(1);
    spawnArena1ModulePickup();  // Spawn hidden Speed Module pickup
    
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
    cleanupGameState();
    
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
    
    cleanupGameState();
    
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
    unlockMechanicsForArena(arenaNumber);
    
    // Generate the arena and start the game
    hideStartScreen();
    generateArena(arenaNumber);
    
    // Spawn hidden module pickup if starting at Arena 1
    if (arenaNumber === 1) {
        spawnArena1ModulePickup();
    }
    
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
        // Increment frame counter for cooldown tracking
        gameState.frameCount++;
        
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
            updateAmbience();  // Underwater atmosphere: bubbles, kelp, fish
            
            // Handle cinematic camera mode (boss intros)
            const cinematicActive = isCinematicActive();
            const currentBoss = getCurrentBoss();
            
            // Always update wave system (handles announcement timers)
            updateWaveSystem();
            
            // Skip combat updates during announcement pause (but allow wave timer to tick)
            if (gameState.announcementPaused) {
                // Check for cutscene skip input (hold Space/Enter to skip)
                if (gameState.cutsceneActive) {
                    checkCutsceneSkip();
                }
                
                // During boss cutscene: still update boss for demo abilities (inflation, charge, particles)
                if (gameState.cutsceneActive && currentBoss) {
                    updateBoss();
                    
                    // CRITICAL: Allow player movement during interactive dodge tutorial
                    // Player must be able to move out of the danger zone during demo_dodge_wait
                    if (currentBoss.aiState === 'demo_dodge_wait') {
                        updatePlayer(clampedDelta);
                    }
                    
                    // Update cinematic camera during cutscene
                    // EXCEPTION: Use player camera during interactive dodge tutorial
                    if (cinematicActive && currentBoss.aiState !== 'demo_dodge_wait') {
                        updateCinematic(camera, player);
                    }
                }
                
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
            updateModulePickups();  // Update hidden module pickups
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
    // Populate GPU info in debug menu
    const gpuInfoEl = document.getElementById('debug-gpu-info');
    if (gpuInfoEl) {
        gpuInfoEl.innerHTML = `
            <div class="debug-label">WebGL Version: <span style="color: #ffdd44">${gpuInfo.webglVersion || 'N/A'}</span></div>
            <div class="debug-label">Renderer: <span style="color: #ffdd44">${gpuInfo.renderer || 'Unknown'}</span></div>
            <div class="debug-label">Vendor: <span style="color: #ffdd44">${gpuInfo.vendor || 'Unknown'}</span></div>
            <div class="debug-label">Debug Info Available: <span style="color: ${gpuInfo.debugInfoAvailable ? '#44ff44' : '#ff8844'}">${gpuInfo.debugInfoAvailable ? 'Yes' : 'No'}</span></div>
            <div class="debug-label">Software Rendering: <span style="color: ${gpuInfo.isSoftware ? '#ff4444' : '#44ff44'}">${gpuInfo.isSoftware ? 'Yes (slow)' : 'No'}</span></div>
            <div class="debug-label">Performance Caveat: <span style="color: ${gpuInfo.majorPerformanceCaveat ? '#ff8844' : '#44ff44'}">${gpuInfo.majorPerformanceCaveat ? 'Yes' : 'No'}</span></div>
        `;
    }
    
    // Empty arena mode
    const emptyArenaBtn = document.getElementById('debug-empty-arena');
    if (emptyArenaBtn) {
        addTrackedListener(emptyArenaBtn, 'click', () => {
            hideDebugMenu();
            startEmptyArena();
        });
    }
    
    // Spawn enemy
    const spawnEnemyBtn = document.getElementById('debug-spawn-enemy');
    if (spawnEnemyBtn) {
        addTrackedListener(spawnEnemyBtn, 'click', () => {
            const enemyType = document.getElementById('debug-enemy-select').value;
            debugSpawnEnemy(enemyType);
        });
    }
    
    // Warp to arena/wave
    const warpBtn = document.getElementById('debug-warp-btn');
    if (warpBtn) {
        addTrackedListener(warpBtn, 'click', () => {
            const arenaEl = document.getElementById('debug-warp-arena');
            const waveEl = document.getElementById('debug-warp-wave');
            if (!arenaEl || !waveEl) return;
            const arena = parseInt(arenaEl.value, 10) || 1;
            const wave = parseInt(waveEl.value, 10) || 1;
            debugWarpToArenaWave(arena, wave);
        });
    }
    
    // Spawn boss
    const spawnBossBtn = document.getElementById('debug-spawn-boss');
    if (spawnBossBtn) {
        addTrackedListener(spawnBossBtn, 'click', () => {
            const bossEl = document.getElementById('debug-boss-select');
            if (!bossEl) return;
            const bossNum = parseInt(bossEl.value, 10) || 1;
            debugSpawnBoss(bossNum);
        });
    }
    
    // Player controls
    const giveLevelsBtn = document.getElementById('debug-give-levels');
    if (giveLevelsBtn) {
        addTrackedListener(giveLevelsBtn, 'click', () => {
            debugGiveLevels(10);
        });
    }
    
    const toggleInvincibleBtn = document.getElementById('debug-toggle-invincible');
    if (toggleInvincibleBtn) {
        addTrackedListener(toggleInvincibleBtn, 'click', () => {
            debugToggleInvincibility();
        });
    }
    
    const fullHealBtn = document.getElementById('debug-full-heal');
    if (fullHealBtn) {
        addTrackedListener(fullHealBtn, 'click', () => {
            debugFullHeal();
        });
    }
    
    const unlockAllBtn = document.getElementById('debug-unlock-all');
    if (unlockAllBtn) {
        addTrackedListener(unlockAllBtn, 'click', () => {
            debugUnlockAllMechanics();
        });
    }
}

function startEmptyArena() {
    cleanupGameState();
    
    // Enable debug mode
    gameState.debug.enabled = true;
    gameState.debug.noEnemies = true;
    
    // Unlock all mechanics for testing
    unlockMechanicsForArena(6);
    
    // Start at arena 1
    hideStartScreen();
    generateArena(1);
    spawnArena1ModulePickup();  // Spawn hidden Speed Module pickup
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
    unlockMechanicsForArena(arena);
    
    // Regenerate arena
    generateArena(arena);
    
    // Reset player position
    resetPlayer();
    
    // Update music
    PulseMusic.onArenaChange(arena);
    
    updateUI();
    if (DEBUG) console.log(`[DEBUG] Warped to Arena ${arena}, Wave ${wave}`);
}

function startBossBattle(bossNum) {
    bossNum = Math.max(1, Math.min(6, bossNum));
    
    // Close menus and unpause
    hideDebugMenu();
    hidePauseIndicator();
    gameState.paused = false;
    
    // If game not running, start it first
    if (!gameState.running) {
        // Initialize game state for boss battle
        resetGameState();
        resetPlayer(player);
        resetAllEntities(scene);
        resetParticles();
        gameState.running = true;
        hideStartScreen();
    }
    
    // Clear existing enemies
    while (enemies.length > 0) {
        const enemy = enemies.pop();
        if (enemy && enemy.parent) {
            scene.remove(enemy);
        }
    }
    
    // Transition to the correct arena
    gameState.currentArena = bossNum;
    generateArena(bossNum);
    // Reset player to arena center
    player.position.set(0, 1, 0);
    player.velocity.set(0, 0, 0);
    
    // Update music for the arena
    PulseMusic.onArenaChange(bossNum);
    
    // Initialize boss battle state
    gameState.bossActive = false;  // Will be true after intro
    gameState.waveState = WAVE_STATE.BOSS_INTRO;
    gameState.waveTimer = 0;
    gameState.announcementPaused = true;
    
    // Show boss announcement
    showBossAnnouncement();
    
    // Safety: avoid giant dt on resume
    lastFrameTime = performance.now();
    
    // Start the animation loop (was missing - caused freeze when using debug menu)
    updateUI();
    animate();
    
    if (DEBUG) console.log(`[DEBUG] Starting Boss ${bossNum} Battle`);
}

// Legacy alias for compatibility
function debugSpawnBoss(bossNum) {
    startBossBattle(bossNum);
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
