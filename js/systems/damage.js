import { gameState } from '../core/gameState.js';
import { DAMAGE_COOLDOWN, DEATH_TIPS } from '../config/constants.js';
import { PulseMusic } from './pulseMusic.js';

export let lastDamageTime = 0;
let playerRef = null;

// Damage logging for death feedback
const damageLog = [];
const MAX_LOG_ENTRIES = 10;

export function setPlayerRef(player) {
    playerRef = player;
}

export function setLastDamageTime(time) {
    lastDamageTime = time;
}

// Get recent damage for death recap
export function getRecentDamage(count = 5) {
    return damageLog.slice(-count);
}

// Clear damage log (on new game)
export function clearDamageLog() {
    damageLog.length = 0;
}

// Get death tip based on killing blow
export function getDeathTip(source) {
    if (!source) return null;
    const sourceLower = source.toLowerCase();
    
    for (const [key, tip] of Object.entries(DEATH_TIPS)) {
        if (sourceLower.includes(key.toLowerCase())) {
            return tip;
        }
    }
    return 'Keep moving and stay alert!';
}

export function takeDamage(amount, source = 'Unknown', sourceType = 'enemy') {
    // Skip damage if debug invincibility is enabled
    if (gameState.debug && gameState.debug.invincible) {
        return;
    }
    
    gameState.health -= amount;
    
    // Log damage for death feedback
    damageLog.push({
        amount: Math.round(amount),
        source,
        sourceType,
        timestamp: Date.now(),
        healthAfter: Math.max(0, gameState.health)
    });
    
    // Keep log size bounded
    if (damageLog.length > MAX_LOG_ENTRIES) {
        damageLog.shift();
    }
    
    // Track total damage taken for combat stats
    if (!gameState.combatStats) {
        gameState.combatStats = { damageTaken: 0, damageDealt: 0, kills: {}, waveDamageTaken: 0 };
    }
    gameState.combatStats.damageTaken += amount;
    gameState.combatStats.waveDamageTaken = (gameState.combatStats.waveDamageTaken || 0) + amount;
    
    const flash = document.getElementById('damage-flash');
    flash.style.opacity = '1';
    setTimeout(() => flash.style.opacity = '0', 100);
    
    // Play damage music stinger
    PulseMusic.onPlayerDamage(gameState.health / gameState.maxHealth);
    
    if (playerRef && playerRef.bodyMaterial) {
        playerRef.bodyMaterial.emissive.setHex(0xff0000);
        playerRef.bodyMaterial.emissiveIntensity = 1;
        
        // Capture references at callback creation time to avoid stale reference issues
        const playerRefCapture = playerRef;
        const materialCapture = playerRef.bodyMaterial;
        setTimeout(() => {
            // Guard against null/disposed player after game reset
            // Check: 1) player still exists, 2) still in scene, 3) material not disposed
            if (playerRefCapture && 
                playerRefCapture.parent && 
                materialCapture && 
                materialCapture.emissive &&
                !materialCapture.disposed) {
                try {
                    materialCapture.emissive.setHex(0x224488);
                    materialCapture.emissiveIntensity = 0.3;
                } catch (e) {
                    // Player may have been disposed during callback - safely ignore
                }
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
