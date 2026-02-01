// Material utility functions - reduces code duplication for common material operations

/**
 * Safely flash a material's emissive property with automatic reset.
 * Guards against disposed/null materials during the reset callback.
 * 
 * @param {THREE.Material} material - The material to flash
 * @param {Object} owner - The mesh/object that owns the material (for disposal check)
 * @param {number} flashColor - Hex color for the flash (e.g., 0xffffff)
 * @param {number} resetColor - Hex color to reset to after flash
 * @param {number} resetIntensity - Emissive intensity to reset to (default: 0.3)
 * @param {number} duration - Flash duration in milliseconds (default: 50)
 */
export function safeFlashMaterial(material, owner, flashColor, resetColor, resetIntensity = 0.3, duration = 50) {
    if (!material || !material.emissive) return;
    
    // Apply flash
    material.emissive.setHex(flashColor);
    material.emissiveIntensity = 1;
    
    // Capture references to avoid stale closure issues
    const matCapture = material;
    const ownerCapture = owner;
    
    setTimeout(() => {
        // Guard: owner may have been killed/removed/disposed during flash
        if (ownerCapture && 
            ownerCapture.parent && 
            matCapture && 
            matCapture.emissive &&
            !matCapture.disposed) {
            try {
                matCapture.emissive.setHex(resetColor);
                matCapture.emissiveIntensity = resetIntensity;
            } catch (e) {
                // Material disposed during callback - safely ignore
            }
        }
    }, duration);
}
