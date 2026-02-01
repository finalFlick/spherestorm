import { scene, ground } from '../core/scene.js';
import { obstacles, hazardZones, arenaWalls } from '../core/entities.js';
import { ARENA_CONFIG } from '../config/arenas.js';
import { cachePillarPositions } from '../entities/enemies.js';

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
}

function addPillars(arenaNum) {
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x5a5a7a, roughness: 0.6 });
    const count = 4 + arenaNum * 2;
    const radius = 18;
    
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        createObstacle(
            Math.cos(angle) * radius,
            Math.sin(angle) * radius,
            2,
            3 + arenaNum * 0.5,
            2,
            pillarMat
        );
    }
    
    // Cover blocks
    const coverMat = new THREE.MeshStandardMaterial({ color: 0x4a4a6a, roughness: 0.7 });
    const coverPositions = [[-10, -10], [10, -10], [-10, 10], [10, 10]];
    coverPositions.forEach(([x, z]) => {
        createObstacle(x, z, 3, 1.2, 2, coverMat);
    });
}

function addVerticalElements(arenaNum) {
    const platformMat = new THREE.MeshStandardMaterial({ color: 0x5a4a7a, roughness: 0.5 });
    createObstacle(0, 0, 8, 2, 8, platformMat);
    
    // Stepped platforms as ramps
    const rampMat = new THREE.MeshStandardMaterial({ color: 0x6a5a8a, roughness: 0.6 });
    createObstacle(6, 0, 3, 0.7, 3, rampMat);
    createObstacle(8, 0, 2.5, 1.3, 2.5, rampMat);
    createObstacle(-6, 0, 3, 0.7, 3, rampMat);
    createObstacle(-8, 0, 2.5, 1.3, 2.5, rampMat);
    createObstacle(0, 6, 3, 0.7, 3, rampMat);
    createObstacle(0, -6, 3, 0.7, 3, rampMat);
}

function addPlatforms(arenaNum) {
    const platformMat = new THREE.MeshStandardMaterial({ color: 0x4a6a5a, roughness: 0.5 });
    const platformConfigs = [
        { x: -22, z: -22, h: 2.5 },
        { x: 22, z: -22, h: 3 },
        { x: -22, z: 22, h: 3.5 },
        { x: 22, z: 22, h: 4 }
    ];
    
    platformConfigs.forEach(c => {
        createObstacle(c.x, c.z, 7, c.h, 7, platformMat);
    });
    
    // Bridges
    const bridgeMat = new THREE.MeshStandardMaterial({ color: 0x5a7a6a, roughness: 0.6 });
    createObstacle(-11, -11, 4, 1.2, 4, bridgeMat);
    createObstacle(11, 11, 4, 2, 4, bridgeMat);
}

function addTunnelWalls(arenaNum) {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x6a4a5a, roughness: 0.7 });
    createObstacle(-28, 0, 12, 3.5, 3, wallMat);
    createObstacle(28, 0, 12, 3.5, 3, wallMat);
    createObstacle(0, -28, 3, 3.5, 12, wallMat);
    createObstacle(0, 28, 3, 3.5, 12, wallMat);
}

function addHazardZones(arenaNum) {
    const hazardPositions = [
        { x: -30, z: -30 },
        { x: 30, z: -30 },
        { x: -30, z: 30 },
        { x: 30, z: 30 }
    ];
    
    hazardPositions.forEach(pos => {
        createHazardZone(pos.x, pos.z, 5, -1);
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
    hazard.damagePerFrame = 0.5;
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
