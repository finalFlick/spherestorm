// Main entry point - coordinates all modules
import { gameState, resetGameState } from './core/gameState.js';
import { initScene, createGround, onWindowResize, render, scene, renderer } from './core/scene.js';
import { initInput, resetInput, cameraAngleX, cameraAngleY } from './core/input.js';
import { resetAllEntities } from './core/entities.js';
import { WAVE_STATE, UI_UPDATE_INTERVAL } from './config/constants.js';

import { createPlayer, updatePlayer, resetPlayer, player } from './entities/player.js';
import { updateEnemies } from './entities/enemies.js';
import { updateBoss } from './entities/boss.js';

import { updateWaveSystem } from './systems/waveSystem.js';
import { shootProjectile, updateProjectiles, resetLastShot } from './systems/projectiles.js';
import { updateXpGems, updateHearts } from './systems/pickups.js';
import { resetDamageTime, setPlayerRef } from './systems/damage.js';

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
    setGameStartTime
} from './ui/hud.js';

let lastUIUpdate = 0;

function init() {
    initScene();
    createGround();
    const playerInstance = createPlayer();
    setPlayerRef(playerInstance);
    initTrailPool();
    
    initInput(renderer.domElement);
    window.addEventListener('resize', onWindowResize);
    
    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('restart-btn').addEventListener('click', restartGame);
    
    render();
}

function startGame() {
    hideStartScreen();
    generateArena(1);
    gameState.running = true;
    gameState.waveState = WAVE_STATE.WAVE_INTRO;
    gameState.waveTimer = 0;
    setGameStartTime(Date.now());
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
    
    generateArena(1);
    
    hideGameOver();
    hidePauseIndicator();
    hideBossHealthBar();
    
    gameState.running = true;
    setGameStartTime(Date.now());
    updateUI();
    animate();
}

function gameOver() {
    gameState.running = false;
    document.exitPointerLock();
    showGameOver();
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
