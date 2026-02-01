import { scene, ground } from '../core/scene.js';
import { obstacles, hazardZones, arenaWalls } from '../core/entities.js';
import { ARENA_CONFIG } from '../config/arenas.js';
import { cachePillarPositions } from '../entities/enemies.js';

// Arena landmarks (visual-only, no collision)
const arenaLandmarks = [];

export function generateArena(arenaNumber) {
    clearArenaGeometry();
    
    const arenaNum = Math.min(arenaNumber, 6);
    const arenaData = ARENA_CONFIG.arenas[arenaNum];
    
    createBoundaryWalls();
    
    if (arenaData.features.includes('pillars')) addPillars(arenaNum);
    if (arenaData.features.includes('vertical')) addVerticalElements(arenaNum);
    if (arenaData.features.includes('platforms')) addPlatforms(arenaNum);
    if (arenaData.features.includes('tunnels')) addTunnelWalls(arenaNum);
    if (arenaData.features.includes('hazards')) addHazardZones(arenaNum);
    if (arenaData.features.includes('landmarks')) addArena1Landmarks();
    if (arenaData.features.includes('multiLevel')) {
        addResetPads(arenaNum);
        addPlatformHeightIndicators(arenaNum);
    }
    
    // Arena 6: Add safe bailout zone marker at center
    if (arenaNum === 6) {
        addSafeBailoutMarker();
    }
    
    if (ground && ground.material) {
        ground.material.color.setHex(arenaData.color);
    }
    
    // Cache pillar positions for pillar hopper enemies
    cachePillarPositions();
}

export function clearArenaGeometry() {
    // Clear obstacles
    obstacles.forEach(obs => {
        if (obs.geometry) obs.geometry.dispose();
        if (obs.material) obs.material.dispose();
        scene.remove(obs);
    });
    obstacles.length = 0;
    
    // Clear arena walls
    arenaWalls.forEach(wall => {
        if (wall.geometry) wall.geometry.dispose();
        if (wall.material) wall.material.dispose();
        scene.remove(wall);
    });
    arenaWalls.length = 0;
    
    // Clear hazard zones
    hazardZones.forEach(hz => {
        if (hz.geometry) hz.geometry.dispose();
        if (hz.material) hz.material.dispose();
        scene.remove(hz);
    });
    hazardZones.length = 0;
    
    // Clear arena landmarks (visual-only elements)
    arenaLandmarks.forEach(lm => {
        if (lm.geometry) lm.geometry.dispose();
        if (lm.material) lm.material.dispose();
        scene.remove(lm);
    });
    arenaLandmarks.length = 0;
}

function addPillars(arenaNum) {
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x5a5a7a, roughness: 0.6 });
    
    // Arena 2 gets TALL unclimbable pillars with ASYMMETRIC layout
    const pillarHeight = (arenaNum === 2) ? 8 : 3 + arenaNum * 0.5;
    
    if (arenaNum === 2) {
        // ASYMMETRIC outer ring - vary radius and angles to break "solved loop"
        const outerPillars = [
            { angle: 0, radius: 18 },
            { angle: Math.PI * 0.27, radius: 17 },      // Slightly inward, non-uniform spacing
            { angle: Math.PI * 0.5, radius: 19 },       // Slightly outward
            { angle: Math.PI * 0.73, radius: 18 },
            { angle: Math.PI, radius: 17 },
            { angle: Math.PI * 1.25, radius: 19 },
            { angle: Math.PI * 1.55, radius: 18 },
            { angle: Math.PI * 1.8, radius: 17 }
        ];
        
        outerPillars.forEach(p => {
            createObstacle(
                Math.cos(p.angle) * p.radius,
                Math.sin(p.angle) * p.radius,
                2,
                pillarHeight,
                2,
                pillarMat
            );
        });
        
        // ASYMMETRIC inner ring - 3 pillars instead of 4 to break symmetry
        const innerPillars = [
            { angle: Math.PI * 0.3, radius: 10 },
            { angle: Math.PI * 1.0, radius: 9 },
            { angle: Math.PI * 1.6, radius: 11 }
        ];
        
        innerPillars.forEach(p => {
            createObstacle(
                Math.cos(p.angle) * p.radius,
                Math.sin(p.angle) * p.radius,
                2,
                8,
                2,
                pillarMat
            );
        });
    } else {
        // Standard symmetric pillars for other arenas
        const count = 4 + arenaNum * 2;
        const radius = 18;
        
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            createObstacle(
                Math.cos(angle) * radius,
                Math.sin(angle) * radius,
                2,
                pillarHeight,
                2,
                pillarMat
            );
        }
    }
    
    // Cover blocks (low, can't stand on)
    const coverMat = new THREE.MeshStandardMaterial({ color: 0x4a4a6a, roughness: 0.7 });
    
    // Arena 2: Offset cover blocks from corners to prevent camping, add "leak" gaps
    // Other arenas: Standard corner positions
    const coverPositions = (arenaNum === 2) 
        ? [[-12, -8], [8, -12], [-8, 12], [12, 8]]  // Staggered, asymmetric
        : [[-10, -10], [10, -10], [-10, 10], [10, 10]];  // Standard corners
    
    coverPositions.forEach(([x, z]) => {
        createObstacle(x, z, 3, 1.2, 2, coverMat);
    });
}

function addVerticalElements(arenaNum) {
    const platformMat = new THREE.MeshStandardMaterial({ color: 0x5a4a7a, roughness: 0.5 });
    
    // Central platform (climbable)
    createObstacle(0, 0, 8, 2, 8, platformMat);
    
    // Arena 3 gets more platforms for Pillar Police
    if (arenaNum === 3) {
        // Corner platforms at varying heights
        createObstacle(-15, -15, 4, 3, 4, platformMat);
        createObstacle(15, -15, 4, 3.5, 4, platformMat);
        createObstacle(-15, 15, 4, 4, 4, platformMat);
        createObstacle(15, 15, 4, 4.5, 4, platformMat);
    }
    
    // Stepped platforms as ramps
    const rampMat = new THREE.MeshStandardMaterial({ color: 0x6a5a8a, roughness: 0.6 });
    createObstacle(6, 0, 3, 0.7, 3, rampMat);
    createObstacle(8, 0, 2.5, 1.3, 2.5, rampMat);
    createObstacle(-6, 0, 3, 0.7, 3, rampMat);
    createObstacle(-8, 0, 2.5, 1.3, 2.5, rampMat);
    createObstacle(0, 6, 3, 0.7, 3, rampMat);
    createObstacle(0, -6, 3, 0.7, 3, rampMat);
    
    // Arena 3: Stepping stones to CP4 (god-pillar fix)
    // Creates two-ramp approach from +X and +Z directions
    if (arenaNum === 3) {
        createObstacle(12, 15, 2.5, 2.5, 2.5, rampMat);   // +X approach (lower)
        createObstacle(15, 12, 2.5, 2.5, 2.5, rampMat);   // +Z approach (lower)
    }
}

function addPlatforms(arenaNum) {
    const platformMat = new THREE.MeshStandardMaterial({ color: 0x4a6a5a, roughness: 0.5 });
    
    // Corner platforms (varying heights for Arena 4)
    const platformConfigs = [
        { x: -22, z: -22, h: 2.5, size: 7 },
        { x: 22, z: -22, h: 3.5, size: 7 },
        { x: -22, z: 22, h: 4.5, size: 7 },
        { x: 22, z: 22, h: 5.5, size: 7 }
    ];
    
    // Mid-ring platforms (connecting)
    // Arena 5+: Move platforms inward to avoid collision with tunnel walls
    // Tunnel wall inner edges are at ±22, so platforms at ±17 create 2.5-unit gap
    const hasTunnels = arenaNum >= 5;
    const midRingDist = hasTunnels ? 17 : 20;
    const midPlatforms = [
        { x: 0, z: -midRingDist, h: 3, size: 5 },
        { x: -midRingDist, z: 0, h: 3.5, size: 5 },
        { x: midRingDist, z: 0, h: 4, size: 5 },
        { x: 0, z: midRingDist, h: 4.5, size: 5 }
    ];
    
    // Build corner platforms
    platformConfigs.forEach(c => {
        createObstacle(c.x, c.z, c.size, c.h, c.size, platformMat);
    });
    
    // Build mid platforms (Arena 4+ only)
    if (arenaNum >= 4) {
        midPlatforms.forEach(c => {
            createObstacle(c.x, c.z, c.size, c.h, c.size, platformMat);
        });
    }
    
    // Central elevated platform
    if (arenaNum >= 4) {
        createObstacle(0, 0, 8, 3, 8, platformMat);
    }
    
    // Bridges
    const bridgeMat = new THREE.MeshStandardMaterial({ color: 0x5a7a6a, roughness: 0.6 });
    createObstacle(-11, -11, 4, 1.2, 4, bridgeMat);
    createObstacle(11, 11, 4, 2, 4, bridgeMat);
    
    // Arena 4: additional connecting bridges (widened for bouncer dodging)
    if (arenaNum >= 4) {
        createObstacle(0, -10, 8, 1.5, 5, bridgeMat);   // 8x5 instead of 6x3
        createObstacle(-10, 0, 5, 1.8, 8, bridgeMat);   // 5x8 instead of 3x6
    }
}

function addTunnelWalls(arenaNum) {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x6a4a5a, roughness: 0.7 });
    
    // Wall height: 5 units (unjumpable - prevents wall-camping cheese)
    // Player jump velocity is 0.4 with max bounce height ~4 units
    const wallHeight = 5;
    
    // Junction pockets: Split each wall into two sections with a 4-unit gap
    // This provides dodge space and cross-corridor escape routes
    
    // West wall - split into two sections with pocket at center
    // Original: spanning x=-34 to x=-22
    createObstacle(-32, 0, 4, wallHeight, 3, wallMat);   // Left section (x=-34 to x=-30)
    createObstacle(-24, 0, 4, wallHeight, 3, wallMat);   // Right section (x=-26 to x=-22)
    // Gap at x=-30 to x=-26 (4 units) creates junction pocket
    
    // East wall - split into two sections with pocket at center
    // Original: spanning x=22 to x=34
    createObstacle(24, 0, 4, wallHeight, 3, wallMat);    // Left section (x=22 to x=26)
    createObstacle(32, 0, 4, wallHeight, 3, wallMat);    // Right section (x=30 to x=34)
    // Gap at x=26 to x=30 (4 units) creates junction pocket
    
    // North wall - split into two sections with pocket at center
    // Original: spanning z=-34 to z=-22
    createObstacle(0, -32, 3, wallHeight, 4, wallMat);   // Far section (z=-34 to z=-30)
    createObstacle(0, -24, 3, wallHeight, 4, wallMat);   // Near section (z=-26 to z=-22)
    // Gap at z=-30 to z=-26 (4 units) creates junction pocket
    
    // South wall - split into two sections with pocket at center
    // Original: spanning z=22 to z=34
    createObstacle(0, 24, 3, wallHeight, 4, wallMat);    // Near section (z=22 to z=26)
    createObstacle(0, 32, 3, wallHeight, 4, wallMat);    // Far section (z=30 to z=34)
    // Gap at z=26 to z=30 (4 units) creates junction pocket
}

function addHazardZones(arenaNum) {
    // Corner hazards shifted inward with reduced radius to create escape channels
    // Position (±32, ±32) with radius 4 creates 6-unit escape routes:
    // Arena edge (±42) - hazard edge (32+4=36) = 6 units clearance
    const hazardPositions = [
        { x: -32, z: -32 },
        { x: 32, z: -32 },
        { x: -32, z: 32 },
        { x: 32, z: 32 }
    ];
    
    hazardPositions.forEach(pos => {
        createHazardZone(pos.x, pos.z, 4, -1);  // Reduced radius from 5 to 4
    });
}

// Safe bailout zone marker - visual aid for Arena 6 central safe area
function addSafeBailoutMarker() {
    const safeZoneRadius = 12;
    
    // Outer ring marker
    const ringGeom = new THREE.RingGeometry(safeZoneRadius - 0.5, safeZoneRadius, 32);
    const ringMat = new THREE.MeshBasicMaterial({
        color: 0x44aa44,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide
    });
    const safeZone = new THREE.Mesh(ringGeom, ringMat);
    safeZone.rotation.x = -Math.PI / 2;
    safeZone.position.y = 0.02;
    scene.add(safeZone);
    arenaLandmarks.push(safeZone);
    
    // Inner subtle fill (very low opacity)
    const fillGeom = new THREE.CircleGeometry(safeZoneRadius - 1, 32);
    const fillMat = new THREE.MeshBasicMaterial({
        color: 0x44aa44,
        transparent: true,
        opacity: 0.05,
        side: THREE.DoubleSide
    });
    const fill = new THREE.Mesh(fillGeom, fillMat);
    fill.rotation.x = -Math.PI / 2;
    fill.position.y = 0.01;
    scene.add(fill);
    arenaLandmarks.push(fill);
}

// Reset pads - visual markers for open recovery zones (Arena 4+)
function addResetPads(arenaNum) {
    if (arenaNum < 4) return;
    
    // 4 cardinal positions - open areas without elevated geometry
    const padPositions = [
        { x: -30, z: 0 },
        { x: 30, z: 0 },
        { x: 0, z: -30 },
        { x: 0, z: 30 }
    ];
    
    const padMat = new THREE.MeshBasicMaterial({
        color: 0x3a5a4a,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
    });
    
    padPositions.forEach(pos => {
        // Visual marker (non-collision)
        const pad = new THREE.Mesh(
            new THREE.CircleGeometry(4, 16),
            padMat
        );
        pad.rotation.x = -Math.PI / 2;
        pad.position.set(pos.x, 0.02, pos.z);
        scene.add(pad);
        arenaLandmarks.push(pad);
    });
}

// Platform height indicators - color-code platforms by height tier (Arena 4+)
function addPlatformHeightIndicators(arenaNum) {
    if (arenaNum < 4) return;
    
    const heightColors = {
        1: 0x3a4a3a,  // Low: darker
        2: 0x4a5a4a,  // Medium-low
        3: 0x5a6a5a,  // Medium
        4: 0x6a7a6a,  // Medium-high
        5: 0x7a8a7a   // High: lighter
    };
    
    for (const obs of obstacles) {
        const c = obs.collisionData;
        if (!c) continue;
        
        const heightTier = Math.min(5, Math.ceil(c.height));
        const indicatorColor = heightColors[heightTier];
        
        // Add top-surface tint
        const indicator = new THREE.Mesh(
            new THREE.PlaneGeometry(
                (c.maxX - c.minX) * 0.8,
                (c.maxZ - c.minZ) * 0.8
            ),
            new THREE.MeshBasicMaterial({
                color: indicatorColor,
                transparent: true,
                opacity: 0.4,
                side: THREE.DoubleSide
            })
        );
        indicator.rotation.x = -Math.PI / 2;
        indicator.position.set(
            (c.minX + c.maxX) / 2,
            c.topY + 0.02,
            (c.minZ + c.maxZ) / 2
        );
        scene.add(indicator);
        arenaLandmarks.push(indicator);
    }
}

// Arena 1 landmarks - visual-only orientation aids
function addArena1Landmarks() {
    // Central ring marker - orientation anchor
    const centerRing = new THREE.Mesh(
        new THREE.RingGeometry(8, 10, 32),
        new THREE.MeshBasicMaterial({
            color: 0x3a3a5a,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
        })
    );
    centerRing.rotation.x = -Math.PI / 2;
    centerRing.position.y = 0.01;
    scene.add(centerRing);
    arenaLandmarks.push(centerRing);
    
    // Cardinal direction lines - subtle orientation guides
    const lineMat = new THREE.MeshBasicMaterial({
        color: 0x3a3a5a,
        transparent: true,
        opacity: 0.2
    });
    
    for (let i = 0; i < 4; i++) {
        const lineGeom = new THREE.PlaneGeometry(2, 40);
        const line = new THREE.Mesh(lineGeom, lineMat);
        line.rotation.x = -Math.PI / 2;
        line.rotation.z = (i / 4) * Math.PI * 2;
        line.position.y = 0.01;
        scene.add(line);
        arenaLandmarks.push(line);
    }
    
    // Corner warning zones - visual danger indicators
    const cornerMat = new THREE.MeshBasicMaterial({
        color: 0x4a2a2a,  // Slightly red tint
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide
    });
    
    const cornerPositions = [[-40, -40], [40, -40], [-40, 40], [40, 40]];
    cornerPositions.forEach(([x, z]) => {
        const warningGeom = new THREE.CircleGeometry(5, 16);
        const warning = new THREE.Mesh(warningGeom, cornerMat);
        warning.rotation.x = -Math.PI / 2;
        warning.position.set(x, 0.01, z);
        scene.add(warning);
        arenaLandmarks.push(warning);
    });
}

export function createObstacle(x, z, sizeX, height, sizeZ, material) {
    const geometry = new THREE.BoxGeometry(sizeX, height, sizeZ);
    const obstacle = new THREE.Mesh(geometry, material);
    obstacle.position.set(x, height / 2, z);
    obstacle.castShadow = true;
    obstacle.receiveShadow = true;
    obstacle.collisionData = {
        minX: x - sizeX / 2,
        maxX: x + sizeX / 2,
        minZ: z - sizeZ / 2,
        maxZ: z + sizeZ / 2,
        height: height,
        topY: height
    };
    scene.add(obstacle);
    obstacles.push(obstacle);
    return obstacle;
}

export function createHazardZone(x, z, radius, duration) {
    const geometry = new THREE.CircleGeometry(radius, 24);
    const material = new THREE.MeshBasicMaterial({
        color: 0x44ff44,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide
    });
    const hazard = new THREE.Mesh(geometry, material);
    hazard.rotation.x = -Math.PI / 2;
    hazard.position.set(x, 0.05, z);
    hazard.radius = radius;
    hazard.duration = duration;
    // Frame-based damage: 15 DPS at 60fps = 1.5 damage per 6-frame tick
    hazard.damagePerTick = 1.5;
    hazard.damageTickInterval = 6;  // Apply damage every 6 frames (~100ms at 60fps)
    hazard.tickTimer = 0;
    scene.add(hazard);
    hazardZones.push(hazard);
    return hazard;
}

function createBoundaryWalls() {
    const wallMat = new THREE.MeshStandardMaterial({
        color: 0x3a3a5a,
        transparent: true,
        opacity: 0.3
    });
    const wallHeight = 8;
    
    for (let i = 0; i < 4; i++) {
        const wallGeom = new THREE.BoxGeometry(
            i < 2 ? 100 : 2,
            wallHeight,
            i < 2 ? 2 : 100
        );
        const wall = new THREE.Mesh(wallGeom, wallMat);
        wall.position.y = wallHeight / 2;
        
        if (i === 0) wall.position.z = -50;
        else if (i === 1) wall.position.z = 50;
        else if (i === 2) wall.position.x = -50;
        else wall.position.x = 50;
        
        scene.add(wall);
        arenaWalls.push(wall);
    }
}

export function updateHazardZones() {
    for (let i = hazardZones.length - 1; i >= 0; i--) {
        const hz = hazardZones[i];
        if (hz.duration > 0) {
            hz.duration--;
            if (hz.duration < 60) {
                hz.material.opacity = (hz.duration / 60) * 0.4;
            }
            if (hz.duration <= 0) {
                hz.geometry.dispose();
                hz.material.dispose();
                scene.remove(hz);
                hazardZones.splice(i, 1);
            }
        }
    }
}
