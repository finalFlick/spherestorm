// Underwater Arena Ambience System
// Creates atmospheric underwater effects: bubbles, kelp, distant fish
// Purely visual - no gameplay impact, no collision

import { scene } from '../core/scene.js';
import { gameState } from '../core/gameState.js';
import { AMBIENCE_CONFIG } from '../config/constants.js';

// Object pools (pre-allocated, reused)
const bubblePool = [];
const fishPool = [];
const kelpArray = [];

// Shared geometries (created once, reused)
let bubbleGeometry = null;
let fishGeometry = null;

let initialized = false;
let bubbleSpawnAccumulator = 0;

// ==================== INITIALIZATION ====================

export function initAmbience() {
    if (!AMBIENCE_CONFIG.enabled) return;
    
    // Clean up any previous ambience first
    cleanupAmbience();
    
    // Initialize each system
    initBubblePool();
    initKelp();
    initFishPool();
    
    initialized = true;
}

// ==================== UPDATE ====================

export function updateAmbience() {
    if (!initialized) return;
    if (!gameState.settings?.ambienceEnabled) return;
    
    updateBubbles();
    updateKelp();
    updateFish();
}

// ==================== CLEANUP ====================

export function cleanupAmbience() {
    // Cleanup bubbles
    bubblePool.forEach(bubble => {
        if (bubble.parent) scene.remove(bubble);
        if (bubble.material) bubble.material.dispose();
    });
    bubblePool.length = 0;
    
    // Cleanup fish
    fishPool.forEach(fish => {
        if (fish.parent) scene.remove(fish);
        if (fish.material) fish.material.dispose();
    });
    fishPool.length = 0;
    
    // Cleanup kelp
    kelpArray.forEach(kelp => {
        if (kelp.parent) scene.remove(kelp);
        kelp.traverse(child => {
            if (child.material) child.material.dispose();
            if (child.geometry) child.geometry.dispose();
        });
    });
    kelpArray.length = 0;
    
    // Dispose shared geometries
    if (bubbleGeometry) {
        bubbleGeometry.dispose();
        bubbleGeometry = null;
    }
    if (fishGeometry) {
        fishGeometry.dispose();
        fishGeometry = null;
    }
    
    initialized = false;
    bubbleSpawnAccumulator = 0;
}

// ==================== BUBBLE SYSTEM ====================

function initBubblePool() {
    if (!gameState.settings?.ambienceBubbles) return;
    
    const cfg = AMBIENCE_CONFIG.bubbles;
    
    // Create shared geometry (small sphere)
    bubbleGeometry = new THREE.SphereGeometry(0.1, 6, 6);
    
    // Pre-allocate bubble pool
    for (let i = 0; i < cfg.maxCount; i++) {
        const mat = new THREE.MeshBasicMaterial({
            color: cfg.color,
            transparent: true,
            opacity: 0
        });
        const bubble = new THREE.Mesh(bubbleGeometry, mat);
        bubble.visible = false;
        bubble.userData = {
            active: false,
            life: 0,
            maxLife: 0,
            phase: Math.random() * Math.PI * 2,  // Random wobble phase
            riseSpeed: 0,
            baseX: 0,
            baseZ: 0,
            targetOpacity: 0
        };
        scene.add(bubble);
        bubblePool.push(bubble);
    }
}

function updateBubbles() {
    if (!gameState.settings?.ambienceBubbles) return;
    
    const cfg = AMBIENCE_CONFIG.bubbles;
    
    // Spawn new bubbles based on spawn rate
    bubbleSpawnAccumulator += cfg.spawnRate;
    while (bubbleSpawnAccumulator >= 1) {
        bubbleSpawnAccumulator -= 1;
        spawnBubble();
    }
    
    // Update active bubbles
    for (const bubble of bubblePool) {
        if (!bubble.userData.active) continue;
        
        const data = bubble.userData;
        data.life--;
        
        // Calculate lifetime progress (0 to 1)
        const progress = 1 - (data.life / data.maxLife);
        
        // Rise upward
        bubble.position.y += data.riseSpeed;
        
        // Wobble horizontally (sine wave)
        data.phase += 0.05;
        const wobble = Math.sin(data.phase) * cfg.wobbleIntensity;
        bubble.position.x = data.baseX + wobble;
        bubble.position.z = data.baseZ + Math.cos(data.phase * 0.7) * cfg.wobbleIntensity;
        
        // Fade in/out based on lifetime
        let opacity;
        if (progress < 0.2) {
            // Fade in (first 20%)
            opacity = (progress / 0.2) * data.targetOpacity;
        } else if (progress > 0.8) {
            // Fade out (last 20%)
            opacity = ((1 - progress) / 0.2) * data.targetOpacity;
        } else {
            opacity = data.targetOpacity;
        }
        bubble.material.opacity = opacity;
        
        // Recycle when dead
        if (data.life <= 0) {
            data.active = false;
            bubble.visible = false;
        }
    }
}

function spawnBubble() {
    const cfg = AMBIENCE_CONFIG.bubbles;
    
    // Find inactive bubble in pool
    const bubble = bubblePool.find(b => !b.userData.active);
    if (!bubble) return;  // Pool exhausted
    
    // Random position near arena edges (avoid center safe zone)
    const angle = Math.random() * Math.PI * 2;
    const radius = cfg.spawnRadius.min + Math.random() * (cfg.spawnRadius.max - cfg.spawnRadius.min);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = 0.1;  // Start near ground
    
    // Random properties
    const lifetime = cfg.lifetime.min + Math.random() * (cfg.lifetime.max - cfg.lifetime.min);
    const size = cfg.size.min + Math.random() * (cfg.size.max - cfg.size.min);
    const opacity = cfg.opacity.min + Math.random() * (cfg.opacity.max - cfg.opacity.min);
    const riseSpeed = cfg.riseSpeed.min + Math.random() * (cfg.riseSpeed.max - cfg.riseSpeed.min);
    
    // Set bubble state
    bubble.position.set(x, y, z);
    bubble.scale.setScalar(size / 0.1);  // Scale relative to base geometry
    bubble.visible = true;
    bubble.material.opacity = 0;
    
    const data = bubble.userData;
    data.active = true;
    data.life = lifetime;
    data.maxLife = lifetime;
    data.phase = Math.random() * Math.PI * 2;
    data.riseSpeed = riseSpeed;
    data.baseX = x;
    data.baseZ = z;
    data.targetOpacity = opacity;
}

// ==================== KELP SYSTEM ====================

function initKelp() {
    if (!gameState.settings?.ambienceKelp) return;
    
    const cfg = AMBIENCE_CONFIG.kelp;
    
    for (let i = 0; i < cfg.countPerArena; i++) {
        // Distribute kelp evenly around perimeter
        const angle = (i / cfg.countPerArena) * Math.PI * 2;
        // Add some randomness to placement
        const angleOffset = (Math.random() - 0.5) * (Math.PI * 2 / cfg.countPerArena) * 0.5;
        const finalAngle = angle + angleOffset;
        
        const radius = cfg.placementRadius.min + 
            Math.random() * (cfg.placementRadius.max - cfg.placementRadius.min);
        
        const kelp = createKelpMesh(cfg);
        kelp.position.set(
            Math.cos(finalAngle) * radius,
            0,
            Math.sin(finalAngle) * radius
        );
        
        // Random initial rotation to face different directions
        kelp.rotation.y = Math.random() * Math.PI * 2;
        
        kelp.userData = { 
            swayPhase: Math.random() * Math.PI * 2,
            baseRotationZ: 0
        };
        
        scene.add(kelp);
        kelpArray.push(kelp);
    }
}

function createKelpMesh(cfg) {
    const group = new THREE.Group();
    const height = cfg.height.min + Math.random() * (cfg.height.max - cfg.height.min);
    const segments = 3 + Math.floor(Math.random() * 2);  // 3-4 segments
    
    const segHeight = height / segments;
    const baseWidth = 0.3;
    
    for (let i = 0; i < segments; i++) {
        // Segments get narrower toward top
        const widthScale = 1 - (i / segments) * 0.4;
        const geom = new THREE.BoxGeometry(baseWidth * widthScale, segHeight, 0.15 * widthScale);
        const mat = new THREE.MeshBasicMaterial({
            color: cfg.color,
            transparent: true,
            opacity: cfg.opacity
        });
        const seg = new THREE.Mesh(geom, mat);
        seg.position.y = i * segHeight + segHeight / 2;
        
        // Slight random tilt per segment for organic look
        seg.rotation.z = (Math.random() - 0.5) * 0.1;
        
        group.add(seg);
    }
    
    return group;
}

function updateKelp() {
    if (!gameState.settings?.ambienceKelp) return;
    
    const cfg = AMBIENCE_CONFIG.kelp;
    
    for (const kelp of kelpArray) {
        const data = kelp.userData;
        
        // Gentle sway animation
        data.swayPhase += cfg.swaySpeed;
        const sway = Math.sin(data.swayPhase) * cfg.swayIntensity;
        
        // Apply sway as rotation at base
        kelp.rotation.z = data.baseRotationZ + sway;
        
        // Slight secondary sway for organic feel
        kelp.rotation.x = Math.sin(data.swayPhase * 0.7) * cfg.swayIntensity * 0.3;
    }
}

// ==================== FISH SYSTEM ====================

function initFishPool() {
    if (!gameState.settings?.ambienceFish) return;
    
    const cfg = AMBIENCE_CONFIG.fish;
    
    // Create shared fish geometry (elongated ellipsoid)
    fishGeometry = new THREE.SphereGeometry(0.5, 8, 4);
    // Scale to fish shape (long, thin)
    fishGeometry.scale(2, 1, 0.5);
    
    for (let i = 0; i < cfg.maxCount; i++) {
        const size = cfg.size.min + Math.random() * (cfg.size.max - cfg.size.min);
        
        const mat = new THREE.MeshBasicMaterial({
            color: cfg.color,
            transparent: true,
            opacity: cfg.opacity
        });
        const fish = new THREE.Mesh(fishGeometry, mat);
        
        // Position beyond arena walls (distant background)
        const angle = Math.random() * Math.PI * 2;
        const radius = cfg.distanceRadius.min + 
            Math.random() * (cfg.distanceRadius.max - cfg.distanceRadius.min);
        const height = cfg.height.min + Math.random() * (cfg.height.max - cfg.height.min);
        
        fish.position.set(
            Math.cos(angle) * radius,
            height,
            Math.sin(angle) * radius
        );
        
        fish.scale.setScalar(size);
        
        // Store movement data
        fish.userData = {
            angle: angle,
            radius: radius,
            height: height,
            speed: cfg.speed.min + Math.random() * (cfg.speed.max - cfg.speed.min),
            verticalPhase: Math.random() * Math.PI * 2,
            verticalSpeed: 0.01 + Math.random() * 0.01
        };
        
        // Face tangent direction (swimming around arena)
        updateFishRotation(fish);
        
        scene.add(fish);
        fishPool.push(fish);
    }
}

function updateFish() {
    if (!gameState.settings?.ambienceFish) return;
    
    const cfg = AMBIENCE_CONFIG.fish;
    
    for (const fish of fishPool) {
        const data = fish.userData;
        
        // Orbit around arena center
        data.angle += data.speed;
        
        // Update position
        fish.position.x = Math.cos(data.angle) * data.radius;
        fish.position.z = Math.sin(data.angle) * data.radius;
        
        // Gentle vertical bobbing
        data.verticalPhase += data.verticalSpeed;
        fish.position.y = data.height + Math.sin(data.verticalPhase) * 0.5;
        
        // Update rotation to face swimming direction
        updateFishRotation(fish);
    }
}

function updateFishRotation(fish) {
    const data = fish.userData;
    
    // Fish face the direction they're swimming (tangent to orbit)
    const tangentAngle = data.angle + Math.PI / 2;  // 90 degrees ahead
    fish.rotation.y = tangentAngle;
}

// ==================== UTILITY ====================

export function isAmbienceEnabled() {
    return initialized && gameState.settings?.ambienceEnabled;
}

export function toggleAmbience(enabled) {
    if (gameState.settings) {
        gameState.settings.ambienceEnabled = enabled;
    }
}
