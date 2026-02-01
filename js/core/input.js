import { gameState } from './gameState.js';

// Input state
export const keys = {};
export let cameraAngleX = 0;
export let cameraAngleY = 0.3;
export let isPointerLocked = false;

export function setCameraAngleX(value) {
    cameraAngleX = value;
}

export function setCameraAngleY(value) {
    cameraAngleY = value;
}

export function setPointerLocked(value) {
    isPointerLocked = value;
}

export function initInput(rendererElement) {
    document.addEventListener('keydown', (e) => {
        keys[e.code] = true;
    });
    
    document.addEventListener('keyup', (e) => {
        keys[e.code] = false;
    });
    
    document.addEventListener('mousemove', onMouseMove);
    
    document.addEventListener('click', () => {
        if (gameState.running && !isPointerLocked) {
            rendererElement.requestPointerLock();
        }
    });
    
    document.addEventListener('pointerlockchange', () => {
        isPointerLocked = document.pointerLockElement === rendererElement;
        const pauseIndicator = document.getElementById('pause-indicator');
        const upgradeMenu = document.getElementById('upgrade-menu');
        const gameOverScreen = document.getElementById('game-over');
        
        if (gameState.running && 
            upgradeMenu.style.display !== 'block' && 
            gameOverScreen.style.display !== 'block') {
            gameState.paused = !isPointerLocked;
            pauseIndicator.style.display = isPointerLocked ? 'none' : 'block';
        }
    });
}

function onMouseMove(event) {
    if (!isPointerLocked) return;
    cameraAngleX -= event.movementX * 0.002;
    cameraAngleY = Math.max(-0.5, Math.min(1, cameraAngleY + event.movementY * 0.002));
}

export function resetInput() {
    cameraAngleX = 0;
    cameraAngleY = 0.3;
    Object.keys(keys).forEach(key => keys[key] = false);
}
