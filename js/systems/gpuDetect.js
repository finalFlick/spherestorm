// GPU Detection System
// Detects software rendering and WebGL capabilities for performance warnings

/**
 * Detects GPU and WebGL capabilities
 * @returns {Object} GPU information object
 */
function detectGPU() {
    const canvas = document.createElement('canvas');
    
    const tryCtx = (type, attrs) => {
        try {
            return canvas.getContext(type, attrs);
        } catch {
            return null;
        }
    };
    
    // First: try to avoid major performance caveats (often software rendering)
    const attrs = {
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: true,
        antialias: false,
        alpha: false,
        depth: false,
        stencil: false,
    };
    
    let gl = tryCtx('webgl2', attrs) ||
             tryCtx('webgl', attrs) ||
             tryCtx('experimental-webgl', attrs);
    
    let majorPerformanceCaveat = false;
    
    // If that failed, try again without the caveat flag
    if (!gl) {
        majorPerformanceCaveat = true;
        gl = tryCtx('webgl2') ||
             tryCtx('webgl') ||
             tryCtx('experimental-webgl');
    }
    
    if (!gl) {
        return {
            supported: false,
            vendor: 'N/A',
            renderer: 'WebGL not supported / disabled',
            vendorMasked: 'N/A',
            rendererMasked: 'WebGL not supported',
            isSoftware: true,
            majorPerformanceCaveat: true,
            debugInfoAvailable: false,
            webglVersion: 0,
        };
    }
    
    const webglVersion = (typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext) ? 2 : 1;
    
    // Always available (but may be generic / masked)
    const vendorMasked = gl.getParameter(gl.VENDOR);
    const rendererMasked = gl.getParameter(gl.RENDERER);
    
    let vendor = vendorMasked;
    let renderer = rendererMasked;
    let debugInfoAvailable = false;
    
    // Unmasked info (often unavailable due to privacy / fingerprinting protections)
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
        debugInfoAvailable = true;
        vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    }
    
    // Only match known software renderers (avoid "mesa" blanket match)
    const softwareRe = /swiftshader|llvmpipe|softpipe|software rasterizer|microsoft basic render driver/i;
    const isSoftware = softwareRe.test(renderer) || softwareRe.test(vendor);
    
    return {
        supported: true,
        vendor,
        renderer,
        vendorMasked,
        rendererMasked,
        isSoftware,
        majorPerformanceCaveat,
        debugInfoAvailable,
        webglVersion,
    };
}

// Run detection once on module load and export as singleton
export const gpuInfo = detectGPU();
