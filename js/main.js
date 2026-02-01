// Main entry point - coordinates all modules
import { gameState, resetGameState } from './core/gameState.js';
import { initScene, createGround, onWindowResize, render, scene, renderer } from './core/scene.js';
import { initInput, resetInput } from './core/input.js';
import { resetAllEntities, enemies, getCurrentBoss } from './core/entities.js';
import { WAVE_STATE, UI_UPDATE_INTERVAL } from './config/constants.js';

import { createPlayer, updatePlayer, resetPlayer, player } from './entities/player.js';
import { updateEnemies } from './entities/enemies.js';
import { updateBoss } from './entities/boss.js';

import { updateWaveSystem } from './systems/waveSystem.js';
import { shootProjectile, updateProjectiles, resetLastShot } from './systems/projectiles.js';
import { updateXpGems, updateHearts } from './systems/pickups.js';
import { resetDamageTime, setPlayerRef } from './systems/damage.js';
import { initBadges, resetActiveBadges, updateStatBadges } from './systems/badges.js';
import { initLeaderboard } from './systems/leaderboard.js';
import { PulseMusic } from './systems/pulseMusic.js';

import { generateArena, updateHazardZones } from './arena/generator.js';

import { initTrailPool, updateTrail, resetTrail } from './effects/trail.js';
import { updateParticles } from './effects/particles.js';

import { 
    updateUI, 
    hideStartScreen, 
    showGameOver, 
    hideGameOver,
    hidePauseIndicator,
    hideBossHealthBar,
    setGameStartTime,
    getElapsedTime,
    updateMasteryDisplay
} from './ui/hud.js';

import {
    showLeaderboard,
    hideLeaderboard,
    showHighScoreEntry,
    checkHighScore,
    showBadgeCollection,
    hideBadgeCollection
} from './ui/leaderboardUI.js';

let lastUIUpdate = 0;

function init() {
    initScene();
    createGround();
    const playerInstance = createPlayer();
    setPlayerRef(playerInstance);
    initTrailPool();
    
    // Initialize persistent systems
    initBadges();
    initLeaderboard();
    PulseMusic.init();
    
    initInput(renderer.domElement);
    window.addEventListener('resize', onWindowResize);
    
    // Music toggle
    window.addEventListener('keydown', (e) => {
        if (e.key === 'm' || e.key === 'M') {
            const enabled = PulseMusic.toggle();
            console.log('[SPHERESTORM] Music:', enabled ? 'ON' : 'OFF');
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
    
    // Update mastery display on start screen
    updateMasteryDisplay();
    
    render();
}

function startGame() {
    hideStartScreen();
    resetActiveBadges();
    generateArena(1);
    gameState.running = true;
    gameState.waveState = WAVE_STATE.WAVE_INTRO;
    gameState.waveTimer = 0;
    setGameStartTime(Date.now());
    
    // Start adaptive music
    PulseMusic.resume();
    PulseMusic.onArenaChange(1);
    PulseMusic.startMusicLoop();
    
    animate();
}

function restartGame() {
    resetGameState();
    resetAllEntities(scene);
    resetTrail();
    resetPlayer();
    resetInput();
    resetLastShot();
    resetDamageTime();
    resetActiveBadges();
    
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

function animate() {
    if (!gameState.running) return;
    requestAnimationFrame(animate);
    
    if (!gameState.paused) {
        updatePlayer(1);
        updateEnemies(1);
        updateBoss();
        updateProjectiles(1);
        updateXpGems(1);
        updateHearts(1);
        updateParticles(1);
        updateTrail();
        updateHazardZones();
        updateWaveSystem();
        shootProjectile();
        
        // Update adaptive music
        PulseMusic.update(gameState, enemies, getCurrentBoss());
        
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
    }
    
    render();
}

// Initialize when DOM is ready
window.onload = init;
