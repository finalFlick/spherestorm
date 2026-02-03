import { gameState } from '../core/gameState.js';
import { DAMAGE_COOLDOWN, DEATH_TIPS } from '../config/constants.js';
import { PulseMusic } from './pulseMusic.js';
import { cameraAngleX } from '../core/input.js';
import { safeFlashMaterial } from './materialUtils.js';

// Hit recovery constants
const RECOVERY_DURATION = 90;  // 1.5 seconds at 60fps
const KNOCKBACK_STRENGTH = 0.3;

// Frame-based collision damage cooldown (replaces Date.now() for pause safety)
export let damageCooldownFrames = 0;
const DAMAGE_COOLDOWN_FRAMES = 30;  // 500ms at 60fps (matches DAMAGE_COOLDOWN)

// Legacy timestamp export kept for backwards compatibility (UI logging only)
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

// Frame-based damage cooldown functions
export function tickDamageCooldown() {
    if (damageCooldownFrames > 0) {
        damageCooldownFrames--;
    }
}

export function canTakeCollisionDamage() {
    return damageCooldownFrames <= 0;
}

export function resetDamageCooldown() {
    damageCooldownFrames = DAMAGE_COOLDOWN_FRAMES;
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

export function takeDamage(amount, source = 'Unknown', sourceType = 'enemy', sourcePosition = null) {
    // Skip damage if debug invincibility is enabled
    if (gameState.debug && gameState.debug.invincible) {
        return;
    }
    
    // Skip damage during cutscenes (boss intro/phase transitions)
    if (gameState.cutsceneActive || gameState.cutsceneInvincible) {
        return;
    }
    
    // Skip damage if player is in recovery (invulnerability frames)
    if (playerRef && playerRef.isRecovering) {
        return;
    }
    
    gameState.health -= amount;
    
    // Apply knockback and start recovery state
    if (playerRef) {
        // Calculate knockback direction
        let knockbackX, knockbackZ;
        if (sourcePosition) {
            // Knockback away from damage source
            const dx = playerRef.position.x - sourcePosition.x;
            const dz = playerRef.position.z - sourcePosition.z;
            const dist = Math.sqrt(dx * dx + dz * dz) || 1;
            knockbackX = (dx / dist) * KNOCKBACK_STRENGTH;
            knockbackZ = (dz / dist) * KNOCKBACK_STRENGTH;
        } else {
            // Default knockback: backward from player facing direction
            knockbackX = Math.sin(cameraAngleX) * KNOCKBACK_STRENGTH;
            knockbackZ = Math.cos(cameraAngleX) * KNOCKBACK_STRENGTH;
        }
        
        // Apply knockback velocity
        playerRef.velocity.x = knockbackX;
        playerRef.velocity.z = knockbackZ;
        
        // Start recovery state (invulnerability frames)
        playerRef.isRecovering = true;
        playerRef.recoveryTimer = RECOVERY_DURATION;
        playerRef.flashPhase = 0;
    }
    
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
    if (flash) {
        flash.style.opacity = '1';
        setTimeout(() => flash.style.opacity = '0', 100);
    }
    
    // Play damage music stinger
    PulseMusic.onPlayerDamage(gameState.health / gameState.maxHealth);
    
    if (playerRef && playerRef.bodyMaterial) {
        safeFlashMaterial(playerRef.bodyMaterial, playerRef, 0xff0000, 0x224488, 0.3, DAMAGE_COOLDOWN);
    }
    
    if (gameState.health <= 0) {
        gameState.health = 0;
        // Game over will be triggered by main loop checking health
    }
}

export function resetDamageTime() {
    lastDamageTime = 0;
    damageCooldownFrames = 0;  // Also reset frame-based cooldown
}
