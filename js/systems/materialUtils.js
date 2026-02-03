// Material utility functions - reduces code duplication for common material operations

// Frame-based flash queue (replaces setTimeout for pause-safe timing)
const flashQueue = [];

/**
 * Safely flash a material's emissive property with automatic reset.
 * Uses frame-based timing for pause/slow-mo safety.
 * 
 * @param {THREE.Material} material - The material to flash
 * @param {Object} owner - The mesh/object that owns the material (for disposal check)
 * @param {number} flashColor - Hex color for the flash (e.g., 0xffffff)
 * @param {number} resetColor - Hex color to reset to after flash
 * @param {number} resetIntensity - Emissive intensity to reset to (default: 0.3)
 * @param {number} durationMs - Flash duration in milliseconds (default: 50) - converted to frames
 */
export function safeFlashMaterial(material, owner, flashColor, resetColor, resetIntensity = 0.3, durationMs = 50) {
    if (!material || !material.emissive) return;
    
    // Apply flash immediately
    material.emissive.setHex(flashColor);
    material.emissiveIntensity = 1;
    
    // Convert ms to frames (60fps = 16.67ms/frame)
    const durationFrames = Math.max(1, Math.floor(durationMs / 16.67));
    
    // Add to queue for frame-based reset
    flashQueue.push({
        material,
        owner,
        resetColor,
        resetIntensity,
        framesRemaining: durationFrames
    });
}

/**
 * Update flash queue - call once per frame from game loop.
 * Processes frame-based flash resets safely.
 */
export function updateMaterialFlashes() {
    for (let i = flashQueue.length - 1; i >= 0; i--) {
        const flash = flashQueue[i];
        flash.framesRemaining--;
        
        if (flash.framesRemaining <= 0) {
            // Guard: owner may have been killed/removed/disposed during flash
            if (flash.owner && 
                flash.owner.parent && 
                flash.material && 
                flash.material.emissive &&
                !flash.material.disposed) {
                try {
                    flash.material.emissive.setHex(flash.resetColor);
                    flash.material.emissiveIntensity = flash.resetIntensity;
                } catch (e) {
                    // Material disposed during callback - safely ignore
                }
            }
            // Remove from queue
            flashQueue.splice(i, 1);
        }
    }
}

/**
 * Clear flash queue - call on game reset to prevent stale flashes.
 */
export function clearMaterialFlashes() {
    flashQueue.length = 0;
}
