import { scene } from '../core/scene.js';
import { SLOW_MO_LERP_SPEED } from '../config/constants.js';

// Visual Feedback System - Centralized telegraph and success feedback
// Implements consistent visual language across all game mechanics

// ==================== GEOMETRY CACHE ====================
// Cache frequently used geometries to prevent memory leaks

const geometryCache = new Map();

function getCachedGeometry(key, createFn) {
    if (!geometryCache.has(key)) {
        geometryCache.set(key, createFn());
    }
    return geometryCache.get(key);
}

// Pre-defined geometry getters for common shapes
function getRingGeometry(innerRadius, outerRadius, segments = 32) {
    const key = `ring_${innerRadius.toFixed(2)}_${outerRadius.toFixed(2)}_${segments}`;
    return getCachedGeometry(key, () => new THREE.RingGeometry(innerRadius, outerRadius, segments));
}

function getCircleGeometry(radius, segments = 32) {
    const key = `circle_${radius.toFixed(2)}_${segments}`;
    return getCachedGeometry(key, () => new THREE.CircleGeometry(radius, segments));
}

function getSphereGeometry(radius, segments = 16) {
    const key = `sphere_${radius.toFixed(2)}_${segments}`;
    return getCachedGeometry(key, () => new THREE.SphereGeometry(radius, segments, segments));
}

function getPlaneGeometry(width, height) {
    const key = `plane_${width.toFixed(2)}_${height.toFixed(2)}`;
    return getCachedGeometry(key, () => new THREE.PlaneGeometry(width, height));
}

function getConeGeometry(radius, height, segments = 8) {
    const key = `cone_${radius.toFixed(2)}_${height.toFixed(2)}_${segments}`;
    return getCachedGeometry(key, () => new THREE.ConeGeometry(radius, height, segments));
}

function getCylinderGeometry(radiusTop, radiusBottom, height, segments = 8) {
    const key = `cylinder_${radiusTop.toFixed(2)}_${radiusBottom.toFixed(2)}_${height.toFixed(2)}_${segments}`;
    return getCachedGeometry(key, () => new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments));
}

function getBoxGeometry(width, height, depth) {
    const key = `box_${width.toFixed(2)}_${height.toFixed(2)}_${depth.toFixed(2)}`;
    return getCachedGeometry(key, () => new THREE.BoxGeometry(width, height, depth));
}

// ==================== TELEGRAPH TIER SYSTEM ====================
// NOTE: Reserved for future use - defines standardized telegraph intensity levels
// to be used for consistent visual feedback across different attack types.
// Not currently wired into the VFX functions but retained for planned tier selection feature.

export const TELEGRAPH_TIERS = {
    TIER1: {
        name: 'Nudge',
        lineThickness: 0.05,
        color: 0xffaa44,
        windupMin: 24,      // frames (0.4s at 60fps)
        windupMax: 36,      // frames (0.6s at 60fps)
        glowIntensity: 0.3,
        screenEffect: null
    },
    TIER2: {
        name: 'Danger',
        lineThickness: 0.1,
        color: 0xff4444,
        windupMin: 48,      // frames (0.8s at 60fps)
        windupMax: 72,      // frames (1.2s at 60fps)
        glowIntensity: 0.6,
        screenEffect: 'vignette'
    },
    TIER3: {
        name: 'Critical',
        lineThickness: 0.15,
        color: 0xff0000,
        windupMin: 60,      // frames (1.0s at 60fps)
        windupMax: 90,      // frames (1.5s at 60fps)
        glowIntensity: 1.0,
        screenEffect: 'shake'
    }
};

// ==================== COLOR CONVENTIONS ====================

export const VISUAL_COLORS = {
    SHIELD_BLUE: 0x4488ff,
    EXPOSED_GOLD: 0xffdd44,
    DANGER_RED: 0xff4444,
    WARNING_ORANGE: 0xff8844,
    SAFE_GREEN: 0x44ff88,
    TELEPORT_PURPLE: 0xaa44ff,
    BURROW_BROWN: 0x886644
};

// ==================== ANIMATION TIMINGS ====================

export const ANIMATION_TIMINGS = {
    shieldFlicker: 4,
    shieldBreakFreeze: 5,
    exposedDuration: 300,
    exposedFlashRate: 15,
    slamImpactFreeze: 3,
    hitStopDuration: 2,
    phaseTransitionDuration: 60,
    deathSlowMoDuration: 30
};

// ==================== SLAM MARKER ====================

export function createSlamMarker(position, radius = 6) {
    const markerGroup = new THREE.Group();
    
    // Outer ring (expanding) - use cached geometry
    const outerRing = new THREE.Mesh(
        getRingGeometry(radius - 0.5, radius, 32),
        new THREE.MeshBasicMaterial({
            color: VISUAL_COLORS.DANGER_RED,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide
        })
    );
    outerRing.rotation.x = -Math.PI / 2;
    outerRing.position.y = 0.1;
    markerGroup.add(outerRing);
    
    // Inner fill (pulsing) - use cached geometry
    const innerFill = new THREE.Mesh(
        getCircleGeometry(radius - 0.5, 32),
        new THREE.MeshBasicMaterial({
            color: VISUAL_COLORS.DANGER_RED,
            transparent: true,
            opacity: 0.2,
            side: THREE.DoubleSide
        })
    );
    innerFill.rotation.x = -Math.PI / 2;
    innerFill.position.y = 0.05;
    markerGroup.add(innerFill);
    
    // Enhanced crosshair lines for visibility against dark ground
    const crosshairMat = new THREE.MeshBasicMaterial({
        color: 0xffaaaa,
        transparent: true,
        opacity: 0.7
    });
    
    // 4 crosshair lines extending to edge
    for (let i = 0; i < 4; i++) {
        const line = new THREE.Mesh(
            getPlaneGeometry(0.4, radius * 2),
            crosshairMat.clone()
        );
        line.rotation.x = -Math.PI / 2;
        line.rotation.z = (i / 4) * Math.PI;
        line.position.y = 0.08;
        markerGroup.add(line);
    }
    
    // Center target indicator (bright white dot)
    const centerDot = new THREE.Mesh(
        getCircleGeometry(0.5, 16),
        new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.9
        })
    );
    centerDot.rotation.x = -Math.PI / 2;
    centerDot.position.y = 0.12;
    markerGroup.add(centerDot);
    
    markerGroup.position.copy(position);
    markerGroup.position.y = 0;
    
    // Store references for animation
    markerGroup.outerRing = outerRing;
    markerGroup.innerFill = innerFill;
    markerGroup.centerDot = centerDot;
    markerGroup.radius = radius;
    markerGroup.createdTime = Date.now();
    markerGroup.isLocked = false;
    
    scene.add(markerGroup);
    return markerGroup;
}

export function updateSlamMarker(marker, isLocked = false) {
    if (!marker || !marker.outerRing) return;
    
    const elapsed = (Date.now() - marker.createdTime) / 1000;
    marker.isLocked = isLocked;
    
    // Base pulse frequency increases when locked (urgency)
    const pulseSpeed = isLocked ? 15 : 8;
    const pulseScale = 1 + Math.sin(elapsed * pulseSpeed) * 0.15;
    
    // Inner fill pulses
    if (marker.innerFill) {
        marker.innerFill.scale.setScalar(pulseScale);
        // Opacity increases when locked
        marker.innerFill.material.opacity = isLocked ? 0.4 + Math.sin(elapsed * pulseSpeed) * 0.2 : 0.25;
    }
    
    // Rotate outer ring faster when locked
    if (marker.outerRing) {
        marker.outerRing.rotation.z += isLocked ? 0.08 : 0.03;
        // Outer ring gets brighter and more opaque when locked
        marker.outerRing.material.opacity = isLocked ? 0.8 + Math.sin(elapsed * pulseSpeed) * 0.2 : 0.6;
    }
    
    // Center dot pulses more intensely when locked
    if (marker.centerDot) {
        const dotScale = isLocked ? (1.2 + Math.sin(elapsed * pulseSpeed * 2) * 0.3) : 1;
        marker.centerDot.scale.setScalar(dotScale);
    }
    
    // Flash crosshair lines when locked
    marker.children.forEach((child, i) => {
        if (i >= 2 && i <= 5 && child.material) { // Crosshair lines are at indices 2-5
            child.material.opacity = isLocked ? (0.7 + Math.sin(elapsed * pulseSpeed + i) * 0.3) : 0.6;
        }
    });
}

// ==================== PERCH CHARGE VFX (Boss 2) ====================

export function createPerchChargeVFX(boss) {
    const group = new THREE.Group();
    
    // Spinning ring above boss (charges up)
    const ringMat = new THREE.MeshBasicMaterial({
        color: boss.baseColor || 0x44ff88,
        transparent: true,
        opacity: 0.5
    });
    
    // Outer charging ring
    const outerRing = new THREE.Mesh(
        getRingGeometry(boss.size * 1.3, boss.size * 1.5, 32),
        ringMat
    );
    outerRing.rotation.x = Math.PI / 2;
    group.add(outerRing);
    
    // Inner charging ring (spins opposite direction)
    const innerRing = new THREE.Mesh(
        getRingGeometry(boss.size * 0.8, boss.size * 1.0, 32),
        ringMat.clone()
    );
    innerRing.rotation.x = Math.PI / 2;
    group.add(innerRing);
    
    // Downward arrow indicator (shows slam intent)
    const arrowMat = new THREE.MeshBasicMaterial({
        color: VISUAL_COLORS.DANGER_RED,
        transparent: true,
        opacity: 0.8
    });
    const arrow = new THREE.Mesh(
        getConeGeometry(0.6, 1.8, 4),
        arrowMat
    );
    arrow.rotation.x = Math.PI;  // Point downward
    arrow.position.y = -boss.size * 1.8;
    group.add(arrow);
    
    // Energy particles rising (visual charge buildup)
    const particleGeom = getSphereGeometry(0.15, 8);
    const particleMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.6
    });
    
    group.particles = [];
    for (let i = 0; i < 6; i++) {
        const particle = new THREE.Mesh(particleGeom, particleMat.clone());
        const angle = (i / 6) * Math.PI * 2;
        particle.userData.angle = angle;
        particle.userData.baseY = -boss.size;
        group.add(particle);
        group.particles.push(particle);
    }
    
    // Store references for animation
    group.outerRing = outerRing;
    group.innerRing = innerRing;
    group.arrow = arrow;
    group.bossSize = boss.size;
    group.createdTime = Date.now();
    
    // Position above boss
    group.position.copy(boss.position);
    group.position.y += boss.size * 2.5;
    
    scene.add(group);
    return group;
}

export function updatePerchChargeVFX(vfx, progress, boss) {
    if (!vfx) return;
    
    const elapsed = (Date.now() - vfx.createdTime) / 1000;
    const bossSize = vfx.bossSize || 2.8;
    
    // Update position to follow boss
    if (boss) {
        vfx.position.copy(boss.position);
        vfx.position.y = boss.position.y + bossSize * 1.5;
    }
    
    // Spin rings (faster as charge progresses)
    const spinSpeed = 0.02 + progress * 0.08;
    if (vfx.outerRing) {
        vfx.outerRing.rotation.z += spinSpeed;
        vfx.outerRing.material.opacity = 0.4 + progress * 0.4;
    }
    if (vfx.innerRing) {
        vfx.innerRing.rotation.z -= spinSpeed * 1.5;
        vfx.innerRing.material.opacity = 0.3 + progress * 0.5;
    }
    
    // Arrow bobs and gets more intense
    if (vfx.arrow) {
        const bobSpeed = 3 + progress * 5;
        const bobAmount = 0.2 + progress * 0.3;
        vfx.arrow.position.y = -bossSize * 1.8 + Math.sin(elapsed * bobSpeed) * bobAmount;
        vfx.arrow.material.opacity = 0.6 + progress * 0.4;
        
        // Scale up arrow as charge completes
        const arrowScale = 1 + progress * 0.5;
        vfx.arrow.scale.setScalar(arrowScale);
    }
    
    // Animate particles spiraling upward
    if (vfx.particles) {
        vfx.particles.forEach((particle, i) => {
            const angle = particle.userData.angle + elapsed * (2 + progress * 3);
            const radius = bossSize * (1.2 - progress * 0.3);
            const yOffset = ((elapsed * 2 + i * 0.5) % 2) * bossSize - bossSize;
            
            particle.position.x = Math.cos(angle) * radius;
            particle.position.z = Math.sin(angle) * radius;
            particle.position.y = yOffset;
            particle.material.opacity = 0.4 + progress * 0.4;
        });
    }
}

// ==================== TELEPORT VFX ====================

export function createTeleportOriginVFX(position) {
    const group = new THREE.Group();
    
    // Shimmer effect (expanding ring) - use cached geometry
    const shimmerGeom = getRingGeometry(0.5, 1, 16);
    const shimmerMat = new THREE.MeshBasicMaterial({
        color: VISUAL_COLORS.TELEPORT_PURPLE,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide
    });
    
    for (let i = 0; i < 3; i++) {
        const shimmer = new THREE.Mesh(shimmerGeom, shimmerMat.clone());
        shimmer.rotation.x = -Math.PI / 2;
        shimmer.position.y = i * 0.3;
        group.add(shimmer);
    }
    
    group.position.copy(position);
    group.createdTime = Date.now();
    scene.add(group);
    
    return group;
}

export function createTeleportDestinationVFX(position) {
    const group = new THREE.Group();
    const targetHeight = position.y;
    
    // Ground ring (always at ground level for visibility)
    const groundRingMat = new THREE.MeshBasicMaterial({
        color: VISUAL_COLORS.TELEPORT_PURPLE,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide
    });
    const groundRing = new THREE.Mesh(
        getRingGeometry(2, 2.5, 32),
        groundRingMat
    );
    groundRing.rotation.x = -Math.PI / 2;
    groundRing.position.y = 0.1;
    group.add(groundRing);
    group.groundRing = groundRing;
    
    // Inner sigil (rotating) - use cached geometry
    const sigilMat = new THREE.MeshBasicMaterial({
        color: VISUAL_COLORS.TELEPORT_PURPLE,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide
    });
    const sigil = new THREE.Mesh(getRingGeometry(1, 1.5, 6), sigilMat);
    sigil.rotation.x = -Math.PI / 2;
    sigil.position.y = 0.15;
    group.add(sigil);
    group.innerSigil = sigil;
    
    // Dynamic vertical beam (scales to target height for elevated destinations)
    const beamHeight = Math.max(4, targetHeight + 2);
    const beamMat = new THREE.MeshBasicMaterial({
        color: targetHeight > 2 ? 0xffffff : VISUAL_COLORS.TELEPORT_PURPLE,  // White for elevated
        transparent: true,
        opacity: targetHeight > 2 ? 0.6 : 0.4
    });
    const beam = new THREE.Mesh(
        getCylinderGeometry(0.15, 0.3, beamHeight, 8),
        beamMat
    );
    beam.position.y = beamHeight / 2;
    group.add(beam);
    group.beam = beam;
    
    // Arrival sphere at actual destination (shows where boss will appear)
    const arrivalMat = new THREE.MeshBasicMaterial({
        color: VISUAL_COLORS.TELEPORT_PURPLE,
        transparent: true,
        opacity: 0.4,
        wireframe: true
    });
    const arrivalSphere = new THREE.Mesh(
        getSphereGeometry(1.5, 16),
        arrivalMat
    );
    arrivalSphere.position.y = targetHeight;
    group.add(arrivalSphere);
    group.arrivalSphere = arrivalSphere;
    
    // Store target height for animation
    group.targetHeight = targetHeight;
    group.pulsePhase = 0;
    
    group.position.set(position.x, 0, position.z);
    scene.add(group);
    
    return group;
}

export function updateTeleportDestinationVFX(vfx) {
    if (!vfx) return;
    
    vfx.pulsePhase += 0.15;
    
    // Rotate inner sigil
    if (vfx.innerSigil) {
        vfx.innerSigil.rotation.z += 0.08;
    }
    
    // Pulse ground ring
    if (vfx.groundRing) {
        const pulse = 0.7 + Math.sin(vfx.pulsePhase) * 0.3;
        vfx.groundRing.material.opacity = pulse;
        vfx.groundRing.scale.setScalar(1 + Math.sin(vfx.pulsePhase * 0.5) * 0.1);
    }
    
    // Spin and pulse arrival sphere
    if (vfx.arrivalSphere) {
        vfx.arrivalSphere.rotation.y += 0.1;
        vfx.arrivalSphere.rotation.x += 0.03;
        const spherePulse = 1 + Math.sin(vfx.pulsePhase * 2) * 0.15;
        vfx.arrivalSphere.scale.setScalar(spherePulse);
    }
    
    // Pulse beam opacity for elevated destinations
    if (vfx.beam && vfx.targetHeight > 2) {
        const beamPulse = 0.4 + Math.sin(vfx.pulsePhase * 1.5) * 0.3;
        vfx.beam.material.opacity = beamPulse;
    }
}

// ==================== BURROW VFX ====================

export function createEmergeWarningVFX(position) {
    const group = new THREE.Group();
    
    // Ground crack pattern - use cached geometry
    const crackGeom = getRingGeometry(0.5, 5, 8);
    const crackMat = new THREE.MeshBasicMaterial({
        color: VISUAL_COLORS.BURROW_BROWN,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide
    });
    const crack = new THREE.Mesh(crackGeom, crackMat);
    crack.rotation.x = -Math.PI / 2;
    group.add(crack);
    
    // Pulsing inner circle - use cached geometry
    const pulseGeom = getCircleGeometry(2, 16);
    const pulseMat = new THREE.MeshBasicMaterial({
        color: VISUAL_COLORS.DANGER_RED,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide
    });
    const pulse = new THREE.Mesh(pulseGeom, pulseMat);
    pulse.rotation.x = -Math.PI / 2;
    group.add(pulse);
    group.pulse = pulse;
    
    // TALL VERTICAL BEAM - visible over corridor walls (15 units tall)
    const beamHeight = 15;
    const beamGeom = getCylinderGeometry(0.5, 2, beamHeight, 8);
    const beamMat = new THREE.MeshBasicMaterial({
        color: 0xff44ff,  // Magenta (Burrower color)
        transparent: true,
        opacity: 0.3
    });
    const beam = new THREE.Mesh(beamGeom, beamMat);
    beam.position.y = beamHeight / 2;
    group.add(beam);
    group.beam = beam;
    
    // DANGER ZONE CIRCLE - shows actual damage radius (5 units)
    const dangerGeom = getCircleGeometry(5, 32);
    const dangerMat = new THREE.MeshBasicMaterial({
        color: VISUAL_COLORS.DANGER_RED,
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide
    });
    const dangerZone = new THREE.Mesh(dangerGeom, dangerMat);
    dangerZone.rotation.x = -Math.PI / 2;
    dangerZone.position.y = 0.05;
    group.add(dangerZone);
    group.dangerZone = dangerZone;
    
    // ESCAPE ARROWS - green arrows pointing outward (visual hint to dodge)
    const escapeArrows = [];
    for (let i = 0; i < 4; i++) {
        const arrowGeom = getConeGeometry(0.4, 1, 4);
        const arrowMat = new THREE.MeshBasicMaterial({
            color: 0x44ff44,  // Green = escape
            transparent: true,
            opacity: 0.6
        });
        const escapeArrow = new THREE.Mesh(arrowGeom, arrowMat);
        const angle = (i / 4) * Math.PI * 2;
        escapeArrow.position.set(
            Math.cos(angle) * 6.5,
            0.15,
            Math.sin(angle) * 6.5
        );
        // Point outward
        escapeArrow.rotation.x = Math.PI / 2;
        escapeArrow.rotation.z = -angle;
        group.add(escapeArrow);
        escapeArrows.push(escapeArrow);
    }
    group.escapeArrows = escapeArrows;
    
    // Directional arrow (pointing down at emerge point)
    const arrowGeom = getConeGeometry(0.5, 1.5, 4);
    const arrowMat = new THREE.MeshBasicMaterial({
        color: VISUAL_COLORS.DANGER_RED,
        transparent: true,
        opacity: 0.8
    });
    const arrow = new THREE.Mesh(arrowGeom, arrowMat);
    arrow.rotation.x = Math.PI / 2;
    arrow.position.z = -3;
    group.add(arrow);
    
    group.position.copy(position);
    group.position.y = 0.1;
    group.createdTime = Date.now();
    group.baseX = position.x;  // Store base position for shake
    group.baseZ = position.z;
    scene.add(group);
    
    return group;
}

export function updateEmergeWarningVFX(vfx, timer) {
    if (!vfx || !vfx.pulse) return;
    
    const warningTime = 45;  // Total warning duration
    const progress = Math.min(1, timer / warningTime);
    
    // Pulse effect - faster as emerge approaches
    const pulseSpeed = 0.3 + progress * 0.3;
    const pulseScale = 1 + Math.sin(timer * pulseSpeed) * 0.3;
    vfx.pulse.scale.setScalar(pulseScale);
    
    // Increasing opacity as emerge approaches
    vfx.pulse.material.opacity = 0.4 + progress * 0.4;
    
    // BEAM - gets brighter as emerge approaches
    if (vfx.beam) {
        vfx.beam.material.opacity = 0.2 + progress * 0.5;
        // Subtle pulse on the beam
        const beamPulse = 1 + Math.sin(timer * 0.2) * 0.1;
        vfx.beam.scale.x = beamPulse;
        vfx.beam.scale.z = beamPulse;
    }
    
    // DANGER ZONE - pulses faster as emerge approaches
    if (vfx.dangerZone) {
        const dangerPulseSpeed = 0.15 + progress * 0.25;
        vfx.dangerZone.material.opacity = 0.2 + Math.sin(timer * dangerPulseSpeed) * 0.15 + progress * 0.2;
    }
    
    // ESCAPE ARROWS - pulse outward animation
    if (vfx.escapeArrows) {
        const arrowPulse = 6.5 + Math.sin(timer * 0.2) * 0.5;
        vfx.escapeArrows.forEach((arrow, i) => {
            const angle = (i / 4) * Math.PI * 2;
            arrow.position.x = Math.cos(angle) * arrowPulse;
            arrow.position.z = Math.sin(angle) * arrowPulse;
            // Fade out as emerge approaches (player should have dodged by now)
            arrow.material.opacity = Math.max(0.2, 0.6 * (1 - progress * 0.5));
        });
    }
    
    // Shake effect when close to emerge
    if (timer > 30) {
        const shakeIntensity = (timer - 30) / 15 * 0.15;  // Ramp up shake
        vfx.position.x = vfx.baseX + (Math.random() - 0.5) * shakeIntensity;
        vfx.position.z = vfx.baseZ + (Math.random() - 0.5) * shakeIntensity;
    }
}

// Create VFX when boss starts burrowing (dirt spray particles)
export function createBurrowStartVFX(boss) {
    const group = new THREE.Group();
    
    // Dirt spray particles in a ring around the boss
    const particleCount = 12;
    for (let i = 0; i < particleCount; i++) {
        const particleGeom = getSphereGeometry(0.3, 8);
        const particleMat = new THREE.MeshBasicMaterial({
            color: VISUAL_COLORS.BURROW_BROWN,
            transparent: true,
            opacity: 0.8
        });
        const particle = new THREE.Mesh(particleGeom, particleMat);
        
        const angle = (i / particleCount) * Math.PI * 2;
        const bossRadius = boss.size * (boss.growthScale || 1);
        particle.position.set(
            Math.cos(angle) * bossRadius * 1.2,
            0,
            Math.sin(angle) * bossRadius * 1.2
        );
        
        // Store velocity for animation
        particle.velocity = new THREE.Vector3(
            Math.cos(angle) * 0.1,
            0.15 + Math.random() * 0.1,
            Math.sin(angle) * 0.1
        );
        
        group.add(particle);
    }
    
    // Ground crack ring effect
    const crackGeom = getRingGeometry(boss.size * 0.8, boss.size * 1.5, 12);
    const crackMat = new THREE.MeshBasicMaterial({
        color: VISUAL_COLORS.BURROW_BROWN,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide
    });
    const crack = new THREE.Mesh(crackGeom, crackMat);
    crack.rotation.x = -Math.PI / 2;
    crack.position.y = 0.05;
    group.add(crack);
    group.crack = crack;
    
    group.position.copy(boss.position);
    group.position.y = 0;
    group.createdTime = Date.now();
    scene.add(group);
    
    return group;
}

// Update burrow start VFX (dirt particles flying up and falling)
export function updateBurrowStartVFX(vfx, bossY) {
    if (!vfx) return;
    
    // Update dirt particles
    vfx.children.forEach((child, i) => {
        if (child.velocity) {
            // Move particle
            child.position.add(child.velocity);
            
            // Apply gravity
            child.velocity.y -= 0.01;
            
            // Fade out
            if (child.material) {
                child.material.opacity -= 0.02;
            }
        }
    });
    
    // Expand and fade crack ring
    if (vfx.crack) {
        vfx.crack.scale.setScalar(vfx.crack.scale.x + 0.02);
        vfx.crack.material.opacity -= 0.015;
    }
}

// ==================== SHIELD VFX ====================

export function createShieldBubble(parent, size, color = VISUAL_COLORS.SHIELD_BLUE) {
    // Use cached geometry for shield bubble
    const shieldGeometry = getSphereGeometry(size * 1.3, 16);
    const shieldMaterial = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
        wireframe: false
    });
    
    const shieldMesh = new THREE.Mesh(shieldGeometry, shieldMaterial);
    shieldMesh.name = 'shieldBubble';
    parent.add(shieldMesh);
    
    return shieldMesh;
}

export function updateShieldVisual(shieldMesh, shieldPercent) {
    if (!shieldMesh) return;
    
    // Scale down as shield depletes
    shieldMesh.scale.setScalar(0.7 + shieldPercent * 0.3);
    
    // Reduce opacity as shield depletes
    shieldMesh.material.opacity = 0.3 + shieldPercent * 0.3;
    
    // Flicker when low (< 30%)
    if (shieldPercent < 0.3) {
        shieldMesh.visible = Math.random() > 0.2;
    } else {
        shieldMesh.visible = true;
    }
}

// ==================== SUCCESS FEEDBACK ====================

// Slow-mo state (SLOW_MO_LERP_SPEED imported from constants.js)
let slowMoActive = false;
let slowMoTimer = 0;
let slowMoTimeScale = 1.0;
let slowMoTargetScale = 1.0;

// Camera cinematic state
let cinematicActive = false;
let cinematicTimer = 0;
let cinematicTarget = null;
let cinematicReturnToPlayer = true;
let preCinematicCameraPos = null;

export function triggerSlowMo(durationFrames = 30, timeScale = 0.3) {
    slowMoActive = true;
    slowMoTimer = durationFrames;
    slowMoTargetScale = timeScale;
}

export function updateSlowMo() {
    if (slowMoActive) {
        // Smoothly interpolate time scale
        slowMoTimeScale += (slowMoTargetScale - slowMoTimeScale) * SLOW_MO_LERP_SPEED;
        
        slowMoTimer--;
        if (slowMoTimer <= 0) {
            slowMoActive = false;
            slowMoTargetScale = 1.0;
        }
    } else {
        // Smoothly return to normal speed
        slowMoTimeScale += (1.0 - slowMoTimeScale) * SLOW_MO_LERP_SPEED;
        if (Math.abs(slowMoTimeScale - 1.0) < 0.01) {
            slowMoTimeScale = 1.0;
        }
    }
}

export function isSlowMoActive() {
    return slowMoActive;
}

export function getTimeScale() {
    return slowMoTimeScale;
}

// ==================== CINEMATIC CAMERA ====================

export function startCinematic(target, durationFrames = 180, returnToPlayer = true) {
    cinematicActive = true;
    cinematicTimer = durationFrames;
    cinematicTarget = target;
    cinematicReturnToPlayer = returnToPlayer;
    preCinematicCameraPos = null; // Will be set on first update
}

export function updateCinematic(camera, player) {
    if (!cinematicActive || !cinematicTarget) return false;
    
    // Store original camera position on first frame
    if (!preCinematicCameraPos) {
        preCinematicCameraPos = camera.position.clone();
    }
    
    cinematicTimer--;
    
    // Calculate cinematic camera position (orbit around target)
    const progress = 1 - (cinematicTimer / 180); // 0 to 1 over duration
    const orbitAngle = progress * Math.PI * 0.5; // Quarter orbit
    const orbitRadius = 12;
    const orbitHeight = 6;
    
    // Cinematic camera position
    const targetX = cinematicTarget.position.x + Math.sin(orbitAngle) * orbitRadius;
    const targetZ = cinematicTarget.position.z + Math.cos(orbitAngle) * orbitRadius;
    const targetY = cinematicTarget.position.y + orbitHeight;
    
    // Smooth camera movement
    camera.position.x += (targetX - camera.position.x) * 0.05;
    camera.position.y += (targetY - camera.position.y) * 0.05;
    camera.position.z += (targetZ - camera.position.z) * 0.05;
    
    // Look at target
    camera.lookAt(
        cinematicTarget.position.x,
        cinematicTarget.position.y + 2,
        cinematicTarget.position.z
    );
    
    // End cinematic
    if (cinematicTimer <= 0) {
        cinematicActive = false;
        cinematicTarget = null;
        return false;
    }
    
    return true; // Cinematic is active, skip normal camera update
}

export function isCinematicActive() {
    return cinematicActive;
}

export function endCinematic() {
    cinematicActive = false;
    cinematicTimer = 0;
    cinematicTarget = null;
}

// Screen flash effect
let screenFlashActive = false;
let screenFlashTimer = 0;
let screenFlashColor = 0xffffff;

export function triggerScreenFlash(color = 0xffffff, duration = 6) {
    screenFlashActive = true;
    screenFlashTimer = duration;
    screenFlashColor = color;
}

export function getScreenFlashOpacity() {
    if (!screenFlashActive) return 0;
    return (screenFlashTimer / 6) * 0.3; // Max 30% opacity
}

export function updateScreenFlash() {
    if (screenFlashActive) {
        screenFlashTimer--;
        if (screenFlashTimer <= 0) {
            screenFlashActive = false;
        }
    }
}

// ==================== EXPOSED STATE VFX ====================

export function createExposedVFX(target) {
    if (!target) return null;
    
    // Add shimmer effect - use cached geometry
    const shimmerGeom = getSphereGeometry(target.size * 1.4, 16);
    const shimmerMat = new THREE.MeshBasicMaterial({
        color: VISUAL_COLORS.EXPOSED_GOLD,
        transparent: true,
        opacity: 0.3,
        side: THREE.FrontSide
    });
    
    const shimmer = new THREE.Mesh(shimmerGeom, shimmerMat);
    shimmer.name = 'exposedShimmer';
    target.add(shimmer);
    
    return shimmer;
}

export function updateExposedVFX(shimmer, timer) {
    if (!shimmer) return;
    
    // Flash effect
    const flashRate = ANIMATION_TIMINGS.exposedFlashRate;
    if (timer % flashRate < flashRate / 2) {
        shimmer.material.opacity = 0.5;
    } else {
        shimmer.material.opacity = 0.2;
    }
    
    // Rotate
    shimmer.rotation.y += 0.05;
}

// ==================== WARNING INDICATORS ====================
// NOTE: Reserved for future use - generic warning icon system for telegraphing
// non-positional hazards (e.g., incoming projectiles, environmental dangers).
// Currently unused but retained for planned warning indicator feature.

export function createWarningIcon(position) {
    const group = new THREE.Group();
    
    // Warning triangle - this shape is unique, cache it
    const triangleGeom = getCachedGeometry('warningTriangle', () => {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0.5);
        shape.lineTo(-0.4, -0.5);
        shape.lineTo(0.4, -0.5);
        shape.lineTo(0, 0.5);
        return new THREE.ShapeGeometry(shape);
    });
    
    const mat = new THREE.MeshBasicMaterial({
        color: VISUAL_COLORS.WARNING_ORANGE,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide
    });
    
    const triangle = new THREE.Mesh(triangleGeom, mat);
    triangle.rotation.x = -Math.PI / 2;
    group.add(triangle);
    
    // Exclamation mark - use cached geometry
    const markGeom = getPlaneGeometry(0.1, 0.3);
    const mark = new THREE.Mesh(markGeom, mat.clone());
    mark.rotation.x = -Math.PI / 2;
    mark.position.y = 0.1;
    group.add(mark);
    
    group.position.copy(position);
    group.position.y = 2;
    group.createdTime = Date.now();
    scene.add(group);
    
    return group;
}

export function updateWarningIcon(icon) {
    if (!icon) return;
    
    const elapsed = (Date.now() - icon.createdTime) / 1000;
    
    // Bob up and down
    icon.position.y = 2 + Math.sin(elapsed * 5) * 0.2;
    
    // Rotate
    icon.rotation.y += 0.05;
}

// ==================== CHARGE PATH TELEGRAPH ====================
// Used by: boss.js (charge wind-up state)

export function createChargePathMarker(startPos, direction, length = 15) {
    const group = new THREE.Group();
    
    // Main path indicator (rectangle on ground) - use cached geometry
    const pathGeom = getPlaneGeometry(length, 2);
    const pathMat = new THREE.MeshBasicMaterial({
        color: VISUAL_COLORS.DANGER_RED,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide
    });
    const pathMesh = new THREE.Mesh(pathGeom, pathMat);
    pathMesh.rotation.x = -Math.PI / 2;
    pathMesh.position.y = 0.1;
    pathMesh.position.z = length / 2;
    group.add(pathMesh);
    
    // Arrow head - use cached geometry
    const arrowGeom = getConeGeometry(1.5, 3, 4);
    const arrowMat = new THREE.MeshBasicMaterial({
        color: VISUAL_COLORS.DANGER_RED,
        transparent: true,
        opacity: 0.7
    });
    const arrow = new THREE.Mesh(arrowGeom, arrowMat);
    arrow.rotation.x = Math.PI / 2;
    arrow.position.z = length + 1.5;
    arrow.position.y = 0.5;
    group.add(arrow);
    
    // Chevron lines along path - cache chevron geometry
    const chevronGeom = getCachedGeometry('chargeChevron', () => {
        const geom = new THREE.BufferGeometry();
        const points = [
            new THREE.Vector3(-0.8, 0.15, 0),
            new THREE.Vector3(0, 0.15, 0.8),
            new THREE.Vector3(0.8, 0.15, 0)
        ];
        geom.setFromPoints(points);
        return geom;
    });
    
    for (let i = 0; i < 3; i++) {
        const chevron = new THREE.Line(chevronGeom, new THREE.LineBasicMaterial({
            color: VISUAL_COLORS.DANGER_RED,
            transparent: true,
            opacity: 0.8
        }));
        chevron.position.z = 3 + i * 4;
        group.add(chevron);
    }
    
    // Position and rotate to face direction
    group.position.copy(startPos);
    group.position.y = 0;
    const angle = Math.atan2(direction.x, direction.z);
    group.rotation.y = angle;
    
    group.createdAt = Date.now();
    group.lifespan = 1000; // 1 second
    
    scene.add(group);
    return group;
}

export function updateChargePathMarker(marker, progress = 0) {
    if (!marker) return;
    
    // Pulse opacity
    const pulse = 0.5 + Math.sin(Date.now() * 0.01) * 0.3;
    marker.children.forEach(child => {
        if (child.material) {
            child.material.opacity = pulse * (1 - progress * 0.5);
        }
    });
}

// ==================== HAZARD PREVIEW CIRCLE ====================
// Used by: boss.js (hazards ability preview)

export function createHazardPreviewCircle(position, radius = 4) {
    const group = new THREE.Group();
    
    // Outer ring - use cached geometry
    const outerGeom = getRingGeometry(radius - 0.3, radius, 32);
    const outerMat = new THREE.MeshBasicMaterial({
        color: VISUAL_COLORS.WARNING_ORANGE,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide
    });
    const outerRing = new THREE.Mesh(outerGeom, outerMat);
    outerRing.rotation.x = -Math.PI / 2;
    outerRing.position.y = 0.1;
    group.add(outerRing);
    
    // Inner pulsing circle - use cached geometry
    const innerGeom = getCircleGeometry(radius * 0.8, 32);
    const innerMat = new THREE.MeshBasicMaterial({
        color: VISUAL_COLORS.WARNING_ORANGE,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide
    });
    const innerCircle = new THREE.Mesh(innerGeom, innerMat);
    innerCircle.rotation.x = -Math.PI / 2;
    innerCircle.position.y = 0.05;
    group.add(innerCircle);
    
    // Warning icon in center - use cached geometry
    const iconGeom = getCircleGeometry(0.5, 6);
    const iconMat = new THREE.MeshBasicMaterial({
        color: VISUAL_COLORS.DANGER_RED,
        transparent: true,
        opacity: 0.8
    });
    const icon = new THREE.Mesh(iconGeom, iconMat);
    icon.rotation.x = -Math.PI / 2;
    icon.position.y = 0.15;
    group.add(icon);
    
    group.position.set(position.x, 0, position.z);
    group.createdAt = Date.now();
    group.radius = radius;
    
    // Store explicit references for animation (avoid children index dependency)
    group.outerRing = outerRing;
    group.innerCircle = innerCircle;
    group.icon = icon;
    
    scene.add(group);
    return group;
}

export function updateHazardPreviewCircle(marker) {
    if (!marker) return;
    
    const elapsed = Date.now() - marker.createdAt;
    const pulse = 0.4 + Math.sin(elapsed * 0.008) * 0.3;
    
    // Pulse inner circle - use stored reference
    if (marker.innerCircle && marker.innerCircle.material) {
        marker.innerCircle.material.opacity = pulse;
        marker.innerCircle.scale.setScalar(0.8 + Math.sin(elapsed * 0.01) * 0.1);
    }
    
    // Rotate outer ring - use stored reference
    if (marker.outerRing) {
        marker.outerRing.rotation.z += 0.02;
    }
}

// ==================== LANE WALL PREVIEW ====================
// Used by: boss.js (lane walls ability preview)

export function createLaneWallPreview(position, angle, length = 20, height = 4) {
    const group = new THREE.Group();
    
    // Ground footprint (danger zone) - highly visible from any angle
    const footprintGeom = getPlaneGeometry(length, 2);
    const footprintMat = new THREE.MeshBasicMaterial({
        color: VISUAL_COLORS.DANGER_RED,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide
    });
    const footprint = new THREE.Mesh(footprintGeom, footprintMat);
    footprint.rotation.x = -Math.PI / 2;
    footprint.position.y = 0.1;
    group.add(footprint);
    
    // Wireframe preview of wall - use cached geometry
    const wallGeom = getBoxGeometry(length, height, 1);
    const wallMat = new THREE.MeshBasicMaterial({
        color: VISUAL_COLORS.DANGER_RED,
        transparent: true,
        opacity: 0.3,
        wireframe: true
    });
    const wallMesh = new THREE.Mesh(wallGeom, wallMat);
    wallMesh.position.y = height / 2;
    group.add(wallMesh);
    
    // Solid translucent fill - use cached geometry (same dims)
    const fillMat = new THREE.MeshBasicMaterial({
        color: VISUAL_COLORS.DANGER_RED,
        transparent: true,
        opacity: 0.2
    });
    const fillMesh = new THREE.Mesh(wallGeom, fillMat);
    fillMesh.position.y = height / 2;
    group.add(fillMesh);
    
    // Warning pillars at wall endpoints
    const pillarGeom = getCylinderGeometry(0.4, 0.4, height, 8);
    const pillarMat = new THREE.MeshBasicMaterial({
        color: VISUAL_COLORS.DANGER_RED,
        transparent: true,
        opacity: 0.7
    });
    
    const pillars = [];
    [-1, 1].forEach(side => {
        const pillar = new THREE.Mesh(pillarGeom, pillarMat.clone());
        pillar.position.set(side * (length / 2), height / 2, 0);
        group.add(pillar);
        pillars.push(pillar);
    });
    
    // Bottom edge glow - use cached geometry
    const edgeGeom = getPlaneGeometry(length, 0.8);
    const edgeMat = new THREE.MeshBasicMaterial({
        color: VISUAL_COLORS.DANGER_RED,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide
    });
    const edge = new THREE.Mesh(edgeGeom, edgeMat);
    edge.rotation.x = -Math.PI / 2;
    edge.position.y = 0.15;
    group.add(edge);
    
    group.position.copy(position);
    group.rotation.y = angle;
    group.createdAt = Date.now();
    
    // Store references for animation (avoid children index dependency)
    group.wallMesh = wallMesh;
    group.fillMesh = fillMesh;
    group.footprint = footprint;
    group.pillars = pillars;
    group.edge = edge;
    
    scene.add(group);
    return group;
}

export function updateLaneWallPreview(marker, progress = 0) {
    if (!marker) return;
    
    const elapsed = Date.now() - marker.createdAt;
    
    // Pulse speed increases as spawn approaches (urgency)
    const pulseSpeed = 0.01 + progress * 0.02;
    const pulse = 0.4 + Math.sin(elapsed * pulseSpeed) * 0.3;
    
    // Update fill mesh opacity - gets more opaque as spawn approaches
    if (marker.fillMesh && marker.fillMesh.material) {
        marker.fillMesh.material.opacity = pulse * (0.3 + progress * 0.5);
    }
    
    // Update footprint - pulsing ground indicator
    if (marker.footprint && marker.footprint.material) {
        marker.footprint.material.opacity = 0.3 + progress * 0.4 + Math.sin(elapsed * pulseSpeed * 1.5) * 0.2;
    }
    
    // Update edge opacity
    if (marker.edge && marker.edge.material) {
        marker.edge.material.opacity = pulse * (0.5 + progress * 0.5);
    }
    
    // Animate pillars - pulse and glow more intensely as spawn approaches
    if (marker.pillars) {
        marker.pillars.forEach((pillar, i) => {
            if (pillar.material) {
                pillar.material.opacity = 0.5 + progress * 0.4 + Math.sin(elapsed * pulseSpeed * 2 + i) * 0.2;
            }
        });
    }
    
    // Scale up slightly as spawn approaches
    const scaleProgress = 0.85 + progress * 0.15;
    marker.scale.setScalar(scaleProgress);
}

// ==================== RUSH TELEGRAPH (Enemy) ====================
// Used by: enemies.js (shieldBreaker rush windup)

export function createRushTelegraph(enemy, targetPos) {
    const group = new THREE.Group();
    
    const direction = new THREE.Vector3()
        .subVectors(targetPos, enemy.position)
        .normalize();
    
    // Speed lines - cache line geometries
    for (let i = 0; i < 4; i++) {
        const offset = (i - 1.5) * 0.4;
        const lineLength = 2 + i * 0.5;
        const lineKey = `rushLine_${offset.toFixed(2)}_${lineLength.toFixed(2)}`;
        
        const lineGeom = getCachedGeometry(lineKey, () => {
            const geom = new THREE.BufferGeometry();
            const points = [
                new THREE.Vector3(offset, 0.3, 0),
                new THREE.Vector3(offset, 0.3, -lineLength)
            ];
            geom.setFromPoints(points);
            return geom;
        });
        
        const lineMat = new THREE.LineBasicMaterial({
            color: VISUAL_COLORS.WARNING_ORANGE,
            transparent: true,
            opacity: 0.8 - i * 0.15
        });
        const line = new THREE.Line(lineGeom, lineMat);
        group.add(line);
    }
    
    // Position at enemy and face target
    group.position.copy(enemy.position);
    const angle = Math.atan2(direction.x, direction.z);
    group.rotation.y = angle;
    
    group.createdAt = Date.now();
    group.parentEnemy = enemy;
    
    scene.add(group);
    return group;
}

export function updateRushTelegraph(telegraph) {
    if (!telegraph || !telegraph.parentEnemy) return;
    
    // Follow enemy position
    telegraph.position.copy(telegraph.parentEnemy.position);
    
    // Animate lines
    const elapsed = Date.now() - telegraph.createdAt;
    telegraph.children.forEach((line, i) => {
        if (line.material) {
            line.material.opacity = 0.6 + Math.sin(elapsed * 0.02 + i) * 0.3;
        }
        // Stretch effect
        line.scale.z = 1 + Math.sin(elapsed * 0.015) * 0.3;
    });
}

// ==================== BOSS GROWTH INDICATOR ====================
// Used by: boss.js (growth ability - Boss 4 THE OVERGROWTH)

export function createGrowthIndicator(boss) {
    const group = new THREE.Group();
    const bossSize = boss.size || 3.2;
    const bossColor = boss.baseColor || 0x44ffff;
    
    // Expanding ring at boss feet showing current threat radius
    const ringGeom = getRingGeometry(bossSize, bossSize + 0.4, 32);
    const ringMat = new THREE.MeshBasicMaterial({
        color: bossColor,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.1;
    group.add(ring);
    
    // Outer warning ring (shows max growth radius)
    const maxRadius = bossSize * 1.5;  // Max growth scale
    const outerRingGeom = getRingGeometry(maxRadius - 0.2, maxRadius + 0.2, 32);
    const outerRingMat = new THREE.MeshBasicMaterial({
        color: VISUAL_COLORS.WARNING_ORANGE,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
    });
    const outerRing = new THREE.Mesh(outerRingGeom, outerRingMat);
    outerRing.rotation.x = -Math.PI / 2;
    outerRing.position.y = 0.05;
    group.add(outerRing);
    
    // Pulsing glow particles around boss
    const particleGeom = getSphereGeometry(0.2, 8);
    const particleMat = new THREE.MeshBasicMaterial({
        color: bossColor,
        transparent: true,
        opacity: 0.7
    });
    
    group.particles = [];
    for (let i = 0; i < 8; i++) {
        const particle = new THREE.Mesh(particleGeom, particleMat.clone());
        const angle = (i / 8) * Math.PI * 2;
        particle.userData.baseAngle = angle;
        particle.userData.baseRadius = bossSize * 1.2;
        group.add(particle);
        group.particles.push(particle);
    }
    
    // Store references
    group.ring = ring;
    group.outerRing = outerRing;
    group.bossSize = bossSize;
    group.bossColor = bossColor;
    group.createdAt = Date.now();
    
    scene.add(group);
    return group;
}

export function updateGrowthIndicator(indicator, growthScale, boss) {
    if (!indicator || !boss) return;
    
    const elapsed = (Date.now() - indicator.createdAt) / 1000;
    const bossSize = indicator.bossSize;
    
    // Follow boss position
    indicator.position.copy(boss.position);
    indicator.position.y = 0;
    
    // Update inner ring to show current threat radius using scale (avoids geometry recreation)
    if (indicator.ring) {
        // Scale the ring instead of recreating geometry - base geometry is at bossSize radius
        indicator.ring.scale.setScalar(growthScale);
        
        // Pulse opacity
        indicator.ring.material.opacity = 0.5 + Math.sin(elapsed * 8) * 0.3;
    }
    
    // Pulse outer warning ring
    if (indicator.outerRing) {
        indicator.outerRing.material.opacity = 0.2 + Math.sin(elapsed * 4) * 0.15;
        indicator.outerRing.rotation.z += 0.01;
    }
    
    // Animate particles spiraling around boss
    if (indicator.particles) {
        const currentRadius = bossSize * growthScale;
        indicator.particles.forEach((particle, i) => {
            const baseAngle = particle.userData.baseAngle;
            const angle = baseAngle + elapsed * 2;
            const radius = currentRadius + Math.sin(elapsed * 3 + i) * 0.5;
            const yOffset = Math.sin(elapsed * 4 + i * 0.5) * 0.5;
            
            particle.position.x = Math.cos(angle) * radius;
            particle.position.z = Math.sin(angle) * radius;
            particle.position.y = 1 + yOffset;
            
            // Pulse particle opacity
            particle.material.opacity = 0.5 + Math.sin(elapsed * 6 + i) * 0.3;
        });
    }
}

// ==================== BOSS SPLIT WARNING VFX ====================
// Used by: boss.js (split ability - Boss 4 THE OVERGROWTH)

export function createSplitWarningVFX(boss) {
    const group = new THREE.Group();
    const bossSize = boss.size || 3.2;
    const bossColor = boss.baseColor || 0x44ffff;
    
    // Cracking effect - lines radiating from center
    const crackMat = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.8
    });
    
    group.cracks = [];
    for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const crackGeom = new THREE.BufferGeometry();
        const points = [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(Math.cos(angle) * bossSize * 0.8, 0, Math.sin(angle) * bossSize * 0.8)
        ];
        crackGeom.setFromPoints(points);
        const crack = new THREE.Line(crackGeom, crackMat.clone());
        crack.userData.angle = angle;
        crack.userData.baseLength = bossSize * 0.8;
        group.add(crack);
        group.cracks.push(crack);
    }
    
    // Warning ring showing split spawn positions
    const spawnRingGeom = getRingGeometry(7.5, 8.5, 32);  // 8 units from center
    const spawnRingMat = new THREE.MeshBasicMaterial({
        color: VISUAL_COLORS.DANGER_RED,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide
    });
    const spawnRing = new THREE.Mesh(spawnRingGeom, spawnRingMat);
    spawnRing.rotation.x = -Math.PI / 2;
    spawnRing.position.y = 0.1;
    group.add(spawnRing);
    
    // Mini-boss spawn indicators (3 positions)
    const spawnIndicators = [];
    for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2;
        const indicatorGeom = getCircleGeometry(1.5, 16);
        const indicatorMat = new THREE.MeshBasicMaterial({
            color: 0x66ffff,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        const indicator = new THREE.Mesh(indicatorGeom, indicatorMat);
        indicator.rotation.x = -Math.PI / 2;
        indicator.position.set(Math.cos(angle) * 8, 0.15, Math.sin(angle) * 8);
        group.add(indicator);
        spawnIndicators.push(indicator);
    }
    
    group.spawnRing = spawnRing;
    group.spawnIndicators = spawnIndicators;
    group.bossSize = bossSize;
    group.createdAt = Date.now();
    
    scene.add(group);
    return group;
}

export function updateSplitWarningVFX(vfx, timer, maxTimer, boss) {
    if (!vfx || !boss) return;
    
    const elapsed = (Date.now() - vfx.createdAt) / 1000;
    const progress = timer / maxTimer;
    
    // Follow boss position
    vfx.position.copy(boss.position);
    vfx.position.y = 0;
    
    // Animate cracks - expand as split approaches using scale (avoids geometry recreation)
    if (vfx.cracks) {
        vfx.cracks.forEach((crack, i) => {
            // Scale the crack instead of recreating geometry
            // Initial geometry is at baseLength, scale to desired length ratio
            const scaleRatio = 0.5 + progress * 0.8;
            crack.scale.setScalar(scaleRatio);
            
            // Flash cracks
            crack.material.opacity = 0.5 + Math.sin(elapsed * 10 + i) * 0.4;
        });
    }
    
    // Pulse spawn ring
    if (vfx.spawnRing) {
        vfx.spawnRing.material.opacity = 0.3 + progress * 0.4 + Math.sin(elapsed * 6) * 0.2;
    }
    
    // Animate spawn indicators
    if (vfx.spawnIndicators) {
        vfx.spawnIndicators.forEach((indicator, i) => {
            indicator.material.opacity = 0.4 + progress * 0.4 + Math.sin(elapsed * 8 + i) * 0.2;
            const scale = 0.8 + progress * 0.4 + Math.sin(elapsed * 4 + i) * 0.1;
            indicator.scale.setScalar(scale);
        });
    }
}

// ==================== TEMPORARY WALL VFX ====================

export function createWallEdgeGlow(wall) {
    // Add glowing edges to temporary walls
    const edgeGeom = new THREE.EdgesGeometry(wall.geometry);
    const edgeMat = new THREE.LineBasicMaterial({
        color: VISUAL_COLORS.WARNING_ORANGE,
        linewidth: 2
    });
    
    const edges = new THREE.LineSegments(edgeGeom, edgeMat);
    wall.add(edges);
    wall.edgeGlow = edges;
    
    return edges;
}

export function updateTemporaryWall(wall) {
    if (!wall || !wall.isTemporary) return;
    
    wall.remainingDuration--;
    
    // Fade out in last second
    if (wall.remainingDuration < 60) {
        const fadePercent = wall.remainingDuration / 60;
        wall.material.opacity = 0.8 * fadePercent;
        if (wall.edgeGlow) {
            wall.edgeGlow.material.opacity = fadePercent;
        }
    }
    
    // Pulse warning when about to disappear
    if (wall.remainingDuration < 30 && wall.remainingDuration % 10 < 5) {
        wall.material.emissiveIntensity = 0.5;
    } else {
        wall.material.emissiveIntensity = 0.3;
    }
    
    return wall.remainingDuration <= 0;
}

// ==================== CLEANUP ====================

// Check if a geometry is cached (should not be disposed)
function isGeometryCached(geometry) {
    if (!geometry) return false;
    for (const cached of geometryCache.values()) {
        if (cached === geometry) return true;
    }
    return false;
}

export function cleanupVFX(vfx) {
    if (!vfx) return;
    
    // Only dispose non-cached geometries
    if (vfx.geometry && !isGeometryCached(vfx.geometry)) {
        vfx.geometry.dispose();
    }
    if (vfx.material) vfx.material.dispose();
    
    vfx.traverse((child) => {
        // Only dispose non-cached geometries
        if (child.geometry && !isGeometryCached(child.geometry)) {
            child.geometry.dispose();
        }
        if (child.material) child.material.dispose();
    });
    
    scene.remove(vfx);
}

// Clear geometry cache (call on game reset if needed)
export function clearGeometryCache() {
    for (const geometry of geometryCache.values()) {
        geometry.dispose();
    }
    geometryCache.clear();
}
