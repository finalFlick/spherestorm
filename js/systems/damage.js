import { gameState } from '../core/gameState.js';
import { DAMAGE_COOLDOWN } from '../config/constants.js';

export let lastDamageTime = 0;
let playerRef = null;

export function setPlayerRef(player) {
    playerRef = player;
}

export function setLastDamageTime(time) {
    lastDamageTime = time;
}

export function takeDamage(amount) {
    gameState.health -= amount;
    
    const flash = document.getElementById('damage-flash');
    flash.style.opacity = '1';
    setTimeout(() => flash.style.opacity = '0', 100);
    
    if (playerRef && playerRef.bodyMaterial) {
        playerRef.bodyMaterial.emissive.setHex(0xff0000);
        playerRef.bodyMaterial.emissiveIntensity = 1;
        setTimeout(() => {
            if (playerRef && playerRef.bodyMaterial) {
                playerRef.bodyMaterial.emissive.setHex(0x224488);
                playerRef.bodyMaterial.emissiveIntensity = 0.3;
            }
        }, DAMAGE_COOLDOWN);
    }
    
    if (gameState.health <= 0) {
        gameState.health = 0;
        // Game over will be triggered by main loop checking health
    }
}

export function resetDamageTime() {
    lastDamageTime = 0;
}
