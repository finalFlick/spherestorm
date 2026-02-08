// Main entry point - coordinates all modules
import { gameState, resetGameState } from './core/gameState.js';
import { initScene, createGround, onWindowResize, render, scene, renderer, camera } from './core/scene.js';
import { initInput, resetInput, checkCutsceneSkip, cleanupInput } from './core/input.js';
import { resetAllEntities, enemies, getCurrentBoss } from './core/entities.js';
import { WAVE_STATE, UI_UPDATE_INTERVAL, DEBUG_ENABLED, GAME_TITLE, VERSION, COMMIT_HASH, enableDebugMode, PLAYTEST_CONFIG, DEFAULT_LIVES } from './config/constants.js';
import { setDifficulty, getDifficultyConfig } from './core/gameState.js';

import { createPlayer, updatePlayer, resetPlayer, player } from './entities/player.js';
import { updateEnemies, clearEnemyGeometryCache } from './entities/enemies.js';
import { updateBoss } from './entities/boss.js';

import { updateWaveSystem } from './systems/waveSystem.js';
import { spawnSpecificEnemy } from './entities/enemies.js';
import { spawnBoss } from './entities/boss.js';
import { shootProjectile, updateProjectiles, resetLastShot, initProjectilePool, clearProjectiles } from './systems/projectiles.js';
import { updateXpGems, updateHearts, spawnArena1ModulePickup, updateModulePickups, clearModulePickups, applyXp, updateChests } from './systems/pickups.js';
import { initModuleProgress } from './systems/moduleProgress.js';
import { resetDamageTime, setPlayerRef, clearDamageLog } from './systems/damage.js';
import { initBadges, resetActiveBadges, updateStatBadges } from './systems/badges.js';
import { initLeaderboard } from './systems/leaderboard.js';
import { PulseMusic } from './systems/pulseMusic.js';
import { initLogger, setGameStateRef, resetLogState, log } from './systems/debugLog.js';
import { gpuInfo } from './systems/gpuDetect.js';
import { TUNING } from './config/tuning.js';

import { generateArena, updateHazardZones } from './arena/generator.js';

import { initTrailPool, updateTrail, resetTrail } from './effects/trail.js';
import { initParticlePool, updateParticles, resetParticles } from './effects/particles.js';
import { updateSlowMo, updateScreenFlash, getTimeScale, updateCinematic, isCinematicActive, endCinematic, clearGeometryCache, startIntroCinematic, updateIntroCinematic, isIntroActive, startCinematic, triggerSlowMo } from './systems/visualFeedback.js';
import { updateAmbience } from './systems/ambience.js';
import { updateMaterialFlashes, clearMaterialFlashes } from './systems/materialUtils.js';

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
    hideBossAnnouncement,
    showDashTutorialOnFirstStart
} from './ui/hud.js';

import {
    showLeaderboard,
    hideLeaderboard,
    showHighScoreEntry,
    checkHighScore,
    showBadgeCollection,
    hideBadgeCollection
} from './ui/leaderboardUI.js';


import { ARENA_XP_REWARDS } from './config/arenaXP.js';

import { showModulesScreen, hideModulesScreen } from './ui/modulesUI.js';
import { initRosterUI } from './ui/rosterUI.js';
import { MenuScene } from './ui/menuScene.js';
import { 
    initPlaytestFeedback, 
    initFeedbackFormListeners, 
    showFeedbackOverlay, 
    hideFeedbackOverlay,
    showPlayAgainPrompt,
    hidePlayAgainPrompt,
    isFeedbackEnabled,
    testFeedbackConnection
} from './systems/playtestFeedback.js';

let lastUIUpdate = 0;
let lastFrameTime = 0;
let lastCutsceneActive = false;

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
    clearMaterialFlashes();  // Clear pending material flash resets
    // NOTE: Do NOT call cleanupAllListeners() here - UI button listeners must persist
    // across game sessions. They are set up once in init() and should never be removed.
    resetLogState();
    lastFrameTime = 0;
    lastUIUpdate = 0;
}

// Helper: Apply starting lives from tuning config (called at run start)
// Defaults to DEFAULT_LIVES constant, but can be overridden by TUNING for debug
function applyStartingLives() {
    const livesRaw = Number(TUNING.playerStartingLives);
    if (Number.isFinite(livesRaw) && livesRaw > 0) {
        gameState.lives = Math.max(1, Math.min(9, Math.round(livesRaw)));
    } else {
        // Use default from constants
        gameState.lives = DEFAULT_LIVES;
    }
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

function getCumulativeArenaXp(arenaNumber) {
    let totalXp = 0;
    for (let arena = 1; arena < arenaNumber; arena++) {
        const reward = ARENA_XP_REWARDS?.[arena];
        if (reward && Number.isFinite(reward.totalXp)) {
            totalXp += reward.totalXp;
        }
    }
    return totalXp;
}

function applyBaselineLevelScaling(levelUpsToApply) {
    const levels = Math.max(0, Math.floor(levelUpsToApply || 0));

    for (let i = 0; i < levels; i++) {
        gameState.level++;
        gameState.score += 50;

        const upgradeIndex = i % 4;
        switch (upgradeIndex) {
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

        if (i % 3 === 0) {
            gameState.stats.projectileCount++;
        }
    }

    gameState.pendingLevelUps = 0;
}

async function init() {
    // Guard against double initialization (would leak event listeners)
    if (window.__mantaSphereInitialized) {
        console.warn('init() called twice - skipping to prevent listener leaks');
        return;
    }
    window.__mantaSphereInitialized = true;
    
    // Enable debug mode and playtest feedback based on build-time config
    // Dev build (npm run dev): DEBUG_SECRET=true, enables debug logging
    // Prod build (npm run build): DEBUG_SECRET=false, debug disabled
    if (enableDebugMode()) {
        setupDebugUI();
    }
    if (PLAYTEST_CONFIG && PLAYTEST_CONFIG.url && PLAYTEST_CONFIG.token) {
        initPlaytestFeedback(PLAYTEST_CONFIG);
    }
    
    // Initialize debug logger (AFTER debug mode check completes)
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
        versionEl.textContent = `v${VERSION} (${COMMIT_HASH})`;
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
    
    // Hide loading screen after MenuScene is initialized
    if (loadingScreen) {
        loadingScreen.classList.add('fade-out');
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 500);
    }
    
    initInput(renderer.domElement);
    initAnnouncementSkip();
    addTrackedListener(window, 'resize', onWindowResize);
    
    // Music toggle
    addTrackedListener(window, 'keydown', (e) => {
        if (e.key === 'm' || e.key === 'M') {
            const enabled = PulseMusic.toggle();
            log('DEBUG', 'music_toggled', { enabled });
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
    
    // Pause menu feedback button
    const pauseFeedbackBtn = document.getElementById('pause-feedback-btn');
    if (pauseFeedbackBtn) {
        // Update button state based on feedback config
        if (!isFeedbackEnabled()) {
            pauseFeedbackBtn.disabled = true;
            pauseFeedbackBtn.title = 'Feedback not configured. Add PLAYTEST_URL and PLAYTEST_TOKEN to .env and rebuild.';
            pauseFeedbackBtn.style.opacity = '0.5';
        }
        addTrackedListener(pauseFeedbackBtn, 'click', (e) => {
            e.stopPropagation(); // Prevent resume trigger
            showFeedbackOverlay('pause'); // Still shows overlay with warning if disabled
        });
    }

    // Pause menu audio sliders (stopPropagation so tweaking sliders doesn't resume via pointer lock click handler)
    const masterVolumeSlider = document.getElementById('master-volume');
    const musicVolumeSlider = document.getElementById('music-volume');
    const sfxVolumeSlider = document.getElementById('sfx-volume');

    const masterVolumeValue = document.getElementById('master-volume-value');
    const musicVolumeValue = document.getElementById('music-volume-value');
    const sfxVolumeValue = document.getElementById('sfx-volume-value');

    function stopResumeClick(e) {
        e.stopPropagation();
    }

    if (masterVolumeSlider) {
        addTrackedListener(masterVolumeSlider, 'mousedown', stopResumeClick);
        addTrackedListener(masterVolumeSlider, 'click', stopResumeClick);
        addTrackedListener(masterVolumeSlider, 'input', (e) => {
            stopResumeClick(e);
            const value = parseInt(e.target.value, 10);
            const vol = (Number.isFinite(value) ? value : 70) / 100;
            PulseMusic.setMasterVolume(vol);
            if (masterVolumeValue) masterVolumeValue.textContent = `${value}%`;
        });
    }

    if (musicVolumeSlider) {
        addTrackedListener(musicVolumeSlider, 'mousedown', stopResumeClick);
        addTrackedListener(musicVolumeSlider, 'click', stopResumeClick);
        addTrackedListener(musicVolumeSlider, 'input', (e) => {
            stopResumeClick(e);
            const value = parseInt(e.target.value, 10);
            const vol = (Number.isFinite(value) ? value : 50) / 100;
            if (PulseMusic.musicBus && PulseMusic.ctx) {
                PulseMusic.musicBus.gain.setValueAtTime(Math.max(0, Math.min(1, vol)), PulseMusic.ctx.currentTime);
            }
            if (musicVolumeValue) musicVolumeValue.textContent = `${value}%`;
        });
    }

    if (sfxVolumeSlider) {
        addTrackedListener(sfxVolumeSlider, 'mousedown', stopResumeClick);
        addTrackedListener(sfxVolumeSlider, 'click', stopResumeClick);
        addTrackedListener(sfxVolumeSlider, 'input', (e) => {
            stopResumeClick(e);
            const value = parseInt(e.target.value, 10);
            const vol = (Number.isFinite(value) ? value : 70) / 100;
            if (PulseMusic.sfxBus && PulseMusic.ctx) {
                PulseMusic.sfxBus.gain.setValueAtTime(Math.max(0, Math.min(1, vol)), PulseMusic.ctx.currentTime);
            }
            if (sfxVolumeValue) sfxVolumeValue.textContent = `${value}%`;
        });
    }
    
    // Main menu feedback button
    const menuFeedbackBtn = document.getElementById('menu-feedback-btn');
    if (menuFeedbackBtn) {
        // Update button state based on feedback config
        if (!isFeedbackEnabled()) {
            menuFeedbackBtn.disabled = true;
            menuFeedbackBtn.title = 'Feedback not configured. Add PLAYTEST_URL and PLAYTEST_TOKEN to .env and rebuild.';
            menuFeedbackBtn.style.opacity = '0.5';
        }
        addTrackedListener(menuFeedbackBtn, 'click', () => {
            showFeedbackOverlay('menu'); // Still shows overlay with warning if disabled
        });
    }
    
    // Death screen feedback button
    const deathFeedbackBtn = document.getElementById('death-feedback-btn');
    if (deathFeedbackBtn) {
        // Update button state based on feedback config
        if (!isFeedbackEnabled()) {
            deathFeedbackBtn.disabled = true;
            deathFeedbackBtn.title = 'Feedback not configured. Add PLAYTEST_URL and PLAYTEST_TOKEN to .env and rebuild.';
            deathFeedbackBtn.style.opacity = '0.5';
        }
        addTrackedListener(deathFeedbackBtn, 'click', () => {
            hideGameOver();
            showFeedbackOverlay('death'); // Still shows overlay with warning if disabled
        });
    }
    
    // Initialize feedback form listeners
    initFeedbackFormListeners();
    
    // Play Again prompt buttons
    const playAgainYes = document.getElementById('play-again-yes');
    if (playAgainYes) {
        addTrackedListener(playAgainYes, 'click', () => {
            hidePlayAgainPrompt();
            restartGame();
        });
    }
    
    const playAgainMenu = document.getElementById('play-again-menu');
    if (playAgainMenu) {
        addTrackedListener(playAgainMenu, 'click', () => {
            hidePlayAgainPrompt();
            returnToMainMenu();
        });
    }
    
    // Pause menu debug button - handled by setupDebugUI() after debug mode is enabled
    
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
    
    // Debug menu button - setupDebugUI() shows it when debug mode is enabled
    // Button is hidden by default in CSS/HTML, no need to hide it here
    // (Previously this code was hiding the button AFTER setupDebugUI showed it, causing a race condition)
    
    // Close debug menu button (always set up, menu just won't be accessible without debug mode)
    const closeDebugBtn = document.getElementById('close-debug');
    if (closeDebugBtn) {
        addTrackedListener(closeDebugBtn, 'click', hideDebugMenu);
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
    applyStartingLives();

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
    setGameStartTime(0);
    
    // Stop menu music and start adaptive arena music
    PulseMusic.stopMenuMusic();
    PulseMusic.resume();
    PulseMusic.onArenaChange(1);
    
    // Show dash tutorial on first game start
    showDashTutorialOnFirstStart();
    PulseMusic.startMusicLoop();
    
    animate();
}

function restartGame() {
    cleanupGameState();
    generateArena(1);
    spawnArena1ModulePickup();  // Spawn hidden Speed Module pickup
    applyStartingLives();
    
    hideGameOver();
    hidePauseIndicator();
    hideBossHealthBar();
    
    gameState.running = true;
    setGameStartTime(0);
    
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

    // Award cumulative XP from all previous arenas to match progression
    const previousArenaXp = getCumulativeArenaXp(arenaNumber);
    if (previousArenaXp > 0) {
        applyXp(previousArenaXp);
    }
    
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
    applyStartingLives();
    
    gameState.running = true;
    gameState.waveState = WAVE_STATE.WAVE_INTRO;
    gameState.waveTimer = 0;
    setGameStartTime(0);
    
    // Stop menu music and start adaptive arena music
    PulseMusic.stopMenuMusic();
    PulseMusic.resume();
    PulseMusic.onArenaChange(arenaNumber);
    PulseMusic.startMusicLoop();
    
    updateUI();

    // Auto-apply baseline scaling for pending level-ups (no upgrade prompts)
    if (gameState.pendingLevelUps > 0) {
        applyBaselineLevelScaling(gameState.pendingLevelUps);
        updateUI();
    }
    animate();
}

function gameOver() {
    gameState.running = false;
    document.exitPointerLock();
    
    // Stop music with game over stinger
    PulseMusic.onGameOver();
    
    // Apply difficulty score multiplier
    const diffConfig = getDifficultyConfig();
    const baseScore = gameState.score;
    const adjustedScore = Math.floor(baseScore * diffConfig.scoreMult);
    
    const arena = gameState.currentArena;
    const wave = gameState.currentWave;
    const level = gameState.level;
    const time = getElapsedTime();
    const difficulty = gameState.currentDifficulty;
    
    // Check for high score (use adjusted score for comparison)
    if (checkHighScore(adjustedScore)) {
        showHighScoreEntry(adjustedScore, arena, wave, level, time, difficulty, (position) => {
            showGameOver();
        });
    } else {
        showGameOver();
    }
}

function tryConsumeLifeAndRespawn() {
    if (!gameState.running) return false;

    // Check if player has lives remaining
    if (!gameState.lives || gameState.lives <= 0) return false;

    gameState.lives = Math.max(0, gameState.lives - 1);

    // Restore health and reset damage state
    gameState.health = gameState.maxHealth;
    resetDamageTime();

    // Respawn by rewinding to current arena/wave (safe: rebuilds arena + clears entities)
    debugWarpToArenaWave(gameState.currentArena, gameState.currentWave);

    log('STATE', 'life_consumed_respawn', { livesRemaining: gameState.lives });
    return true;
}

function animate(currentTime) {
    if (!gameState.running) return;
    requestAnimationFrame(animate);
    
    // Calculate delta time normalized to 60fps (16.67ms per frame)
    // If lastFrameTime is 0 (first frame), use 1.0 as delta
    const rawDeltaMs = lastFrameTime === 0 ? 0 : (currentTime - lastFrameTime);
    const delta = lastFrameTime === 0 ? 1.0 : rawDeltaMs / 16.67;
    lastFrameTime = currentTime;
    
    // Clamp delta to prevent huge jumps (e.g., when tab is inactive)
    let clampedDelta = Math.min(delta, 3.0);
    
    // Apply slow-mo time scale
    const timeScale = getTimeScale();
    clampedDelta *= timeScale;

    // True seconds deltas (clamped to match max 3-frame jump)
    const realDeltaSec = Math.min(rawDeltaMs / 1000, 0.05);
    let simDeltaSec = realDeltaSec * timeScale;
    if (gameState.paused || gameState.announcementPaused) {
        simDeltaSec = 0;
    }

    // Advance time tracking
    gameState.time.realSeconds += realDeltaSec;
    gameState.time.simSeconds += simDeltaSec;
    if (!gameState.paused && !gameState.cutsceneActive && !gameState.announcementPaused && !gameState.introCinematicActive) {
        gameState.time.runSeconds += realDeltaSec;
    }

    if (gameState.cutsceneActive && !lastCutsceneActive) {
        clearProjectiles();
    }
    lastCutsceneActive = gameState.cutsceneActive;
    
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

            // Cutscene whitelist: boss demo + optional player movement only
            if (gameState.cutsceneActive && !gameState.announcementPaused) {
                checkCutsceneSkip();

                if (currentBoss) {
                    updateBoss();
                }

                if (currentBoss?.aiState === 'demo_dodge_wait' || gameState.interactiveDodgeTutorial) {
                    updatePlayer(clampedDelta);
                }

                if (cinematicActive && currentBoss?.aiState !== 'demo_dodge_wait') {
                    updateCinematic(camera, player);
                }

                updateParticles(clampedDelta);
                updateTrail();
                updateMaterialFlashes();
                PulseMusic.update(gameState, enemies, currentBoss);

                const now = gameState.time.realSeconds;
                if (now - lastUIUpdate > (UI_UPDATE_INTERVAL / 1000)) {
                    updateUI();
                    lastUIUpdate = now;
                }
                renderer.render(scene, camera);
                return;
            }
            
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
                const now = gameState.time.realSeconds;
                if (now - lastUIUpdate > (UI_UPDATE_INTERVAL / 1000)) {
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
            updateChests();         // Update item chests
            updateParticles(clampedDelta);
            updateTrail();
            updateMaterialFlashes();  // Frame-based material flash resets
            updateHazardZones();
            
            if (!cinematicActive) {
                shootProjectile();
            }
            
            // Update adaptive music
            PulseMusic.update(gameState, enemies, currentBoss);
            
            // Check game over
            if (gameState.health <= 0) {
                if (tryConsumeLifeAndRespawn()) {
                    return;
                }
                gameOver();
                return;
            }
            
            const now = gameState.time.realSeconds;
            if (now - lastUIUpdate > (UI_UPDATE_INTERVAL / 1000)) {
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

// Called when debug mode is enabled (dev builds only)
function setupDebugUI() {
    // Show debug button
    const debugBtn = document.getElementById('debug-btn');
    if (debugBtn) {
        debugBtn.style.display = 'inline-block';
        addTrackedListener(debugBtn, 'click', () => {
            showDebugMenu();
        });
    }
    
    // Show pause menu debug button
    const pauseDebugBtn = document.getElementById('pause-debug-btn');
    if (pauseDebugBtn) {
        pauseDebugBtn.style.display = 'inline-block';
        addTrackedListener(pauseDebugBtn, 'click', (e) => {
            e.stopPropagation();
            showDebugMenu();
        });
    }
    
    // Set up debug controls
    setupDebugControls();
}

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
    
    // Test feedback connection
    const testFeedbackBtn = document.getElementById('debug-test-feedback');
    const feedbackStatusEl = document.getElementById('debug-feedback-status');
    if (testFeedbackBtn) {
        addTrackedListener(testFeedbackBtn, 'click', async () => {
            testFeedbackBtn.disabled = true;
            testFeedbackBtn.textContent = 'Testing...';
            if (feedbackStatusEl) feedbackStatusEl.textContent = '';
            
            const result = await testFeedbackConnection();
            
            testFeedbackBtn.disabled = false;
            testFeedbackBtn.textContent = 'Test Connection';
            
            if (feedbackStatusEl) {
                feedbackStatusEl.textContent = result.message;
                feedbackStatusEl.style.color = result.success ? '#44ff44' : '#ff4444';
            }
        });
    }

    // ==================== TUNING SLIDERS ====================
    function clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
    }

    function bindSlider(sliderId, valueId, { getValue, setValue, min, max, format }) {
        const slider = document.getElementById(sliderId);
        const valueEl = document.getElementById(valueId);
        if (!slider) return;

        const write = () => {
            const v = getValue();
            slider.value = String(v);
            if (valueEl) valueEl.textContent = format(v);
        };

        // Init
        write();

        // Live update
        slider.addEventListener('input', () => {
            const raw = Number(slider.value);
            const v = clamp(raw, min, max);
            setValue(v);
            if (valueEl) valueEl.textContent = format(v);
            log('DEBUG', 'tuning_changed', { key: sliderId, value: v });
        });

        return write;
    }

    const writeSpawnRate = bindSlider('debug-tuning-spawn-rate', 'debug-tuning-spawn-rate-value', {
        getValue: () => Number(TUNING.spawnRateMultiplier || 1.0).toFixed(2),
        setValue: (v) => (TUNING.spawnRateMultiplier = v),
        min: 0.25,
        max: 3.0,
        format: (v) => `${Number(v).toFixed(2)}x`
    });

    const writeEnemySpeed = bindSlider('debug-tuning-enemy-speed', 'debug-tuning-enemy-speed-value', {
        getValue: () => Number(TUNING.enemySpeedMultiplier || 1.0).toFixed(2),
        setValue: (v) => (TUNING.enemySpeedMultiplier = v),
        min: 0.25,
        max: 3.0,
        format: (v) => `${Number(v).toFixed(2)}x`
    });

    const writeGravity = bindSlider('debug-tuning-gravity', 'debug-tuning-gravity-value', {
        getValue: () => Number(TUNING.gravityMultiplier || 1.0).toFixed(2),
        setValue: (v) => (TUNING.gravityMultiplier = v),
        min: 0.25,
        max: 3.0,
        format: (v) => `${Number(v).toFixed(2)}x`
    });

    const writeBreathingRoom = bindSlider('debug-tuning-breathing-room', 'debug-tuning-breathing-room-value', {
        getValue: () => Number(TUNING.breathingRoomSeconds ?? 1.5).toFixed(2),
        setValue: (v) => (TUNING.breathingRoomSeconds = Number(v)),
        min: 0,
        max: 10,
        format: (v) => `${Number(v).toFixed(2)}s`
    });

    const writeStressThreshold = bindSlider('debug-tuning-stress-threshold', 'debug-tuning-stress-threshold-value', {
        getValue: () => Math.round(Number(TUNING.stressPauseThreshold ?? 6)),
        setValue: (v) => (TUNING.stressPauseThreshold = Math.round(v)),
        min: 3,
        max: 12,
        format: (v) => `${Math.round(v)}`
    });

    const writeLandingStun = bindSlider('debug-tuning-landing-stun', 'debug-tuning-landing-stun-value', {
        getValue: () => Math.round(Number(TUNING.landingStunFrames ?? 0)),
        setValue: (v) => (TUNING.landingStunFrames = Math.round(v)),
        min: 0,
        max: 30,
        format: (v) => `${Math.round(v)}f`
    });

    const writeFireRateEff = bindSlider('debug-tuning-fire-rate-eff', 'debug-tuning-fire-rate-eff-value', {
        getValue: () => Number(TUNING.fireRateEffectiveness ?? 1.0).toFixed(2),
        setValue: (v) => (TUNING.fireRateEffectiveness = Number(v)),
        min: 0.5,
        max: 2.0,
        format: (v) => `${Number(v).toFixed(2)}x`
    });

    const writeBossHp = bindSlider('debug-tuning-boss-hp', 'debug-tuning-boss-hp-value', {
        getValue: () => Number(TUNING.bossHealthMultiplier ?? 1.0).toFixed(2),
        setValue: (v) => (TUNING.bossHealthMultiplier = Number(v)),
        min: 0.25,
        max: 3.0,
        format: (v) => `${Number(v).toFixed(2)}x`
    });

    const writeBossDmg = bindSlider('debug-tuning-boss-dmg', 'debug-tuning-boss-dmg-value', {
        getValue: () => Number(TUNING.bossDamageMultiplier ?? 1.0).toFixed(2),
        setValue: (v) => (TUNING.bossDamageMultiplier = Number(v)),
        min: 0.25,
        max: 3.0,
        format: (v) => `${Number(v).toFixed(2)}x`
    });

    const writeSpawnSafeRadius = bindSlider('debug-tuning-spawn-safe-radius', 'debug-tuning-spawn-safe-radius-value', {
        getValue: () => Math.round(Number(TUNING.spawnSafeZoneRadius ?? 0)),
        setValue: (v) => (TUNING.spawnSafeZoneRadius = Math.round(v)),
        min: 0,
        max: 30,
        format: (v) => `${Math.round(v)}u`
    });

    const writeTelegraphMult = bindSlider('debug-tuning-telegraph-mult', 'debug-tuning-telegraph-mult-value', {
        getValue: () => Number(TUNING.telegraphDurationMult ?? 1.0).toFixed(2),
        setValue: (v) => (TUNING.telegraphDurationMult = Number(v)),
        min: 0.5,
        max: 2.0,
        format: (v) => `${Number(v).toFixed(2)}x`
    });

    // ==================== UX LEVER TOGGLES ====================
    function bindToggle(btnId, { getValue, setValue, labelOn, labelOff }) {
        const btn = document.getElementById(btnId);
        if (!btn) return null;

        const write = () => {
            const enabled = !!getValue();
            btn.textContent = enabled ? labelOn : labelOff;
        };

        write();
        btn.addEventListener('click', () => {
            const next = !getValue();
            setValue(next);
            write();
            log('DEBUG', 'toggle_changed', { key: btnId, value: next });
        });

        return write;
    }

    const writeTutorialHints = bindToggle('debug-toggle-tutorial-hints', {
        getValue: () => !!TUNING.tutorialHintsEnabled,
        setValue: (v) => (TUNING.tutorialHintsEnabled = !!v),
        labelOn: 'Tutorial Hints: ON',
        labelOff: 'Tutorial Hints: OFF'
    });

    const writeSpawnWarning = bindToggle('debug-toggle-spawn-warning', {
        getValue: () => !!TUNING.offScreenWarningEnabled,
        setValue: (v) => (TUNING.offScreenWarningEnabled = !!v),
        labelOn: 'Spawn Warning: ON',
        labelOff: 'Spawn Warning: OFF'
    });

    const writeRetreatAnnounce = bindToggle('debug-toggle-retreat-announce', {
        getValue: () => !!TUNING.retreatAnnouncementEnabled,
        setValue: (v) => (TUNING.retreatAnnouncementEnabled = !!v),
        labelOn: 'Retreat Banner: ON',
        labelOff: 'Retreat Banner: OFF'
    });

    // ==================== FEATURE TOGGLES (DEBUG) ====================
    const writeDifficulty = bindSlider('debug-tuning-difficulty', 'debug-tuning-difficulty-value', {
        getValue: () => Number(TUNING.difficultyMultiplier ?? 1.0).toFixed(2),
        setValue: (v) => (TUNING.difficultyMultiplier = Number(v)),
        min: 0.5,
        max: 2.0,
        format: (v) => `${Number(v).toFixed(2)}x`
    });

    const writeStartingLives = bindSlider('debug-tuning-lives', 'debug-tuning-lives-value', {
        getValue: () => Math.round(Number(TUNING.playerStartingLives ?? 1)),
        setValue: (v) => (TUNING.playerStartingLives = Math.round(v)),
        min: 1,
        max: 9,
        format: (v) => `${Math.round(v)}`
    });

    const writeEliteChance = bindSlider('debug-tuning-elite-chance', 'debug-tuning-elite-chance-value', {
        getValue: () => Number(TUNING.eliteSpawnChance ?? 0).toFixed(2),
        setValue: (v) => (TUNING.eliteSpawnChance = Number(v)),
        min: 0,
        max: 0.5,
        format: (v) => `${Math.round(Number(v) * 100)}%`
    });

    const writeBossRush = bindToggle('debug-toggle-boss-rush', {
        getValue: () => !!TUNING.bossRushEnabled,
        setValue: (v) => (TUNING.bossRushEnabled = !!v),
        labelOn: 'Boss Rush: ON',
        labelOff: 'Boss Rush: OFF'
    });

    const writeAttackCone = bindToggle('debug-toggle-attack-cone', {
        getValue: () => !!TUNING.attackConePreviewEnabled,
        setValue: (v) => (TUNING.attackConePreviewEnabled = !!v),
        labelOn: 'Attack Cone: ON',
        labelOff: 'Attack Cone: OFF'
    });

    const resetTuningBtn = document.getElementById('debug-tuning-reset');
    if (resetTuningBtn) {
        resetTuningBtn.addEventListener('click', () => {
            TUNING.spawnRateMultiplier = 1.0;
            TUNING.enemySpeedMultiplier = 1.0;
            TUNING.gravityMultiplier = 1.0;
            TUNING.breathingRoomSeconds = 1.5;
            TUNING.stressPauseThreshold = 6;
            TUNING.landingStunFrames = 0;
            TUNING.fireRateEffectiveness = 1.0;
            TUNING.bossHealthMultiplier = 1.0;
            TUNING.bossDamageMultiplier = 1.0;
            TUNING.spawnSafeZoneRadius = 0;
            TUNING.telegraphDurationMult = 1.0;
            TUNING.tutorialHintsEnabled = false;
            TUNING.offScreenWarningEnabled = false;
            TUNING.retreatAnnouncementEnabled = false;
            TUNING.playerStartingLives = 1;
            TUNING.difficultyMultiplier = 1.0;
            TUNING.eliteSpawnChance = 0;
            TUNING.bossRushEnabled = false;
            TUNING.attackConePreviewEnabled = true;

            // Refresh UI from current tuning values
            if (writeSpawnRate) writeSpawnRate();
            if (writeEnemySpeed) writeEnemySpeed();
            if (writeGravity) writeGravity();
            if (writeBreathingRoom) writeBreathingRoom();
            if (writeStressThreshold) writeStressThreshold();
            if (writeLandingStun) writeLandingStun();
            if (writeFireRateEff) writeFireRateEff();
            if (writeBossHp) writeBossHp();
            if (writeBossDmg) writeBossDmg();
            if (writeSpawnSafeRadius) writeSpawnSafeRadius();
            if (writeTelegraphMult) writeTelegraphMult();
            if (writeTutorialHints) writeTutorialHints();
            if (writeSpawnWarning) writeSpawnWarning();
            if (writeRetreatAnnounce) writeRetreatAnnounce();
            if (writeDifficulty) writeDifficulty();
            if (writeStartingLives) writeStartingLives();
            if (writeEliteChance) writeEliteChance();
            if (writeBossRush) writeBossRush();
            if (writeAttackCone) writeAttackCone();

            log('DEBUG', 'tuning_reset', { ...TUNING });
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
    setGameStartTime(0);
    
    PulseMusic.stopMenuMusic();
    PulseMusic.resume();
    PulseMusic.onArenaChange(1);
    PulseMusic.startMusicLoop();
    
    updateUI();
    animate();
    
    log('DEBUG', 'empty_arena_started', {});
}

function debugSpawnEnemy(enemyType) {
    if (!gameState.running) {
        log('DEBUG', 'spawn_failed', { reason: 'game_not_running' });
        return;
    }
    
    // Spawn enemy at random position around player
    const angle = Math.random() * Math.PI * 2;
    const distance = 10 + Math.random() * 10;
    const x = player.position.x + Math.cos(angle) * distance;
    const z = player.position.z + Math.sin(angle) * distance;
    
    spawnSpecificEnemy(enemyType, x, 1, z);
    log('DEBUG', 'enemy_spawned', { type: enemyType, x: x.toFixed(1), z: z.toFixed(1) });
}

function debugWarpToArenaWave(arena, wave) {
    if (!gameState.running) {
        log('DEBUG', 'warp_failed', { reason: 'game_not_running' });
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
    log('DEBUG', 'warp_to', { arena, wave });
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
    
    log('DEBUG', 'boss_started', { bossNum });
}

// Legacy alias for compatibility
function debugSpawnBoss(bossNum) {
    startBossBattle(bossNum);
}

function debugGiveLevels(count) {
    if (!gameState.running) {
        log('DEBUG', 'give_levels_failed', { reason: 'game_not_running' });
        return;
    }

    applyBaselineLevelScaling(count);
    updateUI();
    log('DEBUG', 'levels_given', { count, newLevel: gameState.level });
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
    
    log('DEBUG', 'invincibility_toggled', { enabled: gameState.debug.invincible });
}

function debugFullHeal() {
    if (!gameState.running) {
        log('DEBUG', 'heal_failed', { reason: 'game_not_running' });
        return;
    }
    
    gameState.health = gameState.maxHealth;
    updateUI();
    log('DEBUG', 'full_heal', {});
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
    
    log('DEBUG', 'all_unlocked', {});
}

window.onload = init;
