import { scene, camera } from '../core/scene.js';
import { gameState } from '../core/gameState.js';
import { xpGems, hearts, tempVec3, obstacles, modulePickups, chests, getArenaPortal, setArenaPortal, getBossEntrancePortal, setBossEntrancePortal } from '../core/entities.js';
import { player } from '../entities/player.js';
import { HEART_TTL, WAVE_STATE } from '../config/constants.js';
import { spawnParticle } from '../effects/particles.js';
import { levelUp } from '../ui/menus.js';
import { triggerSlowMo, triggerScreenFlash } from './visualFeedback.js';
import { incrementModuleCounter, tryLevelUpModule, getModuleLevel, isModuleUnlocked } from './moduleProgress.js';
import { showModuleUnlockBanner, showUnlockNotification } from '../ui/hud.js';
import { PulseMusic } from './pulseMusic.js';
import { ITEM_CONFIG, PROJECTILE_ITEMS, getActiveCombination } from '../config/items.js';
import { log } from './debugLog.js';

// Get the surface height at a given X/Z position (checks platforms/obstacles)
function getSurfaceHeight(x, z) {
    let maxHeight = 0;  // Floor level
    for (const obs of obstacles) {
        const cd = obs.collisionData;
        if (cd && x >= cd.minX && x <= cd.maxX && z >= cd.minZ && z <= cd.maxZ) {
            maxHeight = Math.max(maxHeight, cd.topY);
        }
    }
    return maxHeight;
}


export function spawnXpGem(position, value) {
    // Guard: don't spawn if value is invalid
    if (!value || value <= 0 || !Number.isFinite(value)) {
        console.warn('[XP] Skipping gem spawn - invalid value:', value, 'at position:', position);
        return;
    }
    
    // Classic XP gem (simple octahedron)
    const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.2, 0),
        new THREE.MeshBasicMaterial({
            color: 0x44ff44,
            transparent: true,
            opacity: 0.9
        })
    );
    
    gem.position.copy(position);
    // Hover above the surface at spawn position
    const surfaceHeight = getSurfaceHeight(position.x, position.z);

    gem.baseY = surfaceHeight + 0.5;
    gem.position.y = gem.baseY;
    gem.value = value * (gameState.stats.xpMultiplier || 1); // Fallback multiplier
    gem.bobOffset = Math.random() * Math.PI * 2;
    
    scene.add(gem);
    xpGems.push(gem);
    
    // Debug log
    console.log('[XP] Spawned gem:', { 
        position: gem.position.clone(), 
        value: gem.value, 
        xpMultiplier: gameState.stats.xpMultiplier,
        totalGems: xpGems.length 
    });
}

// Treasure Runner reward orb - distinct gold visual, high contrast
export function spawnTreasureRewardOrb(position, value) {
    if (!value || value <= 0 || !Number.isFinite(value)) {
        console.warn('[Treasure] Skipping reward orb spawn - invalid value:', value);
        return;
    }
    
    // Larger, more prominent gem (gold color, pulsing glow)
    const orb = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.3, 0), // Larger than normal gem
        new THREE.MeshBasicMaterial({
            color: 0xffd700, // Gold
            transparent: true,
            opacity: 1.0,
            emissive: 0xffd700,
            emissiveIntensity: 0.8
        })
    );
    
    orb.position.copy(position);
    const surfaceHeight = getSurfaceHeight(position.x, position.z);
    orb.baseY = surfaceHeight + 0.6;
    orb.position.y = orb.baseY;
    orb.value = value * (gameState.stats.xpMultiplier || 1);
    orb.bobOffset = Math.random() * Math.PI * 2;
    orb.isTreasureReward = true; // Flag for special handling
    orb.pulseTimer = 0; // For pulsing animation
    
    scene.add(orb);
    xpGems.push(orb); // Use same array, but with special visual
    
    log('SPAWN', 'treasure_reward_orb', {
        position: orb.position.clone(),
        value: orb.value
    });
}

export function spawnHeart(position, healAmount) {
    const heartGroup = new THREE.Group();
    const heartMat = new THREE.MeshBasicMaterial({
        color: 0xff4488,
        transparent: true,
        opacity: 0.9
    });
    
    const sphereGeo = new THREE.SphereGeometry(0.15, 8, 8);
    const left = new THREE.Mesh(sphereGeo, heartMat);
    left.position.set(-0.1, 0.1, 0);
    heartGroup.add(left);
    
    const right = new THREE.Mesh(sphereGeo, heartMat.clone());
    right.position.set(0.1, 0.1, 0);
    heartGroup.add(right);
    
    const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.2, 0.3, 8),
        heartMat.clone()
    );
    cone.position.y = -0.1;
    cone.rotation.x = Math.PI;
    heartGroup.add(cone);
    
    heartGroup.position.copy(position);
    // Hover above the surface at spawn position
    const surfaceHeight = getSurfaceHeight(position.x, position.z);
    heartGroup.baseY = surfaceHeight + 0.5;
    heartGroup.position.y = heartGroup.baseY;
    heartGroup.healAmount = healAmount;
    heartGroup.bobOffset = Math.random() * Math.PI * 2;
    heartGroup.ttl = HEART_TTL;
    
    scene.add(heartGroup);
    hearts.push(heartGroup);
}

export function updateXpGems(delta) {
    const rawRealSec = gameState.time?.realSeconds;
    const time = (Number.isFinite(rawRealSec) ? rawRealSec : 0) * 3;
    
    for (let i = xpGems.length - 1; i >= 0; i--) {
        const gem = xpGems[i];
        
        // Bob relative to base height (defaults to 0.5 for backwards compatibility)
        const baseY = gem.baseY !== undefined ? gem.baseY : 0.5;
        const newY = baseY + Math.sin(time + gem.bobOffset) * 0.2;
        gem.position.set(gem.position.x, newY, gem.position.z);
        gem.rotation.y += 0.05;
        
        // Treasure reward orb pulsing animation
        if (gem.isTreasureReward && gem.material) {
            gem.pulseTimer = (gem.pulseTimer || 0) + 1;
            const pulse = 0.8 + Math.sin(gem.pulseTimer * 0.1) * 0.2; // Pulsing emissive
            gem.material.emissiveIntensity = pulse;
            // Slight scale pulse for extra visibility
            const scalePulse = 1.0 + Math.sin(gem.pulseTimer * 0.1) * 0.1;
            gem.scale.setScalar(scalePulse);
        }
        
        const dist = gem.position.distanceTo(player.position);
        
        // Attract to player
        if (dist < gameState.stats.pickupRange) {
            tempVec3.subVectors(player.position, gem.position).normalize();
            gem.position.add(tempVec3.multiplyScalar(0.3));
        }
        
        // Collect
        if (dist < 1) {
            applyXp(gem.value);
            spawnParticle(gem.position, 0x44ff44, 5);
            PulseMusic.onXpPickup();
            
            gem.geometry.dispose();
            gem.material.dispose();
            scene.remove(gem);
            xpGems.splice(i, 1);
            
            // Trigger level-up flow if any are pending
            if (gameState.pendingLevelUps > 0 && !gameState.paused) {
                levelUp();
            }
        }
    }
}

/**
 * Instantly collect all remaining XP gems (hard vacuum).
 * Called on boss defeat to prevent missed XP from portal overlap.
 */
export function collectAllXpGems() {
    if (xpGems.length === 0) return;
    
    let totalXp = 0;
    for (const gem of xpGems) {
        totalXp += gem.value;
        gem.geometry.dispose();
        gem.material.dispose();
        scene.remove(gem);
    }
    
    if (totalXp > 0) {
        applyXp(totalXp);
        // Single particle burst at player position for feedback
        spawnParticle(player.position, 0x44ff44, 12);
        PulseMusic.onXpPickup();
    }
    
    xpGems.length = 0;
}

// Shared XP application helper (used by pickups and arena warps)
export function applyXp(amount) {
    if (!Number.isFinite(amount) || amount <= 0) return;

    gameState.xp += amount;

    while (gameState.xp >= gameState.xpToLevel) {
        gameState.xp -= gameState.xpToLevel;
        gameState.pendingLevelUps++;
        gameState.xpToLevel = Math.floor(gameState.xpToLevel * 1.25);  // Reduced from 1.5x for faster progression
    }
}

export function updateHearts(delta) {
    const time = (gameState.time?.realSeconds ?? 0) * 4;
    
    for (let i = hearts.length - 1; i >= 0; i--) {
        const heart = hearts[i];
        // Bob relative to base height (defaults to 0.5 for backwards compatibility)
        const baseY = heart.baseY !== undefined ? heart.baseY : 0.5;
        heart.position.y = baseY + Math.sin(time + heart.bobOffset) * 0.2;
        heart.rotation.y += 0.03;
        heart.ttl--;
        
        // Fade out near expiry
        if (heart.ttl < 60) {
            heart.children.forEach(c => {
                if (c.material) c.material.opacity = (heart.ttl / 60) * 0.9;
            });
        }
        
        // Remove expired
        if (heart.ttl <= 0) {
            heart.children.forEach(c => {
                if (c.geometry) c.geometry.dispose();
                if (c.material) c.material.dispose();
            });
            scene.remove(heart);
            hearts.splice(i, 1);
            continue;
        }
        
        const dist = heart.position.distanceTo(player.position);
        
        // Attract to player
        if (dist < gameState.stats.pickupRange) {
            tempVec3.subVectors(player.position, heart.position).normalize();
            heart.position.add(tempVec3.multiplyScalar(0.25));
        }
        
        // Collect
        if (dist < 1) {
            gameState.health = Math.min(gameState.health + heart.healAmount, gameState.maxHealth);
            spawnParticle(heart.position, 0xff4488, 8);
            PulseMusic.onXpPickup(); // Reuse XP pickup sound for heart pickup
            
            heart.children.forEach(c => {
                if (c.geometry) c.geometry.dispose();
                if (c.material) c.material.dispose();
            });
            scene.remove(heart);
            hearts.splice(i, 1);
        }
    }
}

/**
 * Clear all pickups from the arena (XP gems and hearts)
 * Called when spawning a new boss or loading a new arena to prevent carryover
 */
export function clearAllPickups() {
    // Clear XP gems
    for (const gem of xpGems) {
        if (gem.parent) {
            scene.remove(gem);
        }
        if (gem.geometry) gem.geometry.dispose();
        if (gem.material) gem.material.dispose();
    }
    xpGems.length = 0;
    
    // Clear hearts
    for (const heart of hearts) {
        if (heart.parent) {
            scene.remove(heart);
        }
        heart.children.forEach(c => {
            if (c.geometry) c.geometry.dispose();
            if (c.material) c.material.dispose();
        });
    }
    hearts.length = 0;
}

// ==================== ARENA PORTAL SYSTEM ====================
// Portal spawns after boss defeat for player to progress to next arena

const PORTAL_RADIUS = 2;
const PORTAL_HEIGHT = 4;
const PORTAL_COLLISION_RADIUS = 2.5;

/**
 * Spawn an arena portal at the given position
 * Player must enter this portal to progress to the next arena
 */
export function spawnArenaPortal(position) {
    // Clear any existing portal
    clearArenaPortal();
    
    // Create portal group
    const portal = new THREE.Group();
    portal.position.copy(position);
    portal.position.y = 0.1;  // Slightly above ground
    
    // Outer ring (torus)
    const ringGeom = new THREE.TorusGeometry(PORTAL_RADIUS, 0.2, 16, 32);
    const ringMat = new THREE.MeshStandardMaterial({
        color: 0x00ffff,
        emissive: 0x00ffff,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.9
    });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.rotation.x = Math.PI / 2;  // Lay flat
    ring.position.y = 0.5;
    portal.add(ring);
    
    // Inner glow (cylinder)
    const glowGeom = new THREE.CylinderGeometry(PORTAL_RADIUS * 0.9, PORTAL_RADIUS * 0.9, 0.1, 32);
    const glowMat = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.5
    });
    const glow = new THREE.Mesh(glowGeom, glowMat);
    glow.position.y = 0.5;
    portal.add(glow);
    
    // Vertical beam effect
    const beamGeom = new THREE.CylinderGeometry(0.3, 0.3, PORTAL_HEIGHT, 16);
    const beamMat = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.4
    });
    const beam = new THREE.Mesh(beamGeom, beamMat);
    beam.position.y = PORTAL_HEIGHT / 2;
    portal.add(beam);
    
    // Particles orbiting the portal (decorative spheres)
    const particleCount = 8;
    portal.orbitParticles = [];
    for (let i = 0; i < particleCount; i++) {
        const particleGeom = new THREE.SphereGeometry(0.15, 8, 8);
        const particleMat = new THREE.MeshBasicMaterial({
            color: 0x88ffff,
            transparent: true,
            opacity: 0.8
        });
        const particle = new THREE.Mesh(particleGeom, particleMat);
        particle.orbitAngle = (i / particleCount) * Math.PI * 2;
        particle.orbitHeight = 0.5 + Math.random() * 2;
        portal.orbitParticles.push(particle);
        portal.add(particle);
    }
    
    // Store references for animation
    portal.ring = ring;
    portal.glow = glow;
    portal.beam = beam;
    portal.spawnTime = gameState.time?.realSeconds ?? 0;
    portal.isPortal = true;
    
    scene.add(portal);
    setArenaPortal(portal);
    
    return portal;
}

/**
 * Update portal animation and check for player collision
 * Returns true if player entered the portal
 */
export function updateArenaPortal() {
    const portal = getArenaPortal();
    if (!portal) return false;

    const time = gameState.time?.realSeconds ?? 0;
    
    // Rotate the ring
    if (portal.ring) {
        portal.ring.rotation.z += 0.02;
    }
    
    // Pulse the glow
    if (portal.glow && portal.glow.material) {
        portal.glow.material.opacity = 0.3 + Math.sin(time * 3) * 0.2;
    }
    
    // Animate beam
    if (portal.beam && portal.beam.material) {
        portal.beam.material.opacity = 0.3 + Math.sin(time * 2) * 0.15;
        portal.beam.rotation.y += 0.01;
    }
    
    // Animate orbiting particles
    if (portal.orbitParticles) {
        for (const particle of portal.orbitParticles) {
            particle.orbitAngle += 0.03;
            particle.position.x = Math.cos(particle.orbitAngle) * (PORTAL_RADIUS * 0.7);
            particle.position.z = Math.sin(particle.orbitAngle) * (PORTAL_RADIUS * 0.7);
            particle.position.y = particle.orbitHeight + Math.sin(time * 2 + particle.orbitAngle) * 0.3;
        }
    }
    
    // Check player collision
    if (player && player.position) {
        const dist = player.position.distanceTo(portal.position);
        if (dist < PORTAL_COLLISION_RADIUS) {
            // Player entered portal - trigger transition
            triggerPortalTransition();
            return true;
        }
    }
    
    return false;
}

/**
 * Clear the arena portal
 */
export function clearArenaPortal() {
    const portal = getArenaPortal();
    if (!portal) return;
    
    // Dispose geometries and materials
    portal.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
    });
    
    scene.remove(portal);
    setArenaPortal(null);
}

/**
 * Trigger the portal transition effect and set wave state
 */
function triggerPortalTransition() {
    // Visual feedback
    triggerSlowMo(30, 0.3);
    triggerScreenFlash(0x00ffff, 20);
    
    // Spawn particles at player
    if (player && player.position) {
        for (let i = 0; i < 20; i++) {
            spawnParticle(player.position, 0x00ffff, 10);
        }
    }
    
    // Clear the portal
    clearArenaPortal();
    
    // Set wave state to arena transition
    gameState.waveState = WAVE_STATE.ARENA_TRANSITION;
    gameState.waveTimer = 0;
}

// ==================== BOSS ENTRANCE PORTAL SYSTEM ====================
// Portal spawns before boss, boss emerges from it, then it freezes until boss is defeated
// Uses shader-based vortex effect matching the main menu portal

// Vortex Shader - same swirling portal effect as main menu
const VortexShader = {
    uniforms: {
        time: { value: 0 },
        aspect: { value: 1 },
        turns: { value: 2.8 },
        tightness: { value: 10.0 },
        speed: { value: 1.2 },
        core: { value: 2.2 },
        ringWidth: { value: 0.35 },
        frozen: { value: 0.0 },  // 0 = active, 1 = frozen (greyed out)
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float time;
        uniform float aspect;
        uniform float turns;
        uniform float tightness;
        uniform float speed;
        uniform float core;
        uniform float ringWidth;
        uniform float frozen;

        varying vec2 vUv;

        float hash(vec2 p) {
            p = fract(p * vec2(123.34, 345.45));
            p += dot(p, p + 34.345);
            return fract(p.x * p.y);
        }

        float smoothBand(float x, float w) {
            return smoothstep(0.5 - w, 0.5, x) * (1.0 - smoothstep(0.5, 0.5 + w, x));
        }

        void main() {
            vec2 p = vUv * 2.0 - 1.0;
            p.x *= aspect;

            float r = length(p);
            float a = atan(p.y, p.x);

            float outer = smoothstep(1.05, 0.25, r);
            float inner = smoothstep(0.02, 0.18, r);
            float mask = outer * inner;

            // Slow down animation when frozen
            float effectiveSpeed = speed * (1.0 - frozen * 0.9);
            float s = a * turns + r * tightness - time * effectiveSpeed;

            float bands1 = 0.5 + 0.5 * sin(s * 2.0);
            float bands2 = 0.5 + 0.5 * sin(s * 4.5 + 1.2);
            float band = smoothBand(bands1, 0.18) * 0.75 + smoothBand(bands2, 0.10) * 0.45;

            float n = hash(p * 4.0 + time * 0.05);
            band *= (0.85 + 0.30 * n);

            // Color: cyan/magenta when active, grey when frozen
            vec3 cyan = vec3(0.15, 0.95, 1.00);
            vec3 mag = vec3(0.95, 0.20, 1.00);
            vec3 grey = vec3(0.4, 0.4, 0.5);
            
            float t = smoothstep(0.15, 0.85, r);
            vec3 activeCol = mix(cyan, mag, t);
            vec3 col = mix(activeCol, grey, frozen);

            float rim = smoothstep(0.55 + ringWidth, 0.45 + ringWidth, r) - smoothstep(0.95, 0.90, r);
            col += mix(cyan, grey, frozen) * rim * 1.2;

            float coreGlow = pow(smoothstep(0.55, 0.0, r), 2.2) * core * (1.0 - frozen * 0.7);

            float intensity = band * 2.0 + coreGlow * 0.6;  // Boost bands, reduce core glow
            // Dim when frozen
            intensity *= (1.0 - frozen * 0.6);
            
            vec3 finalCol = col * intensity;
            float alpha = mask * smoothstep(0.05, 1.2, intensity);

            gl_FragColor = vec4(finalCol, alpha);
        }
    `
};

/**
 * Spawn a boss entrance portal at the given position
 * Uses shader-based vortex effect matching main menu portal
 */
export function spawnBossEntrancePortal(position) {
    // Clear any existing entrance portal
    clearBossEntrancePortal();
    
    const portal = new THREE.Group();
    portal.position.copy(position);
    portal.position.y = 3;  // Portal elevated above ground (boss size height)
    
    // Create vortex planes (same as main menu)
    portal.vortexPlanes = [];
    
    const createVortexPlane = (size, params = {}) => {
        const mat = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                aspect: { value: 1 },
                turns: { value: params.turns || 2.8 },
                tightness: { value: params.tightness || 10.0 },
                speed: { value: params.speed || 1.2 },
                core: { value: params.core || 1.0 },  // Reduced from 2.2 - less blinding without bloom
                ringWidth: { value: params.ringWidth || 0.35 },
                frozen: { value: 0.0 },
            },
            vertexShader: VortexShader.vertexShader,
            fragmentShader: VortexShader.fragmentShader,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        
        const geo = new THREE.PlaneGeometry(size, size);
        const mesh = new THREE.Mesh(geo, mat);
        return mesh;
    };
    
    // Create 3 stacked vortex planes for depth (SAME AS MAIN MENU)
    const v1 = createVortexPlane(8, { turns: 2.8, tightness: 10.0, speed: 1.2 });
    const v2 = createVortexPlane(7.5, { turns: 3.2, tightness: 11.5, speed: 1.0 });
    const v3 = createVortexPlane(7, { turns: 2.4, tightness: 9.0, speed: 1.4 });
    
    // Stack them on Z axis (facing player) - NO X rotation, planes are vertical by default
    v1.position.z = -0.30;
    v2.position.z = -0.20;
    v3.position.z = -0.10;
    
    portal.add(v1, v2, v3);
    portal.vortexPlanes.push(v1, v2, v3);
    
    // Match main menu: rotate spiral pattern and scale up
    portal.rotation.y = Math.PI;      // Face toward player (portal is at back wall looking toward center)
    portal.rotation.z = Math.PI / 2;  // Rotate spiral pattern (same as main menu)
    portal.scale.setScalar(1.8);      // Scale for visibility (same as main menu)
    
    // Store references
    portal.spawnTime = gameState.time?.realSeconds ?? 0;
    portal.isEntrancePortal = true;
    portal.isFrozen = false;
    portal.freezeTransition = 0;
    
    scene.add(portal);
    setBossEntrancePortal(portal);
    
    return portal;
}

/**
 * Freeze the boss entrance portal (visual grey-out effect via shader)
 * Called after boss emerges from the portal
 */
export function freezeBossEntrancePortal() {
    const portal = getBossEntrancePortal();
    if (!portal || portal.isFrozen) return;
    
    portal.isFrozen = true;
    portal.freezeTransition = 0;
}

/**
 * Unfreeze the boss entrance portal (restore active state)
 * Called when boss is defeated - portal becomes usable for progression
 */
export function unfreezeBossEntrancePortal() {
    const portal = getBossEntrancePortal();
    if (!portal || !portal.isFrozen) return;
    
    portal.isFrozen = false;
    portal.freezeTransition = 1;  // Will animate back to active
    
    // Flash effect to indicate unfreezing
    triggerScreenFlash(0x00ffff, 15);
}

/**
 * Update boss entrance portal animation (shader-based vortex)
 */
export function updateBossEntrancePortal() {
    const portal = getBossEntrancePortal();
    if (!portal) return false;
    
    const time = gameState.time?.realSeconds ?? 0;
    
    // Animate freeze transition
    if (portal.isFrozen && portal.freezeTransition < 1) {
        portal.freezeTransition = Math.min(1, portal.freezeTransition + 0.02);
    } else if (!portal.isFrozen && portal.freezeTransition > 0) {
        portal.freezeTransition = Math.max(0, portal.freezeTransition - 0.03);
    }
    
    // Update vortex shader uniforms (same as main menu)
    if (portal.vortexPlanes) {
        for (const plane of portal.vortexPlanes) {
            plane.material.uniforms.time.value = time;
            plane.material.uniforms.aspect.value = window.innerWidth / window.innerHeight;
            plane.material.uniforms.frozen.value = portal.freezeTransition;
        }
    }
    
    // Subtle bob of the portal (same as main menu)
    portal.position.y = 3 + Math.sin(time * 0.8) * 0.2;
    
    // Check player collision (only when not frozen AND boss is defeated)
    // CRITICAL: Must check waveState to prevent premature transition during BOSS_INTRO
    const VORTEX_COLLISION_RADIUS = 3;  // Collision radius for vortex portal
    const canEnterPortal = !portal.isFrozen && gameState.waveState === WAVE_STATE.BOSS_DEFEATED;
    if (canEnterPortal && player && player.position) {
        const dist = player.position.distanceTo(new THREE.Vector3(portal.position.x, player.position.y, portal.position.z));
        if (dist < VORTEX_COLLISION_RADIUS) {
            // Player entered unfrozen portal - trigger transition
            triggerPortalTransition();
            clearBossEntrancePortal();
            return true;
        }
    }
    
    return false;
}

/**
 * Clear the boss entrance portal
 */
export function clearBossEntrancePortal() {
    const portal = getBossEntrancePortal();
    if (!portal) return;
    
    portal.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
    });
    
    scene.remove(portal);
    setBossEntrancePortal(null);
}

// ==================== MODULE PICKUPS ====================
// Hidden pickups that unlock modules (Speed Module in Arena 1)

// Arena 1 hidden pickup positions (one is chosen randomly each run)
const ARENA1_MODULE_POSITIONS = [
    { x: -35, z: -35 },  // Far corner
    { x: 35, z: -35 },   // Far corner
    { x: 0, z: -38 },    // Far edge center
];

/**
 * Spawn the Arena 1 hidden Speed Module pickup
 * - Guaranteed spawn until first find
 * - After first find: 50% spawn chance
 */
export function spawnArena1ModulePickup() {
    // Only spawn in Arena 1
    if (gameState.currentArena !== 1) return;
    
    // Check spawn chance (50% after first find)
    const hasFoundBefore = isModuleUnlocked('speedModule');
    if (hasFoundBefore && Math.random() > 0.5) {
        return; // Skip spawn this run
    }
    
    // Choose random position from preset locations
    const posIndex = Math.floor(Math.random() * ARENA1_MODULE_POSITIONS.length);
    const pos = ARENA1_MODULE_POSITIONS[posIndex];
    
    spawnModulePickup('speedModule', pos.x, pos.z);
}

/**
 * Spawn a module pickup at a specific location
 */
export function spawnModulePickup(moduleId, x, z) {
    // Create glowing pickup mesh
    const group = new THREE.Group();
    
    // Main orb (pulsing)
    const orbGeom = new THREE.SphereGeometry(0.5, 16, 16);
    const orbMat = new THREE.MeshStandardMaterial({
        color: 0x00ffff,      // Cyan glow
        emissive: 0x00ffff,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.8
    });
    const orb = new THREE.Mesh(orbGeom, orbMat);
    group.add(orb);
    
    // Inner core (brighter)
    const coreGeom = new THREE.SphereGeometry(0.25, 12, 12);
    const coreMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9
    });
    const core = new THREE.Mesh(coreGeom, coreMat);
    group.add(core);
    
    // Outer ring (rotating)
    const ringGeom = new THREE.TorusGeometry(0.7, 0.05, 8, 24);
    const ringMat = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.6
    });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    
    // Position
    group.position.set(x, 1.5, z);  // Floating height
    
    // Metadata
    group.moduleId = moduleId;
    group.spawnTime = gameState.time?.realSeconds ?? 0;
    group.orb = orb;
    group.core = core;
    group.ring = ring;
    
    scene.add(group);
    modulePickups.push(group);
}

/**
 * Update all module pickups (animation + collection)
 */
export function updateModulePickups() {
    const time = gameState.time?.realSeconds ?? 0;
    const COLLECTION_RADIUS = 2.0;
    
    for (let i = modulePickups.length - 1; i >= 0; i--) {
        const pickup = modulePickups[i];
        
        // Pulsing animation
        const pulse = Math.sin(time * 3) * 0.1 + 1;
        pickup.orb.scale.setScalar(pulse);
        pickup.core.scale.setScalar(pulse * 0.8);
        
        // Ring rotation
        pickup.ring.rotation.z = time * 2;
        pickup.ring.rotation.x = Math.PI / 2 + Math.sin(time) * 0.2;
        
        // Bob up and down
        pickup.position.y = 1.5 + Math.sin(time * 2) * 0.3;
        
        // Emissive pulse
        pickup.orb.material.emissiveIntensity = 0.3 + Math.sin(time * 4) * 0.2;
        
        // Check player collection
        if (player && player.position) {
            const dist = player.position.distanceTo(pickup.position);
            if (dist < COLLECTION_RADIUS) {
                collectModulePickup(pickup, i);
            }
        }
    }
}

/**
 * Handle collection of a module pickup
 */
function collectModulePickup(pickup, index) {
    const moduleId = pickup.moduleId;
    
    // Update module progress
    const previousLevel = getModuleLevel(moduleId);
    incrementModuleCounter(moduleId, 'finds');
    const newLevel = tryLevelUpModule(moduleId);
    
    // Show unlock/upgrade banner
    if (newLevel > 0) {
        const isUnlock = previousLevel === 0;
        showModuleUnlockBanner(moduleId, newLevel, isUnlock);
    }
    
    // Collection VFX
    spawnParticle(pickup.position, 0x00ffff, 15);
    triggerScreenFlash(0x00ffff, 0.3);
    triggerSlowMo(30, 0.5);  // Brief slow-mo for drama
    
    // Cleanup
    pickup.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
    });
    scene.remove(pickup);
    modulePickups.splice(index, 1);
}

/**
 * Clear all module pickups (on arena change/restart)
 */
export function clearModulePickups() {
    for (const pickup of modulePickups) {
        pickup.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
        scene.remove(pickup);
    }
    modulePickups.length = 0;
}

// ==================== ITEM CHEST SYSTEM ====================
// Chests drop on wave clear and grant projectile-modifying items.

// Shared geometry for chests (avoids per-spawn allocation)
let chestGeometry = null;

function getChestGeometry() {
    if (!chestGeometry) {
        chestGeometry = new THREE.BoxGeometry(1.0, 0.7, 0.8);
    }
    return chestGeometry;
}

/**
 * Maybe spawn a chest near the player after a wave clear.
 * Respects ITEM_CONFIG.chestDropChance. Lesson waves (wave 1) never drop.
 */
export function maybeSpawnChest() {
    if (gameState.currentWave === 1) return; // No chests on lesson wave
    if (Math.random() > ITEM_CONFIG.chestDropChance) return;

    // Pick a random position near the player (but not on top)
    const angle = Math.random() * Math.PI * 2;
    const dist = 5 + Math.random() * 6;
    let x = player.position.x + Math.cos(angle) * dist;
    let z = player.position.z + Math.sin(angle) * dist;
    x = Math.max(-40, Math.min(40, x));
    z = Math.max(-40, Math.min(40, z));

    spawnChest(x, z);
}

/**
 * Spawn a chest at the given XZ position.
 */
function spawnChest(x, z) {
    const group = new THREE.Group();

    // Chest body
    const bodyMat = new THREE.MeshStandardMaterial({
        color: 0xdaa520,
        emissive: 0xdaa520,
        emissiveIntensity: 0.3,
        metalness: 0.4,
        roughness: 0.5
    });
    const body = new THREE.Mesh(getChestGeometry(), bodyMat);
    group.add(body);

    // Lid accent (thin box on top)
    const lidGeom = new THREE.BoxGeometry(1.05, 0.15, 0.85);
    const lidMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        emissive: 0xffd700,
        emissiveIntensity: 0.4,
        metalness: 0.6,
        roughness: 0.3
    });
    const lid = new THREE.Mesh(lidGeom, lidMat);
    lid.position.y = 0.42;
    group.add(lid);

    group.position.set(x, 0.5, z);
    group.bobOffset = Math.random() * Math.PI * 2;
    group.isChest = true;

    scene.add(group);
    chests.push(group);

    log('SPAWN', 'chest_spawned', { x: x.toFixed(1), z: z.toFixed(1) });
}

/**
 * Update all chests (bob animation + collection check).
 */
export function updateChests() {
    const time = (gameState.time?.realSeconds ?? 0) * 3;

    for (let i = chests.length - 1; i >= 0; i--) {
        const chest = chests[i];

        // Bob
        chest.position.y = 0.5 + Math.sin(time + chest.bobOffset) * 0.15;
        chest.rotation.y += 0.01;

        // Collection check
        if (player && player.position) {
            const dist = chest.position.distanceTo(player.position);
            if (dist < ITEM_CONFIG.chestCollectionRadius) {
                collectChest(chest, i);
            }
        }
    }
}

/**
 * Handle chest collection: grant a random projectile item as blueprint (requires level-up to activate).
 */
function collectChest(chest, index) {
    // Initialize blueprints if needed
    if (!gameState.blueprints) {
        gameState.blueprints = {
            pending: new Set(),
            unlocked: new Set()
        };
    }
    
    // Pick a random item the player doesn't already have (pending or unlocked)
    const allIds = Object.keys(PROJECTILE_ITEMS);
    const unavailable = new Set([...gameState.blueprints.pending, ...gameState.blueprints.unlocked, ...gameState.heldItems]);
    const available = allIds.filter(id => !unavailable.has(id));

    if (available.length === 0) {
        // Player has all items — grant XP instead
        applyXp(50);
        showUnlockNotification('Chest: +50 XP (all items owned)');
    } else {
        const itemId = available[Math.floor(Math.random() * available.length)];
        
        // Add to pending blueprints (not active until level-up unlock)
        gameState.blueprints.pending.add(itemId);

        const item = PROJECTILE_ITEMS[itemId];
        showUnlockNotification(`Blueprint: ${item.name} — Spend a level-up to activate!`);
        log('SPAWN', 'blueprint_collected', { item: itemId, pending: [...gameState.blueprints.pending] });
    }

    // VFX
    spawnParticle(chest.position, 0xffd700, 12);
    PulseMusic.onLevelUp(); // Reuse level-up chime for now

    // Cleanup chest
    chest.traverse(child => {
        if (child.geometry && child.geometry !== chestGeometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
    });
    scene.remove(chest);
    chests.splice(index, 1);

    // Update HUD item display
    updateItemHUD();
}

/**
 * Clear all chests (on arena change/restart).
 */
export function clearChests() {
    for (const chest of chests) {
        chest.traverse(child => {
            if (child.geometry && child.geometry !== chestGeometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
        scene.remove(chest);
    }
    chests.length = 0;
}

/**
 * Update the item HUD display to show currently held items.
 */
export function updateItemHUD() {
    let container = document.getElementById('item-hud');
    if (!container) {
        // Create container on first use
        container = document.createElement('div');
        container.id = 'item-hud';
        container.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);display:flex;gap:8px;z-index:100;pointer-events:none;';
        document.body.appendChild(container);
    }

    container.innerHTML = '';

    for (const itemId of gameState.heldItems) {
        const item = PROJECTILE_ITEMS[itemId];
        if (!item) continue;
        const badge = document.createElement('div');
        badge.style.cssText = `
            background:rgba(0,0,0,0.7);
            border:2px solid #${item.color.toString(16).padStart(6, '0')};
            color:#${item.color.toString(16).padStart(6, '0')};
            padding:4px 10px;
            border-radius:6px;
            font-size:13px;
            font-family:monospace;
            text-shadow:0 0 6px #${item.color.toString(16).padStart(6, '0')};
        `;
        badge.textContent = item.name;
        container.appendChild(badge);
    }

    // Show combo badge if active
    const combo = getActiveCombination(gameState.heldItems);
    if (combo) {
        const comboBadge = document.createElement('div');
        comboBadge.style.cssText = `
            background:rgba(0,0,0,0.85);
            border:2px solid #${combo.color.toString(16).padStart(6, '0')};
            color:#${combo.color.toString(16).padStart(6, '0')};
            padding:4px 10px;
            border-radius:6px;
            font-size:13px;
            font-weight:bold;
            font-family:monospace;
            text-shadow:0 0 8px #${combo.color.toString(16).padStart(6, '0')};
        `;
        comboBadge.textContent = combo.name;
        container.appendChild(comboBadge);
    }
}
