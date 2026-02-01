import { scene } from '../core/scene.js';
import { gameState } from '../core/gameState.js';
import { xpGems, hearts, tempVec3, obstacles, getArenaPortal, setArenaPortal } from '../core/entities.js';
import { player } from '../entities/player.js';
import { HEART_TTL, XP_GEM_TTL, WAVE_STATE } from '../config/constants.js';
import { spawnParticle } from '../effects/particles.js';
import { levelUp } from '../ui/menus.js';
import { triggerSlowMo, triggerScreenFlash } from './visualFeedback.js';

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
    gem.value = value * gameState.stats.xpMultiplier;
    gem.bobOffset = Math.random() * Math.PI * 2;
    gem.ttl = XP_GEM_TTL;  // 15 seconds at 60fps
    
    scene.add(gem);
    xpGems.push(gem);
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
    const time = Date.now() * 0.003;
    
    for (let i = xpGems.length - 1; i >= 0; i--) {
        const gem = xpGems[i];
        // Bob relative to base height (defaults to 0.5 for backwards compatibility)
        const baseY = gem.baseY !== undefined ? gem.baseY : 0.5;
        gem.position.y = baseY + Math.sin(time + gem.bobOffset) * 0.2;
        gem.rotation.y += 0.05;
        
        // Decrement TTL
        gem.ttl--;
        
        // Fade out over last 3 seconds (180 frames)
        if (gem.ttl < 180) {
            gem.material.opacity = (gem.ttl / 180) * 0.9;
        }
        
        // Remove expired gems
        if (gem.ttl <= 0) {
            gem.geometry.dispose();
            gem.material.dispose();
            scene.remove(gem);
            xpGems.splice(i, 1);
            continue;
        }
        
        const dist = gem.position.distanceTo(player.position);
        
        // Attract to player
        if (dist < gameState.stats.pickupRange) {
            tempVec3.subVectors(player.position, gem.position).normalize();
            gem.position.add(tempVec3.multiplyScalar(0.3));
        }
        
        // Collect
        if (dist < 1) {
            gameState.xp += gem.value;
            spawnParticle(gem.position, 0x44ff44, 5);
            
            gem.geometry.dispose();
            gem.material.dispose();
            scene.remove(gem);
            xpGems.splice(i, 1);
            
            // Check level up
            while (gameState.xp >= gameState.xpToLevel) {
                gameState.xp -= gameState.xpToLevel;
                gameState.pendingLevelUps++;
                gameState.xpToLevel = Math.floor(gameState.xpToLevel * 1.5);
            }
            
            if (gameState.pendingLevelUps > 0 && !gameState.paused) {
                levelUp();
            }
        }
    }
}

export function updateHearts(delta) {
    const time = Date.now() * 0.004;
    
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
    portal.spawnTime = Date.now();
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
    
    const time = Date.now() * 0.001;
    
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
