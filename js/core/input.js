import { gameState } from './gameState.js';
import { PulseMusic } from '../systems/pulseMusic.js';
import { skipCurrentCutscene } from '../entities/boss.js';

// Input state
export const keys = {};
export let cameraAngleX = 0;
export let cameraAngleY = 0.3;
export let isPointerLocked = false;
let skipNextMouseMove = false; // Skip first mouse event after pointer lock to prevent camera jump
let cutsceneSkipHoldTime = 0;  // Track how long skip key has been held
const CUTSCENE_SKIP_HOLD_DURATION = 30;  // Half second hold to skip (30 frames at 60fps)

export function setCameraAngleX(value) {
    cameraAngleX = value;
}

export function setCameraAngleY(value) {
    cameraAngleY = value;
}

export function setPointerLocked(value) {
    isPointerLocked = value;
}

// Track event listeners for cleanup
let cleanupFunctions = [];

export function cleanupInput() {
    cleanupFunctions.forEach(fn => fn());
    cleanupFunctions = [];
}

export function initInput(rendererElement) {
    const keydownHandler = (e) => {
        keys[e.code] = true;
    };
    document.addEventListener('keydown', keydownHandler);
    cleanupFunctions.push(() => document.removeEventListener('keydown', keydownHandler));
    
    const keyupHandler = (e) => {
        keys[e.code] = false;
    };
    document.addEventListener('keyup', keyupHandler);
    cleanupFunctions.push(() => document.removeEventListener('keyup', keyupHandler));
    
    document.addEventListener('mousemove', onMouseMove);
    cleanupFunctions.push(() => document.removeEventListener('mousemove', onMouseMove));
    
    const clickHandler = () => {
        // Don't request pointer lock if debug menu is open
        const debugScreen = document.getElementById('debug-screen');
        if (debugScreen && debugScreen.style.display === 'flex') {
            return; // Debug menu is open, don't resume
        }
        
        if (gameState.running && !isPointerLocked) {
            // Request pointer lock with error handling for cancelled requests
            rendererElement.requestPointerLock().catch(err => {
                // Silently handle pointer lock errors (user may have clicked UI or exited lock)
                if (err.name !== 'SecurityError') {
                    console.warn('Pointer lock request failed:', err);
                }
            });
        }
    };
    document.addEventListener('click', clickHandler);
    cleanupFunctions.push(() => document.removeEventListener('click', clickHandler));
    
    const pointerLockHandler = () => {
        isPointerLocked = document.pointerLockElement === rendererElement;
        const pauseIndicator = document.getElementById('pause-indicator');
        const upgradeMenu = document.getElementById('upgrade-menu');
        const gameOverScreen = document.getElementById('game-over');
        
        // Skip first mouse event after pointer lock to prevent camera jump
        if (isPointerLocked) {
            skipNextMouseMove = true;
        }
        
        if (gameState.running && 
            upgradeMenu.style.display !== 'block' && 
            gameOverScreen.style.display !== 'block') {
            gameState.paused = !isPointerLocked;
            pauseIndicator.style.display = isPointerLocked ? 'none' : 'block';
            
            // Pause/unpause music with game
            if (gameState.paused) {
                PulseMusic.pause();
            } else {
                PulseMusic.unpause();
            }
        }
    };
    document.addEventListener('pointerlockchange', pointerLockHandler);
    cleanupFunctions.push(() => document.removeEventListener('pointerlockchange', pointerLockHandler));
}

function onMouseMove(event) {
    if (!isPointerLocked) return;
    
    // Skip first mouse event after pointer lock to prevent camera jump
    if (skipNextMouseMove) {
        skipNextMouseMove = false;
        return;
    }
    
    // Clamp movement to prevent large jumps from spurious events
    const maxMovement = 50;
    const mx = Math.max(-maxMovement, Math.min(maxMovement, event.movementX));
    const my = Math.max(-maxMovement, Math.min(maxMovement, event.movementY));
    
    cameraAngleX -= mx * 0.002;
    cameraAngleY = Math.max(-0.5, Math.min(1, cameraAngleY + my * 0.002));
}

export function resetInput() {
    cameraAngleX = 0;
    cameraAngleY = 0.3;
    cutsceneSkipHoldTime = 0;
    Object.keys(keys).forEach(key => keys[key] = false);
}

/**
 * Check for cutscene skip input (call every frame during cutscene)
 * Returns true if cutscene should be skipped
 */
export function checkCutsceneSkip() {
    if (!gameState.cutsceneActive) {
        cutsceneSkipHoldTime = 0;
        return false;
    }
    
    // Check if skip key is held (Space or Enter)
    if (keys['Space'] || keys['Enter']) {
        cutsceneSkipHoldTime++;
        
        // Show skip hint after brief hold
        if (cutsceneSkipHoldTime === 15) {
            // Could show "Hold to skip..." UI here
        }
        
        // Skip after holding for required duration
        if (cutsceneSkipHoldTime >= CUTSCENE_SKIP_HOLD_DURATION) {
            cutsceneSkipHoldTime = 0;
            skipCurrentCutscene();
            return true;
        }
    } else {
        cutsceneSkipHoldTime = 0;
    }
    
    return false;
}
