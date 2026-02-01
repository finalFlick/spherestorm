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
    BURROW_BROWN: 0x886644,
    COMBO_GOLD: 0xffcc44      // White/gold for combo tethers
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

// ==================== INTRO CINEMATIC ====================
// Camera pan from high above the arena down to gameplay position

let introActive = false;
let introTimer = 0;
const INTRO_DURATION = 180;  // 3 seconds at 60fps

// Starting position: high above arena, looking down
const INTRO_START = { x: 0, y: 25, z: 20 };
// End position: normal gameplay camera position
const INTRO_END = { x: 0, y: 5.88, z: 8 };

export function startIntroCinematic(camera) {
    introActive = true;
    introTimer = 0;
    camera.position.set(INTRO_START.x, INTRO_START.y, INTRO_START.z);
    camera.lookAt(0, 0, 0);  // Look at arena center
}

export function updateIntroCinematic(camera, player) {
    if (!introActive) return false;
    
    introTimer++;
    const progress = Math.min(introTimer / INTRO_DURATION, 1);
    
    // Smooth easing (ease-out cubic)
    const eased = 1 - Math.pow(1 - progress, 3);
    
    // Interpolate camera position
    camera.position.x = INTRO_START.x + (INTRO_END.x - INTRO_START.x) * eased;
    camera.position.y = INTRO_START.y + (INTRO_END.y - INTRO_START.y) * eased;
    camera.position.z = INTRO_START.z + (INTRO_END.z - INTRO_START.z) * eased;
    
    // Gradually transition look target from arena center to player
    const lookY = 0 + (player.position.y + 1) * eased;
    camera.lookAt(player.position.x, lookY, player.position.z);
    
    if (progress >= 1) {
        introActive = false;
        return false;  // Intro complete
    }
    return true;  // Still active
}

export function isIntroActive() {
    return introActive;
}

export function endIntroCinematic() {
    introActive = false;
    introTimer = 0;
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

// ==================== COMBO TETHER VFX ====================

/**
 * Creates a combo tether VFX - energy arc from boss to next ability target
 * @param {THREE.Object3D} boss - The boss object
 * @param {THREE.Vector3} targetPos - The position of the next ability target
 * @returns {THREE.Group} The tether VFX group
 */
export function createComboTether(boss, targetPos) {
    const group = new THREE.Group();
    
    // Calculate distance and direction
    const startPos = boss.position.clone();
    const direction = new THREE.Vector3().subVectors(targetPos, startPos);
    const distance = direction.length();
    
    // Create curved tether beam (thin, semi-transparent)
    // Use a simple curved line with multiple segments
    const segments = 12;
    const curveHeight = Math.min(distance * 0.3, 4); // Arc height proportional to distance
    
    const points = [];
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const x = startPos.x + direction.x * t;
        const z = startPos.z + direction.z * t;
        // Parabolic arc
        const y = startPos.y + curveHeight * 4 * t * (1 - t);
        points.push(new THREE.Vector3(x, y, z));
    }
    
    // Create tube along the curve
    const curve = new THREE.CatmullRomCurve3(points);
    const tubeGeom = new THREE.TubeGeometry(curve, segments, 0.15, 6, false);
    const tubeMat = new THREE.MeshBasicMaterial({
        color: VISUAL_COLORS.COMBO_GOLD,
        transparent: true,
        opacity: 0.6
    });
    const tube = new THREE.Mesh(tubeGeom, tubeMat);
    group.add(tube);
    group.tube = tube;
    group.tubeGeom = tubeGeom; // Store for cleanup (not cached)
    
    // Energy particles along the tether
    group.particles = [];
    const particleCount = 5;
    const particleGeom = getSphereGeometry(0.2, 8);
    for (let i = 0; i < particleCount; i++) {
        const particleMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.8
        });
        const particle = new THREE.Mesh(particleGeom, particleMat);
        particle.t = i / particleCount; // Position along curve
        particle.speed = 0.02 + Math.random() * 0.01;
        group.add(particle);
        group.particles.push(particle);
    }
    
    // Store references for updates
    group.boss = boss;
    group.targetPos = targetPos.clone();
    group.curve = curve;
    group.createdTime = Date.now();
    
    scene.add(group);
    return group;
}

/**
 * Updates the combo tether VFX - animates particles along the arc
 * @param {THREE.Group} tether - The tether VFX group
 * @param {THREE.Vector3} newTargetPos - Optional new target position
 */
export function updateComboTether(tether, newTargetPos = null) {
    if (!tether || !tether.curve) return;
    
    // Update target position if provided
    if (newTargetPos && tether.boss) {
        const startPos = tether.boss.position;
        const direction = new THREE.Vector3().subVectors(newTargetPos, startPos);
        const distance = direction.length();
        const curveHeight = Math.min(distance * 0.3, 4);
        const segments = 12;
        
        const points = [];
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const x = startPos.x + direction.x * t;
            const z = startPos.z + direction.z * t;
            const y = startPos.y + curveHeight * 4 * t * (1 - t);
            points.push(new THREE.Vector3(x, y, z));
        }
        
        tether.curve = new THREE.CatmullRomCurve3(points);
        tether.targetPos = newTargetPos.clone();
        
        // Rebuild tube geometry
        if (tether.tube && tether.tubeGeom) {
            tether.tubeGeom.dispose();
            const newTubeGeom = new THREE.TubeGeometry(tether.curve, segments, 0.15, 6, false);
            tether.tube.geometry = newTubeGeom;
            tether.tubeGeom = newTubeGeom;
        }
    }
    
    // Animate particles along the curve
    if (tether.particles && tether.curve) {
        for (const particle of tether.particles) {
            particle.t += particle.speed;
            if (particle.t > 1) particle.t -= 1;
            
            const pos = tether.curve.getPointAt(particle.t);
            particle.position.copy(pos);
            
            // Pulse opacity
            particle.material.opacity = 0.5 + 0.5 * Math.sin(particle.t * Math.PI);
        }
    }
    
    // Pulse the tube opacity
    if (tether.tube) {
        const age = (Date.now() - tether.createdTime) / 1000;
        tether.tube.material.opacity = 0.4 + 0.2 * Math.sin(age * 6);
    }
}

/**
 * Creates a lock-in marker at the next ability target position
 * @param {THREE.Vector3} position - The target position
 * @returns {THREE.Group} The lock-in marker group
 */
export function createComboLockInMarker(position) {
    const group = new THREE.Group();
    
    // Outer ring (pulsing)
    const outerRingMat = new THREE.MeshBasicMaterial({
        color: VISUAL_COLORS.COMBO_GOLD,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide
    });
    const outerRing = new THREE.Mesh(
        getRingGeometry(1.5, 2, 32),
        outerRingMat
    );
    outerRing.rotation.x = -Math.PI / 2;
    outerRing.position.y = 0.1;
    group.add(outerRing);
    group.outerRing = outerRing;
    
    // Inner crosshair
    const crosshairMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.8
    });
    
    // Horizontal line
    const hLine = new THREE.Mesh(
        getPlaneGeometry(3, 0.15),
        crosshairMat
    );
    hLine.rotation.x = -Math.PI / 2;
    hLine.position.y = 0.15;
    group.add(hLine);
    
    // Vertical line (actually Z axis on ground)
    const vLine = new THREE.Mesh(
        getPlaneGeometry(0.15, 3),
        crosshairMat.clone()
    );
    vLine.rotation.x = -Math.PI / 2;
    vLine.position.y = 0.15;
    group.add(vLine);
    
    // Center dot
    const centerDot = new THREE.Mesh(
        getSphereGeometry(0.25, 8),
        new THREE.MeshBasicMaterial({
            color: VISUAL_COLORS.COMBO_GOLD,
            transparent: true,
            opacity: 0.9
        })
    );
    centerDot.position.y = 0.3;
    group.add(centerDot);
    group.centerDot = centerDot;
    
    group.position.copy(position);
    group.position.y = 0;
    group.createdTime = Date.now();
    scene.add(group);
    
    return group;
}

/**
 * Updates the combo lock-in marker (pulsing animation)
 * @param {THREE.Group} marker - The lock-in marker group
 */
export function updateComboLockInMarker(marker) {
    if (!marker) return;
    
    const age = (Date.now() - marker.createdTime) / 1000;
    
    // Pulse outer ring
    if (marker.outerRing) {
        const scale = 1 + 0.1 * Math.sin(age * 8);
        marker.outerRing.scale.setScalar(scale);
        marker.outerRing.material.opacity = 0.4 + 0.3 * Math.sin(age * 6);
    }
    
    // Rotate slightly
    marker.rotation.y += 0.02;
    
    // Pulse center dot
    if (marker.centerDot) {
        marker.centerDot.material.opacity = 0.6 + 0.4 * Math.sin(age * 10);
    }
}

// ==================== MINION TETHER VFX ====================

/**
 * Creates a tether beam from boss to a minion
 * @param {THREE.Object3D} boss - The boss object
 * @param {THREE.Object3D} minion - The minion object
 * @param {number} color - The tether color (boss base color)
 * @returns {THREE.Line} The tether line
 */
export function createMinionTether(boss, minion, color) {
    // Create a simple line geometry for the tether
    const points = [
        boss.position.clone(),
        minion.position.clone()
    ];
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.5,
        linewidth: 2
    });
    
    const tether = new THREE.Line(geometry, material);
    tether.boss = boss;
    tether.minion = minion;
    tether.tetherColor = color;
    tether.createdTime = Date.now();
    
    scene.add(tether);
    return tether;
}

/**
 * Updates all minion tethers for a boss
 * @param {THREE.Object3D} boss - The boss object
 * @param {Array} tethers - Array of tether lines
 */
export function updateMinionTethers(boss, tethers) {
    if (!tethers || !boss) return;
    
    const age = (Date.now() - (boss.shieldStartTime || Date.now())) / 1000;
    
    for (const tether of tethers) {
        if (!tether || !tether.minion || !tether.minion.parent) continue;
        
        // Update tether positions
        const positions = tether.geometry.attributes.position.array;
        
        // Start point (boss position, offset to center)
        positions[0] = boss.position.x;
        positions[1] = boss.position.y;
        positions[2] = boss.position.z;
        
        // End point (minion position)
        positions[3] = tether.minion.position.x;
        positions[4] = tether.minion.position.y;
        positions[5] = tether.minion.position.z;
        
        tether.geometry.attributes.position.needsUpdate = true;
        
        // Pulse opacity based on time
        tether.material.opacity = 0.35 + 0.15 * Math.sin(age * 4);
    }
}

/**
 * Creates snap VFX when a minion tether breaks (minion dies)
 * @param {THREE.Vector3} position - The position where tether snapped
 * @param {number} color - The tether color
 */
export function createTetherSnapVFX(position, color) {
    const group = new THREE.Group();
    
    // Snap particle burst - small sparks
    const sparkCount = 6;
    const sparkGeom = getSphereGeometry(0.15, 6);
    
    group.sparks = [];
    for (let i = 0; i < sparkCount; i++) {
        const sparkMat = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.9
        });
        const spark = new THREE.Mesh(sparkGeom, sparkMat);
        
        // Random velocity outward
        const angle = (i / sparkCount) * Math.PI * 2;
        spark.velocity = new THREE.Vector3(
            Math.cos(angle) * 0.3,
            0.2 + Math.random() * 0.2,
            Math.sin(angle) * 0.3
        );
        
        spark.position.copy(position);
        group.add(spark);
        group.sparks.push(spark);
    }
    
    group.position.set(0, 0, 0);
    group.createdTime = Date.now();
    group.lifespan = 500; // 0.5 seconds
    scene.add(group);
    
    return group;
}

/**
 * Updates the tether snap VFX
 * @param {THREE.Group} vfx - The snap VFX group
 * @returns {boolean} true if VFX should be removed
 */
export function updateTetherSnapVFX(vfx) {
    if (!vfx || !vfx.sparks) return true;
    
    const age = Date.now() - vfx.createdTime;
    if (age > vfx.lifespan) return true;
    
    const progress = age / vfx.lifespan;
    
    for (const spark of vfx.sparks) {
        // Move spark
        spark.position.add(spark.velocity);
        spark.velocity.y -= 0.02; // Gravity
        
        // Fade out
        spark.material.opacity = 0.9 * (1 - progress);
        
        // Shrink
        spark.scale.setScalar(1 - progress * 0.5);
    }
    
    return false;
}

// ==================== TELEPORT DECOY VFX ====================

/**
 * Creates a decoy teleport destination marker (Ascendant P2+)
 * @param {THREE.Vector3} position - The decoy position
 * @param {boolean} isReal - Whether this is the real destination (affects visual)
 * @returns {THREE.Group} The decoy VFX group
 */
export function createTeleportDecoy(position, isReal = false) {
    const group = new THREE.Group();
    
    // Ground ring (same as real destination, but slightly different opacity)
    const ringMat = new THREE.MeshBasicMaterial({
        color: VISUAL_COLORS.TELEPORT_PURPLE,
        transparent: true,
        opacity: isReal ? 0.8 : 0.6,  // Real is slightly brighter
        side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(
        getRingGeometry(2, 2.5, 32),
        ringMat
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.1;
    group.add(ring);
    group.ring = ring;
    
    // Inner sigil - real has a distinct rune pattern (6 sides vs 4)
    const sigilMat = new THREE.MeshBasicMaterial({
        color: VISUAL_COLORS.TELEPORT_PURPLE,
        transparent: true,
        opacity: isReal ? 0.9 : 0.5,
        side: THREE.DoubleSide
    });
    const sigilSegments = isReal ? 6 : 4;  // Real has hexagon, fake has square
    const sigil = new THREE.Mesh(
        getRingGeometry(1, 1.5, sigilSegments),
        sigilMat
    );
    sigil.rotation.x = -Math.PI / 2;
    sigil.position.y = 0.15;
    group.add(sigil);
    group.sigil = sigil;
    
    // Vertical beam
    const beamMat = new THREE.MeshBasicMaterial({
        color: isReal ? 0xffffff : VISUAL_COLORS.TELEPORT_PURPLE,
        transparent: true,
        opacity: isReal ? 0.5 : 0.3
    });
    const beam = new THREE.Mesh(
        getCylinderGeometry(0.15, 0.3, 6, 8),
        beamMat
    );
    beam.position.y = 3;
    group.add(beam);
    group.beam = beam;
    
    group.isReal = isReal;
    group.position.copy(position);
    group.position.y = 0;
    group.createdTime = Date.now();
    
    scene.add(group);
    return group;
}

/**
 * Updates the teleport decoy VFX
 * @param {THREE.Group} decoy - The decoy VFX group
 */
export function updateTeleportDecoy(decoy) {
    if (!decoy) return;
    
    const age = (Date.now() - decoy.createdTime) / 1000;
    
    // Rotate sigil
    if (decoy.sigil) {
        decoy.sigil.rotation.z += decoy.isReal ? 0.05 : 0.02;
    }
    
    // Pulse beam
    if (decoy.beam) {
        const pulse = 0.8 + 0.2 * Math.sin(age * (decoy.isReal ? 8 : 4));
        decoy.beam.material.opacity = (decoy.isReal ? 0.5 : 0.3) * pulse;
    }
    
    // Real marker has subtle shimmer
    if (decoy.ring && decoy.isReal) {
        decoy.ring.material.opacity = 0.7 + 0.1 * Math.sin(age * 6);
    }
}

/**
 * Creates a numbered blink barrage marker (Ascendant P3)
 * @param {THREE.Vector3} position - The marker position
 * @param {number} index - The sequence number (1, 2, or 3)
 * @returns {THREE.Group} The barrage marker VFX group
 */
export function createBlinkBarrageMarker(position, index) {
    const group = new THREE.Group();
    
    // Ground ring
    const ringMat = new THREE.MeshBasicMaterial({
        color: VISUAL_COLORS.TELEPORT_PURPLE,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(
        getRingGeometry(1.5, 2, 32),
        ringMat
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.1;
    group.add(ring);
    
    // Number indicator (using small spheres in a pattern)
    const dotColor = [0xffcc44, 0xff8844, 0xff4444][index - 1] || 0xffffff;
    const dotGeom = getSphereGeometry(0.3, 8);
    
    // Create dots based on number (1, 2, or 3 dots)
    for (let i = 0; i < index; i++) {
        const dotMat = new THREE.MeshBasicMaterial({
            color: dotColor,
            transparent: true,
            opacity: 0.9
        });
        const dot = new THREE.Mesh(dotGeom, dotMat);
        const angle = (i / index) * Math.PI * 2 - Math.PI / 2;
        dot.position.x = Math.cos(angle) * 0.6;
        dot.position.y = 2;
        dot.position.z = Math.sin(angle) * 0.6;
        group.add(dot);
    }
    
    group.index = index;
    group.position.copy(position);
    group.position.y = 0;
    group.createdTime = Date.now();
    
    scene.add(group);
    return group;
}

/**
 * Updates the blink barrage marker
 * @param {THREE.Group} marker - The barrage marker group
 */
export function updateBlinkBarrageMarker(marker) {
    if (!marker) return;
    
    const age = (Date.now() - marker.createdTime) / 1000;
    
    // Gentle rotation
    marker.rotation.y += 0.02;
    
    // Pulse effect
    const scale = 1 + 0.1 * Math.sin(age * 4);
    marker.scale.setScalar(scale);
}

// ==================== HAZARD DETONATION VFX ====================

/**
 * Creates a detonation warning around a hazard (Monolith P3)
 * @param {THREE.Vector3} position - The hazard center position
 * @param {number} currentRadius - The current hazard radius
 * @param {number} detonationRadius - The expanded detonation radius (typically 3x)
 * @returns {THREE.Group} The detonation warning VFX group
 */
export function createDetonationWarningVFX(position, currentRadius, detonationRadius) {
    const group = new THREE.Group();
    
    // Pulsing outer ring showing detonation range
    const outerRingMat = new THREE.MeshBasicMaterial({
        color: VISUAL_COLORS.WARNING_ORANGE,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide
    });
    const outerRing = new THREE.Mesh(
        getRingGeometry(detonationRadius - 0.3, detonationRadius, 32),
        outerRingMat
    );
    outerRing.rotation.x = -Math.PI / 2;
    outerRing.position.y = 0.15;
    group.add(outerRing);
    group.outerRing = outerRing;
    
    // Inner danger fill
    const dangerFillMat = new THREE.MeshBasicMaterial({
        color: VISUAL_COLORS.DANGER_RED,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide
    });
    const dangerFill = new THREE.Mesh(
        getCircleGeometry(detonationRadius, 32),
        dangerFillMat
    );
    dangerFill.rotation.x = -Math.PI / 2;
    dangerFill.position.y = 0.1;
    group.add(dangerFill);
    group.dangerFill = dangerFill;
    
    // Exclamation icon at center
    const iconMat = new THREE.MeshBasicMaterial({
        color: VISUAL_COLORS.WARNING_ORANGE,
        transparent: true,
        opacity: 0.8
    });
    const icon = new THREE.Mesh(
        getConeGeometry(0.5, 1.5, 4),
        iconMat
    );
    icon.rotation.x = Math.PI; // Point down
    icon.position.y = 2;
    group.add(icon);
    group.icon = icon;
    
    group.position.copy(position);
    group.position.y = 0;
    group.createdTime = Date.now();
    group.detonationRadius = detonationRadius;
    
    scene.add(group);
    return group;
}

/**
 * Updates the detonation warning VFX (pulsing animation)
 * @param {THREE.Group} vfx - The detonation warning VFX group
 * @param {number} progress - Progress toward detonation (0-1)
 */
export function updateDetonationWarningVFX(vfx, progress) {
    if (!vfx) return;
    
    // Pulse faster as detonation approaches
    const pulseSpeed = 3 + progress * 10;
    const pulse = Math.sin(Date.now() * 0.001 * pulseSpeed);
    
    // Outer ring scale and opacity
    if (vfx.outerRing) {
        const scale = 0.9 + 0.1 * pulse;
        vfx.outerRing.scale.setScalar(scale);
        vfx.outerRing.material.opacity = 0.3 + 0.4 * progress + 0.2 * pulse;
    }
    
    // Danger fill intensity
    if (vfx.dangerFill) {
        vfx.dangerFill.material.opacity = 0.1 + 0.3 * progress;
    }
    
    // Icon bob and pulse
    if (vfx.icon) {
        vfx.icon.position.y = 2 + 0.3 * pulse;
        vfx.icon.material.opacity = 0.6 + 0.4 * progress;
    }
}

// ==================== BURROW PATH VFX ====================

/**
 * Creates a visible underground travel path (Burrower P3)
 * @param {THREE.Vector3} startPos - The start position (burrow point)
 * @param {THREE.Vector3} endPos - The end position (emerge point)
 * @returns {THREE.Group} The burrow path VFX group
 */
export function createBurrowPath(startPos, endPos) {
    const group = new THREE.Group();
    
    // Calculate path
    const direction = new THREE.Vector3().subVectors(endPos, startPos);
    const distance = direction.length();
    direction.normalize();
    
    // Create dotted path line (series of small markers)
    const dotCount = Math.floor(distance / 2);
    const dotGeom = getSphereGeometry(0.4, 6);
    
    group.dots = [];
    for (let i = 0; i <= dotCount; i++) {
        const t = i / dotCount;
        const dotMat = new THREE.MeshBasicMaterial({
            color: 0xff44ff,  // Magenta (Burrower color)
            transparent: true,
            opacity: 0.3 + 0.4 * (1 - t)  // Fade toward destination
        });
        const dot = new THREE.Mesh(dotGeom, dotMat);
        
        dot.position.set(
            startPos.x + direction.x * distance * t,
            0.2,
            startPos.z + direction.z * distance * t
        );
        dot.t = t;  // Store position along path
        
        group.add(dot);
        group.dots.push(dot);
    }
    
    // Arrow at destination
    const arrowMat = new THREE.MeshBasicMaterial({
        color: VISUAL_COLORS.DANGER_RED,
        transparent: true,
        opacity: 0.7
    });
    const arrow = new THREE.Mesh(
        getConeGeometry(0.6, 1.2, 4),
        arrowMat
    );
    arrow.rotation.x = -Math.PI / 2;  // Point forward
    arrow.rotation.y = Math.atan2(direction.x, direction.z);
    arrow.position.copy(endPos);
    arrow.position.y = 0.5;
    group.add(arrow);
    group.arrow = arrow;
    
    group.createdTime = Date.now();
    group.startPos = startPos.clone();
    group.endPos = endPos.clone();
    
    scene.add(group);
    return group;
}

/**
 * Updates the burrow path VFX (animated dots moving toward destination)
 * @param {THREE.Group} path - The burrow path group
 */
export function updateBurrowPath(path) {
    if (!path || !path.dots) return;
    
    const age = (Date.now() - path.createdTime) / 1000;
    
    // Animate dots (wave effect moving toward destination)
    path.dots.forEach((dot, i) => {
        const wave = Math.sin(age * 6 - dot.t * 4);
        dot.position.y = 0.2 + 0.15 * wave;
        dot.material.opacity = (0.3 + 0.4 * (1 - dot.t)) * (0.7 + 0.3 * wave);
    });
    
    // Pulse arrow
    if (path.arrow) {
        const pulse = 0.7 + 0.3 * Math.sin(age * 8);
        path.arrow.material.opacity = pulse;
    }
}

/**
 * Creates a fake emerge warning marker (Burrower P2 - silent decoy)
 * @param {THREE.Vector3} position - The fake marker position
 * @returns {THREE.Group} The fake marker VFX group
 */
export function createFakeEmergeMarker(position) {
    const group = new THREE.Group();
    
    // Similar to real emerge warning but smaller/dimmer
    const crackGeom = getRingGeometry(2.5, 3.5, 6);
    const crackMat = new THREE.MeshBasicMaterial({
        color: VISUAL_COLORS.BURROW_BROWN,
        transparent: true,
        opacity: 0.4,  // Dimmer than real
        side: THREE.DoubleSide
    });
    const crack = new THREE.Mesh(crackGeom, crackMat);
    crack.rotation.x = -Math.PI / 2;
    group.add(crack);
    group.crack = crack;
    
    // Pulsing inner (smaller than real)
    const pulseGeom = getCircleGeometry(1.5, 16);
    const pulseMat = new THREE.MeshBasicMaterial({
        color: VISUAL_COLORS.DANGER_RED,
        transparent: true,
        opacity: 0.25,  // Dimmer
        side: THREE.DoubleSide
    });
    const pulse = new THREE.Mesh(pulseGeom, pulseMat);
    pulse.rotation.x = -Math.PI / 2;
    group.add(pulse);
    group.pulse = pulse;
    
    // No tall beam (unlike real marker)
    
    group.position.copy(position);
    group.position.y = 0;
    group.createdTime = Date.now();
    group.isFake = true;
    
    scene.add(group);
    return group;
}

/**
 * Updates the fake emerge marker
 * @param {THREE.Group} marker - The fake marker group
 */
export function updateFakeEmergeMarker(marker) {
    if (!marker) return;
    
    const age = (Date.now() - marker.createdTime) / 1000;
    
    // Subtle pulse (less intense than real)
    if (marker.pulse) {
        marker.pulse.material.opacity = 0.2 + 0.1 * Math.sin(age * 3);
    }
    
    // Slight rotation
    marker.rotation.y += 0.01;
}

// ==================== VINE ZONE VFX ====================

/**
 * Creates a vine DOT zone around the boss (Overgrowth P2+)
 * @param {THREE.Vector3} position - The zone center position
 * @param {number} radius - The zone radius
 * @param {number} duration - Zone duration in seconds
 * @returns {THREE.Group} The vine zone VFX group
 */
export function createVineZone(position, radius, duration = 5.0) {
    const group = new THREE.Group();
    
    // Ground texture - circular vine pattern
    const groundMat = new THREE.MeshBasicMaterial({
        color: 0x228822,  // Dark green
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide
    });
    const ground = new THREE.Mesh(
        getCircleGeometry(radius, 32),
        groundMat
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0.05;
    group.add(ground);
    group.ground = ground;
    
    // Outer ring (pulsing)
    const ringMat = new THREE.MeshBasicMaterial({
        color: 0x44aa44,  // Brighter green
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(
        getRingGeometry(radius - 0.3, radius, 32),
        ringMat
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.1;
    group.add(ring);
    group.ring = ring;
    
    // Vine tendrils (small cones pointing up)
    group.tendrils = [];
    const tendrilCount = Math.floor(radius * 3);
    const tendrilGeom = getConeGeometry(0.2, 0.8, 4);
    for (let i = 0; i < tendrilCount; i++) {
        const tendrilMat = new THREE.MeshBasicMaterial({
            color: 0x33aa33,
            transparent: true,
            opacity: 0.7
        });
        const tendril = new THREE.Mesh(tendrilGeom, tendrilMat);
        const angle = (i / tendrilCount) * Math.PI * 2;
        const dist = radius * (0.3 + Math.random() * 0.6);
        tendril.position.x = Math.cos(angle) * dist;
        tendril.position.z = Math.sin(angle) * dist;
        tendril.position.y = 0.4;
        tendril.baseY = 0.4;
        group.add(tendril);
        group.tendrils.push(tendril);
    }
    
    group.position.copy(position);
    group.position.y = 0;
    group.createdTime = Date.now();
    group.duration = duration * 1000;
    group.radius = radius;
    group.isDamageZone = true;
    group.damagePerSecond = 2;  // 2 DPS
    group.slowFactor = 0.5;     // 50% slow
    
    scene.add(group);
    return group;
}

/**
 * Updates the vine zone VFX
 * @param {THREE.Group} zone - The vine zone group
 * @returns {boolean} true if zone should be removed
 */
export function updateVineZone(zone) {
    if (!zone) return true;
    
    const age = Date.now() - zone.createdTime;
    if (age > zone.duration) return true;
    
    const progress = age / zone.duration;
    const ageSeconds = age / 1000;
    
    // Pulse ring
    if (zone.ring) {
        zone.ring.material.opacity = 0.4 + 0.2 * Math.sin(ageSeconds * 3);
    }
    
    // Animate tendrils (wave effect)
    if (zone.tendrils) {
        zone.tendrils.forEach((tendril, i) => {
            const offset = i * 0.3;
            tendril.position.y = tendril.baseY + 0.2 * Math.sin(ageSeconds * 4 + offset);
        });
    }
    
    // Fade out near end
    if (progress > 0.8) {
        const fadeProgress = (progress - 0.8) / 0.2;
        if (zone.ground) zone.ground.material.opacity = 0.4 * (1 - fadeProgress);
        if (zone.ring) zone.ring.material.opacity = 0.6 * (1 - fadeProgress);
        zone.tendrils?.forEach(t => { t.material.opacity = 0.7 * (1 - fadeProgress); });
    }
    
    return false;
}

// ==================== CHARGE TRAIL VFX ====================

/**
 * Creates a temporary damage trail segment during boss charge (Gatekeeper P2+)
 * @param {THREE.Vector3} position - The position of the trail segment
 * @param {number} color - The trail color
 * @param {number} duration - How long the trail lasts in seconds
 * @returns {THREE.Mesh} The trail segment
 */
export function createChargeTrailSegment(position, color, duration = 2.0) {
    // Flat glowing disk on the ground
    const trailGeom = getCircleGeometry(1.5, 16);
    const trailMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide
    });
    
    const trail = new THREE.Mesh(trailGeom, trailMat);
    trail.rotation.x = -Math.PI / 2;
    trail.position.copy(position);
    trail.position.y = 0.1;
    
    trail.createdTime = Date.now();
    trail.duration = duration * 1000;
    trail.isDamageZone = true;
    trail.damageRadius = 1.5;
    trail.damage = 0.5; // Light damage per hit
    
    scene.add(trail);
    return trail;
}

/**
 * Updates a charge trail segment (fade out over time)
 * @param {THREE.Mesh} trail - The trail segment
 * @returns {boolean} true if trail should be removed
 */
export function updateChargeTrailSegment(trail) {
    if (!trail) return true;
    
    const age = Date.now() - trail.createdTime;
    if (age > trail.duration) return true;
    
    const progress = age / trail.duration;
    
    // Fade out
    trail.material.opacity = 0.6 * (1 - progress);
    
    // Slight scale up as it fades
    trail.scale.setScalar(1 + progress * 0.3);
    
    return false;
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
