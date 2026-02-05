import { scene } from '../core/scene.js';
import { gameState } from '../core/gameState.js';
import { enemies, obstacles, hazardZones, tempVec3 } from '../core/entities.js';
import { player } from './player.js';
import { ENEMY_TYPES } from '../config/enemies.js';
import { ENEMY_CAPS, WAVE_CONFIG, WAVE_MODIFIERS, COGNITIVE_LIMITS, THREAT_BUDGET, SPLITLING_SPAWN_STUN_FRAMES, SCHOOL_CONFIG, SPAWN_CHOREOGRAPHY } from '../config/constants.js';
import { spawnParticle, spawnEnemyDeathVfx } from '../effects/particles.js';
import { createHazardZone } from '../arena/generator.js';
import { takeDamage, canTakeCollisionDamage, resetDamageCooldown, tickDamageCooldown } from '../systems/damage.js';
import { createShieldBubble, updateShieldVisual, createRushTelegraph, updateRushTelegraph, cleanupVFX } from '../systems/visualFeedback.js';
import { showTutorialCallout } from '../ui/hud.js';
import { PulseMusic } from '../systems/pulseMusic.js';
import { ARENA_CONFIG } from '../config/arenas.js';
import { spawnEnemyProjectileFromPool } from '../systems/projectiles.js';
import { markEnemyEncountered } from '../ui/rosterUI.js';
import { log, logOnce, logThrottled } from '../systems/debugLog.js';
import { TUNING } from '../config/tuning.js';

// Cache pillar positions for pillar hopper behavior
let cachedPillarTops = [];

// Geometry cache to prevent memory leaks from creating new geometries per enemy
const geometryCache = new Map();

function getCachedSphereGeometry(size, segments = 16) {
    const key = `${size.toFixed(2)}_${segments}`;
    if (!geometryCache.has(key)) {
        geometryCache.set(key, new THREE.SphereGeometry(size, segments, segments));
    }
    return geometryCache.get(key);
}

// Clear geometry cache (call on game reset to prevent unbounded memory growth)
export function clearEnemyGeometryCache() {
    for (const geometry of geometryCache.values()) {
        geometry.dispose();
    }
    geometryCache.clear();
    // Also clear cone geometry cache used by mini porcupinefish
    if (typeof coneGeometryCache !== 'undefined') {
        for (const geometry of coneGeometryCache.values()) {
            geometry.dispose();
        }
        coneGeometryCache.clear();
    }
}

function getEnemySpeedTuningMultiplier() {
    const multRaw = Number(TUNING.enemySpeedMultiplier || 1.0);
    return Math.max(0.25, Math.min(3.0, multRaw || 1.0));
}

// Check if a position is valid for enemy placement (not in hazards or obstacles)
function isValidEnemyPosition(x, z, size) {
    // Check hazard zones
    for (const hz of hazardZones) {
        const dist = Math.sqrt((x - hz.position.x) ** 2 + (z - hz.position.z) ** 2);
        if (dist < hz.radius + size) {
            return false;  // Inside hazard
        }
    }
    
    // Check obstacles
    for (const obs of obstacles) {
        const c = obs.collisionData;
        if (!c) continue;
        
        if (x > c.minX - size && x < c.maxX + size &&
            z > c.minZ - size && z < c.maxZ + size) {
            return false;  // Inside obstacle
        }
    }
    
    return true;
}

// Find a valid teleport destination for teleporter enemies
function findValidTeleportDestination(enemy, playerPos) {
    const attempts = 10;
    
    for (let i = 0; i < attempts; i++) {
        const angle = Math.random() * Math.PI * 2;
        const d = 3 + Math.random() * 3;  // 3-6 units from player
        const x = Math.max(-40, Math.min(40, playerPos.x + Math.cos(angle) * d));
        const z = Math.max(-40, Math.min(40, playerPos.z + Math.sin(angle) * d));
        
        // Check validity
        if (isValidEnemyPosition(x, z, enemy.size)) {
            return new THREE.Vector3(x, enemy.size, z);
        }
    }
    
    // Fallback: position toward player from current location
    const fallbackDir = new THREE.Vector3()
        .subVectors(playerPos, enemy.position)
        .normalize();
    const fallbackX = Math.max(-40, Math.min(40, enemy.position.x + fallbackDir.x * 3));
    const fallbackZ = Math.max(-40, Math.min(40, enemy.position.z + fallbackDir.z * 3));
    return new THREE.Vector3(fallbackX, enemy.size, fallbackZ);
}

// Cone geometry cache for mini porcupinefish parts
const coneGeometryCache = new Map();

function getCachedConeGeometry(radius, height, segments = 6) {
    const key = `${radius.toFixed(3)}_${height.toFixed(3)}_${segments}`;
    if (!coneGeometryCache.has(key)) {
        coneGeometryCache.set(key, new THREE.ConeGeometry(radius, height, segments));
    }
    return coneGeometryCache.get(key);
}

// Create mini porcupinefish mesh for Red Puffer enemies (simplified version of Boss 1)
function createMiniPorcupinefishMesh(size, color) {
    const group = new THREE.Group();
    
    // Main body - sphere (body radius = size)
    const bodyGeom = getCachedSphereGeometry(size, 12);
    const bodyMat = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 0.4
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.castShadow = true;
    group.add(body);
    
    // Glow effect - slightly larger than body
    const glowGeom = getCachedSphereGeometry(size * 1.1, 8);
    const glowMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.15
    });
    const glow = new THREE.Mesh(glowGeom, glowMat);
    group.add(glow);
    
    // Eyes - positioned ON the body surface (use larger sizes for visibility)
    // Eye positions must be at distance >= size from center to be visible
    const eyeGeom = getCachedSphereGeometry(size * 0.18, 6);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilGeom = getCachedSphereGeometry(size * 0.09, 4);
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    
    // Left eye - position at body surface (distance = size from center)
    const leftEye = new THREE.Mesh(eyeGeom, eyeMat);
    leftEye.position.set(-size * 0.4, size * 0.35, size * 0.85);
    group.add(leftEye);
    const leftPupil = new THREE.Mesh(pupilGeom, pupilMat);
    leftPupil.position.set(-size * 0.4, size * 0.35, size * 1.0);
    group.add(leftPupil);
    
    // Right eye
    const rightEye = new THREE.Mesh(eyeGeom, eyeMat);
    rightEye.position.set(size * 0.4, size * 0.35, size * 0.85);
    group.add(rightEye);
    const rightPupil = new THREE.Mesh(pupilGeom, pupilMat);
    rightPupil.position.set(size * 0.4, size * 0.35, size * 1.0);
    group.add(rightPupil);
    
    // Tail fin - positioned clearly behind body
    const tailGeom = getCachedConeGeometry(size * 0.3, size * 0.5, 4);
    const tailMat = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 0.3
    });
    const tail = new THREE.Mesh(tailGeom, tailMat);
    tail.rotation.x = Math.PI / 2;
    tail.position.set(0, 0, -size * 1.2);
    group.add(tail);
    
    // Side fins - positioned outside body surface
    const finGeom = getCachedConeGeometry(size * 0.2, size * 0.4, 3);
    const finMat = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 0.3,
        side: THREE.DoubleSide
    });
    
    const leftFin = new THREE.Mesh(finGeom, finMat);
    leftFin.rotation.z = Math.PI / 2;
    leftFin.rotation.y = -0.3;
    leftFin.position.set(-size * 1.0, 0, size * 0.2);
    group.add(leftFin);
    
    const rightFin = new THREE.Mesh(finGeom, finMat.clone());
    rightFin.rotation.z = -Math.PI / 2;
    rightFin.rotation.y = 0.3;
    rightFin.position.set(size * 1.0, 0, size * 0.2);
    group.add(rightFin);
    
    // Single dorsal fin on top - positioned above body
    const dorsalGeom = getCachedConeGeometry(size * 0.15, size * 0.35, 3);
    const dorsalMat = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 0.4
    });
    const dorsal = new THREE.Mesh(dorsalGeom, dorsalMat);
    dorsal.position.set(0, size * 1.0, -size * 0.15);
    group.add(dorsal);
    
    // Store material reference for hit flash
    group.baseMaterial = bodyMat;
    group.isMiniPorcupinefish = true;
    
    // Scale up visual and collision by 25% for better visibility
    // NOTE: This intentionally increases collision radius too (enemies feel more substantial)
    group.scale.setScalar(1.25);
    
    return group;
}

// Build enemy mesh - simple smooth sphere with glow/pulse/orbit effects
function buildEnemyMesh(typeData) {
    // Special case: Red Puffer uses mini porcupinefish mesh (like Boss 1)
    if (typeData.usePorcupinefishMesh) {
        return createMiniPorcupinefishMesh(typeData.size, typeData.color);
    }
    
    const profile = typeData.visualProfile;
    const isTransparent = profile?.type === 'transparent';
    
    // Special case: Orbiter type (two spheres orbiting each other - flying drone look)
    if (profile?.type === 'orbiter') {
        const group = new THREE.Group();
        const sphereSize = typeData.size * 0.55;
        
        const orbitMat1 = new THREE.MeshStandardMaterial({
            color: typeData.color,
            emissive: typeData.color,
            emissiveIntensity: profile.glowIntensity || 0.8
        });
        const orbitMat2 = new THREE.MeshStandardMaterial({
            color: typeData.color,
            emissive: typeData.color,
            emissiveIntensity: profile.glowIntensity || 0.8
        });
        
        const cachedGeom = getCachedSphereGeometry(sphereSize, 12);
        const sphere1 = new THREE.Mesh(cachedGeom, orbitMat1);
        const sphere2 = new THREE.Mesh(cachedGeom, orbitMat2);
        sphere1.castShadow = true;
        sphere2.castShadow = true;
        
        group.add(sphere1);
        group.add(sphere2);
        
        // Store orbiter properties
        group.orbitAngle = 0;
        group.orbitRadius = typeData.size * (profile.orbitRadius || 0.5);
        group.orbitSpeed = profile.orbitSpeed || 0.15;
        group.sphere1 = sphere1;
        group.sphere2 = sphere2;
        group.baseMaterial = orbitMat1;  // For hit flash
        group.visualProfile = profile;
        group.isOrbiter = true;
        
        // Position spheres initially
        sphere1.position.x = group.orbitRadius;
        sphere2.position.x = -group.orbitRadius;
        
        return group;
    }
    
    // Create simple smooth sphere (the enemy is just a Mesh, not a Group)
    const geometry = getCachedSphereGeometry(typeData.size, 16);
    const material = new THREE.MeshStandardMaterial({
        color: typeData.color,
        emissive: typeData.color,
        emissiveIntensity: profile?.glowIntensity || 0.3,
        transparent: isTransparent,
        opacity: profile?.opacity || 1.0
    });
    const enemy = new THREE.Mesh(geometry, material);
    enemy.castShadow = true;
    
    // Store material reference for hit flash
    enemy.baseMaterial = material;
    
    // Store visual profile for runtime effects
    enemy.visualProfile = profile;
    
    // For orbit type, create orbiting particle group
    if (profile?.type === 'orbit') {
        enemy.orbitParticles = [];
        const orbitGroup = new THREE.Group();
        const orbitMat = new THREE.MeshBasicMaterial({
            color: typeData.color,
            transparent: true,
            opacity: 0.6
        });
        
        const orbitParticleGeom = getCachedSphereGeometry(typeData.size * 0.15, 6);
        for (let i = 0; i < profile.orbitCount; i++) {
            const particle = new THREE.Mesh(orbitParticleGeom, orbitMat);
            particle.orbitAngle = (i / profile.orbitCount) * Math.PI * 2;
            particle.orbitRadius = typeData.size * (1 + profile.orbitRadius);
            orbitGroup.add(particle);
            enemy.orbitParticles.push(particle);
        }
        enemy.add(orbitGroup);
        enemy.orbitGroup = orbitGroup;
    }
    
    return enemy;
}

// Cache pillar top positions from obstacles
export function cachePillarPositions() {
    cachedPillarTops = [];
    for (const obs of obstacles) {
        const c = obs.collisionData;
        if (!c) continue;
        
        const width = c.maxX - c.minX;
        const depth = c.maxZ - c.minZ;
        
        // Include platforms that are:
        // - Tall enough to be climbable (height > 1.5)
        // - Not too large (< 10 units) to be arena walls
        if (c.height > 1.5 && width < 10 && depth < 10) {
            cachedPillarTops.push({
                x: (c.minX + c.maxX) / 2,
                z: (c.minZ + c.maxZ) / 2,
                y: c.topY,           // Keep for backward compat
                topY: c.topY,        // Explicit top surface Y
                width: width,
                depth: depth,
                height: c.height
            });
        }
    }
}

// Helper: Get cap for enemy type based on arena
function getCapForEnemy(typeName, arena) {
    const caps = ENEMY_CAPS[typeName];
    if (!caps) return 999; // No cap
    
    if (typeof caps === 'number') return caps;
    
    // Check arena-specific caps
    if (caps[`arena${arena}`]) return caps[`arena${arena}`];
    if (arena >= 5 && caps.arena5plus) return caps.arena5plus;
    if (arena >= 4 && caps.arena4) return caps.arena4;
    if (arena >= 3 && caps.arena3) return caps.arena3;
    if (arena >= 2 && caps.arena2) return caps.arena2;
    
    return caps.base || caps.max || 999;
}

// Helper: Count enemies of a specific type currently alive
function countEnemiesOfType(typeName) {
    return enemies.filter(e => e.enemyType === typeName).length;
}

// Weighted enemy spawning with progressive arena introduction
// Wave 1: Only the NEW enemy type for this arena (LESSON WAVE)
// Wave 2+: Add enemies from previous arenas
export function getWeightedEnemyType() {
    const availableTypes = [];
    let totalWeight = 0;
    const arena = gameState.currentArena;
    const wave = gameState.currentWave;
    
    const isLessonWave = (wave === 1);
    
    for (const [typeName, typeData] of Object.entries(ENEMY_TYPES)) {
        // Skip enemies with spawnWeight 0
        if (typeData.spawnWeight === 0) continue;
        
        // Skip boss-only minions
        if (typeData.isBossMinion) continue;
        
        // Skip enemies gated by maxArena
        if (typeData.maxArena && arena > typeData.maxArena) continue;
        
        // Skip enemies gated by minWave (e.g., gruntTiny only in Wave 2+)
        if (typeData.minWave && wave < typeData.minWave) continue;
        
        // Skip if at cap
        const cap = getCapForEnemy(typeName, arena);
        const currentCount = countEnemiesOfType(typeName);
        if (currentCount >= cap) continue;
        
        // Progressive introduction using arenaIntro
        if (typeData.arenaIntro) {
            // Wave 1 (LESSON): Only spawn the NEW enemy type introduced in this arena
            if (isLessonWave && typeData.arenaIntro !== arena) continue;
            
            // Wave 2+: Spawn enemies from this arena and all previous arenas
            if (!isLessonWave && typeData.arenaIntro > arena) continue;
        }
        
        availableTypes.push({ name: typeName, data: typeData });
        totalWeight += typeData.spawnWeight;
    }
    
    // Fallback to grunt if no enemies available
    if (availableTypes.length === 0) {
        return { name: 'grunt', data: ENEMY_TYPES.grunt };
    }
    
    const waveBonus = wave * 0.05;
    let random = Math.random() * totalWeight;
    
    for (const type of availableTypes) {
        let weight = type.data.spawnWeight;
        if (type.data.spawnWeight < 20) weight += waveBonus * 10;
        random -= weight;
        if (random <= 0) return type;
    }
    
    return availableTypes[0];
}

// Get safe spawn angle avoiding directly behind player's movement direction
function getSafeSpawnAngle(playerVelocity) {
    // Check horizontal velocity magnitude (player.velocity is primarily vertical for jumping)
    // If player has no meaningful horizontal velocity, use random angle
    if (!playerVelocity) {
        return Math.random() * Math.PI * 2;
    }
    
    const horizontalSpeed = Math.sqrt(playerVelocity.x * playerVelocity.x + playerVelocity.z * playerVelocity.z);
    if (horizontalSpeed < 0.01) {
        return Math.random() * Math.PI * 2;
    }
    
    const moveAngle = Math.atan2(playerVelocity.z, playerVelocity.x);
    const safeArc = Math.PI * 0.3;  // 54 degree safe zone behind player
    
    // Spawn in front 270 degree arc, avoiding back 90 degrees
    // Add PI to flip direction (spawn ahead of player movement)
    const spawnAngle = moveAngle + Math.PI + (Math.random() - 0.5) * (Math.PI * 2 - safeArc * 2);
    return spawnAngle;
}

// Check if two points are in the same corridor segment (Arena 5)
// Corridors are the outer perimeter areas beyond the tunnel walls
function isInSameCorridor(x1, z1, x2, z2) {
    // Corridor boundaries based on tunnel wall positions (walls at ±22 to ±34)
    const corridorThreshold = 22;
    
    // West corridor: both in x < -22
    const inWestCorridor = (x1 < -corridorThreshold && x2 < -corridorThreshold);
    // East corridor: both in x > 22
    const inEastCorridor = (x1 > corridorThreshold && x2 > corridorThreshold);
    // North corridor: both in z < -22
    const inNorthCorridor = (z1 < -corridorThreshold && z2 < -corridorThreshold);
    // South corridor: both in z > 22
    const inSouthCorridor = (z1 > corridorThreshold && z2 > corridorThreshold);
    
    return inWestCorridor || inEastCorridor || inNorthCorridor || inSouthCorridor;
}

// Get choreographed spawn position based on direction
function getChoreographedSpawnPosition(direction) {
    const edgeDist = SPAWN_CHOREOGRAPHY.edgeSpawnDistance;
    const spread = SPAWN_CHOREOGRAPHY.edgeSpread;
    const randomOffset = (Math.random() - 0.5) * spread * 2;
    
    switch (direction) {
        case 'north':
            return { x: randomOffset, z: -edgeDist };
        case 'south':
            return { x: randomOffset, z: edgeDist };
        case 'east':
            return { x: edgeDist, z: randomOffset };
        case 'west':
            return { x: -edgeDist, z: randomOffset };
        default:
            return null;
    }
}

// Get spawn position with arena-specific rules
function getArenaSpawnPosition(playerPos, playerVelocity) {
    const arena = gameState.currentArena;
    const arenaData = ARENA_CONFIG.arenas[Math.min(arena, 6)];
    const spawnConfig = arenaData?.spawnConfig;
    
    // Check for spawn choreography (lane flood, pincer, etc.)
    const choreography = gameState.waveChoreography;
    if (choreography && choreography.type !== 'random' && SPAWN_CHOREOGRAPHY.enabled) {
        let pos = null;
        
        if (choreography.type === 'lane') {
            // All enemies from one direction
            pos = getChoreographedSpawnPosition(choreography.primaryDirection);
        } else if (choreography.type === 'pincer') {
            // Alternate between two opposite directions
            const useSecondary = Math.random() < 0.5;
            const direction = useSecondary ? choreography.secondaryDirection : choreography.primaryDirection;
            pos = getChoreographedSpawnPosition(direction);
        }
        
        if (pos) {
            // Clamp to arena bounds
            return {
                x: Math.max(-42, Math.min(42, pos.x)),
                z: Math.max(-42, Math.min(42, pos.z))
            };
        }
    }
    
    // Default spawn: random distance and angle
    let distance = 28 + Math.random() * 12;
    let angle = Math.random() * Math.PI * 2;
    
    // Apply anti-edge bias for Arena 1 (and any arena with this config)
    if (spawnConfig?.antiEdgeBias) {
        const distFromCenter = Math.sqrt(playerPos.x * playerPos.x + playerPos.z * playerPos.z);
        const edgeThreshold = 30;
        
        if (distFromCenter > edgeThreshold) {
            // Player is near edge - spawn enemies between player and center
            // This discourages edge-kiting by forcing engagement away from walls
            const toCenterX = -playerPos.x;
            const toCenterZ = -playerPos.z;
            const toCenterAngle = Math.atan2(toCenterZ, toCenterX);
            
            // Bias spawn angle toward center with some randomness (±72 degrees)
            angle = toCenterAngle + (Math.random() - 0.5) * Math.PI * 0.8;
            distance = 20 + Math.random() * 10;  // Closer spawns when edge-kiting
        } else {
            // Player is in center area - use safe arc spawning
            angle = getSafeSpawnAngle(playerVelocity);
        }
    } else {
        // No special config - just use safe arc spawning
        angle = getSafeSpawnAngle(playerVelocity);
    }

    // Debug tuning: enforce minimum spawn distance from player
    const safeRadiusRaw = Number(TUNING.spawnSafeZoneRadius ?? 0);
    const safeRadius = Math.max(0, Math.min(30, safeRadiusRaw || 0));
    if (safeRadius > 0) {
        distance = Math.max(distance, safeRadius);
    }
    
    // Calculate position
    let x = playerPos.x + Math.cos(angle) * distance;
    let z = playerPos.z + Math.sin(angle) * distance;
    
    // Arena 5+ corridor validation: don't spawn in same corridor as player
    // This prevents ambush spawns where enemies appear behind player in tight corridors
    if (arena >= 5) {
        let attempts = 0;
        while (isInSameCorridor(x, z, playerPos.x, playerPos.z) && attempts < 10) {
            // Retry with different angle
            angle = Math.random() * Math.PI * 2;
            x = playerPos.x + Math.cos(angle) * distance;
            z = playerPos.z + Math.sin(angle) * distance;
            x = Math.max(-42, Math.min(42, x));
            z = Math.max(-42, Math.min(42, z));
            attempts++;
        }
    }
    
    // Enforce corner distance if configured
    if (spawnConfig?.minDistFromCorner) {
        const minDist = spawnConfig.minDistFromCorner;
        const corners = [[-42, -42], [42, -42], [-42, 42], [42, 42]];
        
        for (const [cx, cz] of corners) {
            const dx = x - cx;
            const dz = z - cz;
            const distToCorner = Math.sqrt(dx * dx + dz * dz);
            
            if (distToCorner < minDist) {
                // Push spawn away from corner
                const pushAngle = Math.atan2(dz, dx);
                x = cx + Math.cos(pushAngle) * minDist;
                z = cz + Math.sin(pushAngle) * minDist;
            }
        }
    }
    
    // Clamp to arena bounds
    x = Math.max(-42, Math.min(42, x));
    z = Math.max(-42, Math.min(42, z));
    
    // Arena 6: Validate spawn position is not inside hazard zones
    if (arena === 6 && hazardZones.length > 0) {
        let spawnAttempts = 0;
        while (!isValidEnemyPosition(x, z, 0.5) && spawnAttempts < 5) {
            // Retry with different angle, biased toward center
            const newAngle = Math.atan2(-z, -x) + (Math.random() - 0.5) * Math.PI;
            const newDist = 20 + Math.random() * 15;
            x = playerPos.x + Math.cos(newAngle) * newDist;
            z = playerPos.z + Math.sin(newAngle) * newDist;
            x = Math.max(-42, Math.min(42, x));
            z = Math.max(-42, Math.min(42, z));
            spawnAttempts++;
        }
        
        // Fallback to center-biased spawn if still invalid
        if (!isValidEnemyPosition(x, z, 0.5)) {
            const fallbackAngle = Math.random() * Math.PI * 2;
            x = Math.cos(fallbackAngle) * 15;  // Near center
            z = Math.sin(fallbackAngle) * 15;
        }
    }
    
    return { x, z };
}

// Helper: Create and configure a single enemy at a specific position
function spawnEnemyAtPosition(enemyType, x, z) {
    const typeData = enemyType.data;
    
    // Throttled: called on every spawn
    logThrottled(`spawn-${enemyType.name}`, 500, 'SPAWN', 'enemy', {
        type: enemyType.name,
        health: typeData.health,
        size: typeData.size
    });
    
    const arenaScale = 1 + (gameState.currentArena - 1) * 0.15;
    const waveScale = 1 + (gameState.currentWave - 1) * 0.05;
    
    // Apply wave modifier health multiplier
    let healthMult = 1.0;
    let xpMult = 1.0;
    if (gameState.waveModifier) {
        const mod = WAVE_MODIFIERS[gameState.waveModifier];
        healthMult = mod.healthMult || 1.0;
        xpMult = mod.xpMult || 1.0;
    }
    
    // Build enemy with visual profile
    const enemy = buildEnemyMesh(typeData);
    
    enemy.position.set(x, typeData.size, z);
    enemy.health = Math.floor(typeData.health * arenaScale * waveScale * healthMult);
    enemy.maxHealth = enemy.health;
    enemy.speed = typeData.speed * (1 + gameState.currentArena * 0.02);
    enemy.damage = Math.floor(typeData.damage * arenaScale);
    enemy.size = typeData.size;
    enemy.baseSize = typeData.size;
    enemy.isBoss = false;
    enemy.isElite = typeData.spawnWeight < 10;
    enemy.xpValue = Math.floor(typeData.xpValue * xpMult);

    // Difficulty scaling (debug lever)
    const difficultyRaw = Number(TUNING.difficultyMultiplier ?? 1.0);
    const difficultyMult = Math.max(0.5, Math.min(2.0, difficultyRaw || 1.0));
    enemy.damage = Math.max(1, Math.floor(enemy.damage * difficultyMult));
    
    // Wave progression XP bonus: +15% per wave after wave 1
    const waveBonus = 1 + (gameState.currentWave - 1) * 0.15;
    enemy.xpValue = Math.floor(enemy.xpValue * waveBonus);
    
    enemy.baseColor = typeData.color;
    enemy.velocityY = 0;
    enemy.velocity = new THREE.Vector3();
    enemy.enemyType = enemyType.name;
    enemy.behavior = typeData.behavior;
    enemy.damageReduction = typeData.damageReduction || 0;
    enemy.onDeath = typeData.onDeath || null;
    enemy.splitCount = typeData.splitCount || 0;
    
    // Shield properties (for shielded enemies)
    if (typeData.shieldHP) {
        enemy.shieldHP = typeData.shieldHP;
        enemy.maxShieldHP = typeData.shieldHP;
        enemy.shieldBroken = false;
        enemy.shieldMesh = createShieldBubble(enemy, enemy.size, 0x4488ff);
    } else {
        enemy.shieldHP = 0;
    }
    
    // Stun properties
    enemy.stunned = false;
    enemy.stunTimer = 0;
    
    // Visual and movement properties
    enemy.movementSignature = typeData.movementSignature || null;
    enemy.telegraph = typeData.telegraph || null;
    enemy.deathVfx = typeData.deathVfx || null;
    enemy.movementTimer = Math.random() * 100;  // Offset for variety
    enemy.telegraphActive = false;
    enemy.telegraphTimer = 0;

    // Debug UX: spawn warning particles for close spawns (helps catch off-screen ambushes)
    if (TUNING.offScreenWarningEnabled) {
        const distToPlayer = enemy.position.distanceTo(player.position);
        if (distToPlayer < 25) {
            spawnParticle(enemy.position.clone(), enemy.baseColor, 4);
        }
    }

    // Debug feature toggle: Elite variants (apply after base stats computed)
    const eliteChanceRaw = Number(TUNING.eliteSpawnChance ?? 0);
    const eliteChance = Math.max(0, Math.min(1, eliteChanceRaw || 0));
    if (!enemy.isElite && eliteChance > 0 && Math.random() < eliteChance) {
        enemy.isElite = true;
        enemy.health = Math.floor(enemy.health * 1.8);
        enemy.maxHealth = enemy.health;
        enemy.damage = Math.floor(enemy.damage * 1.3);
        enemy.eliteVariant = true;

        // Visual pop: golden emissive tint
        const mat = enemy.baseMaterial || enemy.material;
        if (mat && mat.emissive) {
            mat.emissive.setHex(0xffdd44);
            mat.emissiveIntensity = 0.9;
        }
    }
    
    // Behavior-specific properties
    if (typeData.behavior === 'shooter') {
        enemy.shootRange = typeData.shootRange;
        enemy.shootCooldownFrames = Math.floor(typeData.shootCooldown / 16.67);
        enemy.shootTimer = 0;
    }
    if (typeData.behavior === 'bouncer') {
        enemy.velocity.set(
            (Math.random() - 0.5) * enemy.speed * 2,
            0,
            (Math.random() - 0.5) * enemy.speed * 2
        );
        enemy.homingStrength = typeData.homingStrength || 0.001;
    }
    if (typeData.behavior === 'shieldBreaker') {
        enemy.rushRange = typeData.rushRange;
        enemy.rushSpeed = typeData.rushSpeed;
        enemy.isRushing = false;
        enemy.rushWindupTimer = 0;
    }
    if (typeData.behavior === 'waterBalloon') {
        enemy.growRate = typeData.growRate;
        enemy.maxSize = typeData.maxSize;
        enemy.explosionRadius = typeData.explosionRadius;
    }
    if (typeData.behavior === 'teleporter') {
        enemy.teleportCooldownFrames = Math.floor(typeData.teleportCooldown / 16.67);
        enemy.teleportRange = typeData.teleportRange;
        enemy.teleportTimer = 0;
        enemy.teleportWindupTimer = 0;
    }
    if (typeData.behavior === 'pillarHopper') {
        enemy.hopSpeed = typeData.hopSpeed || 0.4;
        enemy.pauseDuration = typeData.pauseDuration || 60;
        enemy.detectionRange = typeData.detectionRange || 6;
        cachePillarPositions();
        if (cachedPillarTops.length > 0) {
            const startPillar = cachedPillarTops[Math.floor(Math.random() * cachedPillarTops.length)];
            enemy.position.x = startPillar.x;
            enemy.position.z = startPillar.z;
            enemy.position.y = startPillar.y + typeData.size;
            enemy.currentPillar = startPillar;
        }
    }
    
    // Mark enemy as encountered for roster (only once per type)
    markEnemyEncountered(enemyType.name);
    
    scene.add(enemy);
    enemies.push(enemy);
    
    return enemy;
}

// School formation tracking
let nextSchoolId = 1;
let lastSchoolSpawnFrame = -9999;  // Start negative so first school isn't blocked by cooldown

// Check if enemy type can form schools
function canSchoolType(typeName) {
    if (!SCHOOL_CONFIG.enabled) return false;
    return !SCHOOL_CONFIG.excludeTypes.includes(typeName);
}

// Count active schools (schools with a living leader)
function countActiveSchools() {
    const schoolIds = new Set();
    for (const enemy of enemies) {
        if (enemy.schoolId && enemy.isSchoolLeader) {
            schoolIds.add(enemy.schoolId);
        }
    }
    return schoolIds.size;
}

// Find the leader of a school
export function findSchoolLeader(schoolId) {
    return enemies.find(e => e.schoolId === schoolId && e.isSchoolLeader);
}

// Get school formation chance for current arena/wave
function getSchoolChance() {
    const arena = gameState.currentArena;
    const wave = gameState.currentWave;
    const arenaConfig = SCHOOL_CONFIG.chanceByWave[`arena${arena}`] || SCHOOL_CONFIG.chanceByWave.default;
    // Use explicit undefined check - 0 is a valid chance value!
    const waveChance = arenaConfig[wave];
    if (waveChance !== undefined) return waveChance;
    return arenaConfig[3] || 0;  // Fallback to wave 3 config for higher waves
}

// Calculate threat cost for an enemy type (local helper, mirrors waveSystem version)
function getEnemyThreatCost(enemyType) {
    const costs = THREAT_BUDGET.costs[enemyType];
    if (!costs) return 20; // Default cost
    return costs.durability + costs.damage;
}

// Spawn a school of enemies with leader/follower formation
// Returns array of spawned enemies for budget tracking
export function spawnSchool(centerX, centerZ, enemyType, schoolSize) {
    const spawned = [];
    const schoolId = nextSchoolId++;
    const spacing = SCHOOL_CONFIG.formationSpacing;
    
    log('SPAWN', 'school', {
        schoolId,
        size: schoolSize,
        type: enemyType.name,
        activeSchools: countActiveSchools(),
        maxSchools: SCHOOL_CONFIG.maxActiveSchools
    });
    
    // Spawn leader at center
    const leader = spawnEnemyAtPosition(enemyType, centerX, centerZ);
    if (!leader) return spawned;
    
    leader.schoolId = schoolId;
    leader.isSchoolLeader = true;
    leader.formationOffset = { x: 0, z: 0 };
    spawned.push(leader);
    
    // Spawn followers around leader in formation
    for (let i = 1; i < schoolSize; i++) {
        // Arrange followers in a V or ring pattern behind leader
        const angle = Math.PI + (i % 2 === 0 ? 1 : -1) * (Math.ceil(i / 2) * 0.5);  // V formation
        const dist = spacing * Math.ceil(i / 2);
        
        const offsetX = Math.cos(angle) * dist;
        const offsetZ = Math.sin(angle) * dist;
        
        let x = centerX + offsetX;
        let z = centerZ + offsetZ;
        
        // Clamp to arena bounds
        x = Math.max(-42, Math.min(42, x));
        z = Math.max(-42, Math.min(42, z));
        
        const follower = spawnEnemyAtPosition(enemyType, x, z);
        if (follower) {
            follower.schoolId = schoolId;
            follower.isSchoolLeader = false;
            follower.formationOffset = { x: offsetX, z: offsetZ };
            spawned.push(follower);
        }
    }
    
    lastSchoolSpawnFrame = gameState.frameCount || 0;
    return spawned;
}

// Handle leader death - promote follower or disband
export function handleSchoolLeaderDeath(deadLeader) {
    const schoolId = deadLeader.schoolId;
    if (!schoolId) return;
    
    // Find all followers of this school
    const followers = enemies.filter(e => e.schoolId === schoolId && !e.isSchoolLeader);
    
    log('SPAWN', 'school_leader_death', {
        schoolId,
        followers: followers.length,
        behavior: SCHOOL_CONFIG.leaderDeathBehavior
    });
    
    if (followers.length === 0) return;
    
    if (SCHOOL_CONFIG.leaderDeathBehavior === 'promote') {
        // Promote first follower to leader
        const newLeader = followers[0];
        const oldLeaderOffset = newLeader.formationOffset || { x: 0, z: 0 };
        
        newLeader.isSchoolLeader = true;
        newLeader.formationOffset = { x: 0, z: 0 };
        
        // FIX: Keep existing formation positions, just adjust offsets relative to new leader
        // Don't recalculate - preserve the current positions by adjusting offsets
        for (let i = 1; i < followers.length; i++) {
            const follower = followers[i];
            if (follower.formationOffset) {
                // Adjust offset relative to new leader's old position
                follower.formationOffset.x -= oldLeaderOffset.x;
                follower.formationOffset.z -= oldLeaderOffset.z;
            }
        }
    } else {
        // Disband - remove school affiliation from all followers
        for (const follower of followers) {
            follower.schoolId = null;
            follower.isSchoolLeader = false;
            follower.formationOffset = null;
        }
    }
}

export function spawnWaveEnemy() {
    // Get arena-aware spawn position
    const spawnPos = getArenaSpawnPosition(player.position, player.velocity);
    let x = spawnPos.x;
    let z = spawnPos.z;
    
    // Use budget-aware enemy selection if pool exists
    const enemyType = selectEnemyByBudget();
    if (!enemyType) return null; // No affordable enemy
    
    const typeData = enemyType.data;
    
    // Check for school formation spawn
    const arena = gameState.currentArena;
    const wave = gameState.currentWave;
    const schoolChance = getSchoolChance();
    const currentFrame = gameState.frameCount || 0;
    const cooldownOk = (currentFrame - lastSchoolSpawnFrame) >= SCHOOL_CONFIG.spawnCooldownFrames;
    const underSchoolCap = countActiveSchools() < SCHOOL_CONFIG.maxActiveSchools;
    
    const schoolRoll = Math.random();
    const shouldSpawnSchool = SCHOOL_CONFIG.enabled && 
                              cooldownOk &&
                              underSchoolCap &&
                              canSchoolType(enemyType.name) &&
                              schoolRoll < schoolChance;
    
    // Throttled school chance log (only log successful spawns)
    if (schoolChance > 0 && shouldSpawnSchool) {
        logThrottled('school-chance', 2000, 'SPAWN', 'school_decision', {
            chance: parseFloat((schoolChance * 100).toFixed(0)),
            roll: parseFloat((schoolRoll * 100).toFixed(0)),
            spawning: shouldSpawnSchool
        });
    }
    
    if (shouldSpawnSchool) {
        // Spawn a school with leader/follower formation
        const { min, max } = SCHOOL_CONFIG.schoolSize;
        const schoolSize = min + Math.floor(Math.random() * (max - min + 1));
        
        // Check budget can afford school (at least 3 enemies for meaningful formation)
        const cost = getEnemyThreatCost(enemyType.name);
        const cognitive = THREAT_BUDGET.costs[enemyType.name]?.cognitive || 1;
        const budgetRemaining = gameState.waveBudgetRemaining || 0;
        const affordableCount = Math.min(schoolSize, Math.floor(budgetRemaining / cost));
        
        if (affordableCount >= 3) {
            const spawned = spawnSchool(x, z, enemyType, affordableCount);
            
            // Deduct budget for extra enemies (first one handled by caller)
            // waveSystem will deduct for spawned[0], so we deduct for spawned[1..n]
            for (let i = 1; i < spawned.length; i++) {
                gameState.waveBudgetRemaining -= cost;
                gameState.waveCognitiveUsed += cognitive;
                gameState.waveSpawnCount++;
            }
            
            return spawned.length > 0 ? spawned[0] : null;
        }
        // Fall through to single spawn if can't afford school
    }
    
    // Bouncer spawn validation - prevent spawning into immediate collision
    if (typeData.behavior === 'bouncer') {
        let spawnAttempts = 0;
        let validSpawn = false;
        
        while (!validSpawn && spawnAttempts < 5) {
            let immediateCollision = false;
            for (const obs of obstacles) {
                const c = obs.collisionData;
                if (!c) continue;
                if (x > c.minX - 2 && x < c.maxX + 2 &&
                    z > c.minZ - 2 && z < c.maxZ + 2) {
                    immediateCollision = true;
                    break;
                }
            }
            
            if (!immediateCollision) {
                validSpawn = true;
            } else {
                const angle = Math.random() * Math.PI * 2;
                const dist = 28 + Math.random() * 12;
                x = Math.max(-42, Math.min(42, player.position.x + Math.cos(angle) * dist));
                z = Math.max(-42, Math.min(42, player.position.z + Math.sin(angle) * dist));
                spawnAttempts++;
            }
        }
    }
    
    // Spawn single enemy
    const enemy = spawnEnemyAtPosition(enemyType, x, z);
    
    // Show tutorial callout for special enemies
    if (enemyType.name === 'pillarPolice') {
        showTutorialCallout('pillarPolice', 'Climb to reach them!', 2000);
    }
    if (enemyType.name === 'teleporter') {
        showTutorialCallout('teleporter', 'Watch for the destination marker!', 2000);
    }
    
    return enemy;
}

// Budget-aware enemy selection using wave pool and cognitive caps
function selectEnemyByBudget() {
    const arena = gameState.currentArena;
    const wave = gameState.currentWave;
    const pool = gameState.waveEnemyPool || null;
    const budgetRemaining = gameState.waveBudgetRemaining || 999;
    const cognitiveMax = gameState.waveCognitiveMax || 99;
    const cognitiveUsed = gameState.waveCognitiveUsed || 0;
    // Filter available types by pool and budget
    const availableTypes = [];
    let totalWeight = 0;
    
    for (const [typeName, typeData] of Object.entries(ENEMY_TYPES)) {
        // Skip enemies with spawnWeight 0
        if (typeData.spawnWeight === 0) continue;
        
        // Skip boss-only minions
        if (typeData.isBossMinion) continue;
        
        // Skip enemies gated by maxArena
        if (typeData.maxArena && arena > typeData.maxArena) continue;
        
        // Skip enemies gated by minWave (e.g., gruntTiny only in Wave 2+)
        if (typeData.minWave && wave < typeData.minWave) continue;
        
        // Skip if not in wave pool (cognitive caps)
        if (pool && pool.length > 0 && !pool.includes(typeName)) continue;
        
        // Skip if at cap
        const cap = getCapForEnemy(typeName, arena);
        const currentCount = countEnemiesOfType(typeName);
        if (currentCount >= cap) continue;
        
        // Skip if too expensive for remaining budget
        const costs = THREAT_BUDGET.costs[typeName] || { durability: 20, damage: 10, cognitive: 2 };
        const totalCost = costs.durability + costs.damage;
        if (totalCost > budgetRemaining) continue;
        
        // Skip if would exceed cognitive cap
        if (cognitiveUsed + costs.cognitive > cognitiveMax) continue;
        
        // Progressive introduction using arenaIntro
        if (typeData.arenaIntro && typeData.arenaIntro > arena) continue;
        
        availableTypes.push({ name: typeName, data: typeData, cost: totalCost });
        
        // Featured enemy bonus
        const arenaConfigRef = ARENA_CONFIG.arenas[arena];
        const featured = arenaConfigRef?.lessonEnemy;
        let weight = typeData.spawnWeight;
        if (typeName === featured) {
            weight *= COGNITIVE_LIMITS.featuredTypeBonus;
        }
        totalWeight += weight;
    }
    
    // Fallback if no enemies available
    if (availableTypes.length === 0) {
        // Only fallback to grunt if it's in the wave pool (or no pool restriction)
        const gruntInPool = !pool || pool.length === 0 || pool.includes('grunt');
        if (gruntInPool) {
            const gruntCost = (THREAT_BUDGET.costs.grunt?.durability || 12) + (THREAT_BUDGET.costs.grunt?.damage || 10);
            if (gruntCost <= budgetRemaining) {
                return { name: 'grunt', data: ENEMY_TYPES.grunt, cost: gruntCost };
            }
        }
        
        // If grunt not in pool, try gruntTiny as last resort (it's always affordable)
        const tinyInPool = !pool || pool.length === 0 || pool.includes('gruntTiny');
        if (tinyInPool) {
            const tinyCost = (THREAT_BUDGET.costs.gruntTiny?.durability || 5) + (THREAT_BUDGET.costs.gruntTiny?.damage || 4);
            if (tinyCost <= budgetRemaining) {
                return { name: 'gruntTiny', data: ENEMY_TYPES.gruntTiny, cost: tinyCost };
            }
        }
        
        return null; // Budget exhausted or no pool-valid fallback
    }
    
    // Weighted random selection
    let random = Math.random() * totalWeight;
    const arenaConfigRef = ARENA_CONFIG.arenas[arena];
    const featured = arenaConfigRef?.lessonEnemy;
    
    for (const type of availableTypes) {
        let weight = type.data.spawnWeight;
        if (type.name === featured) {
            weight *= COGNITIVE_LIMITS.featuredTypeBonus;
        }
        random -= weight;
        if (random <= 0) {
            return type;
        }
    }
    
    return availableTypes[0];
}

export function spawnSplitEnemy(position, parentSize, index = 0, totalCount = 3) {
    const size = parentSize * 0.4;
    
    // Splitlings are simple smooth spheres with bright glow
    const material = new THREE.MeshStandardMaterial({
        color: 0xff66ff,
        emissive: 0xff44ff,
        emissiveIntensity: 0.5
    });
    const geometry = getCachedSphereGeometry(size, 10);
    const enemy = new THREE.Mesh(geometry, material);
    enemy.castShadow = true;
    enemy.baseMaterial = material;
    
    // Spread splitlings outward in a ring pattern for better corridor handling
    const spreadDist = 3;  // Increased from ±1 to 3 units
    const angle = (index / totalCount) * Math.PI * 2 + Math.random() * 0.5;
    
    let spawnX = position.x + Math.cos(angle) * spreadDist;
    let spawnZ = position.z + Math.sin(angle) * spreadDist;
    
    // Push out of obstacles to prevent wall spawns
    for (const obs of obstacles) {
        const c = obs.collisionData;
        if (!c) continue;
        
        if (spawnX > c.minX - size && spawnX < c.maxX + size &&
            spawnZ > c.minZ - size && spawnZ < c.maxZ + size) {
            // Push away from obstacle center
            const obsX = (c.minX + c.maxX) / 2;
            const obsZ = (c.minZ + c.maxZ) / 2;
            const pushDir = new THREE.Vector3(spawnX - obsX, 0, spawnZ - obsZ);
            if (pushDir.length() > 0.01) {
                pushDir.normalize();
                spawnX += pushDir.x * 2;
                spawnZ += pushDir.z * 2;
            }
        }
    }
    
    // Push away from hazard zones to prevent hazard spawns
    for (const hz of hazardZones) {
        const dist = Math.sqrt(
            (spawnX - hz.position.x) ** 2 + 
            (spawnZ - hz.position.z) ** 2
        );
        
        if (dist < hz.radius + size + 2) {
            // Push outward from hazard center
            const pushDir = new THREE.Vector3(
                spawnX - hz.position.x,
                0,
                spawnZ - hz.position.z
            );
            if (pushDir.length() > 0.01) {
                pushDir.normalize();
                const pushDist = hz.radius + size + 2 - dist;
                spawnX += pushDir.x * pushDist;
                spawnZ += pushDir.z * pushDist;
            }
        }
    }
    
    // Clamp to arena bounds
    spawnX = Math.max(-42, Math.min(42, spawnX));
    spawnZ = Math.max(-42, Math.min(42, spawnZ));
    
    enemy.position.set(spawnX, size, spawnZ);
    
    enemy.health = 5;
    enemy.maxHealth = 5;
    enemy.speed = 0.05;
    enemy.damage = 5;
    enemy.size = size;
    enemy.baseSize = size;
    enemy.isBoss = false;
    enemy.isElite = false;
    enemy.xpValue = 3;       // Tripled from 1
    enemy.baseColor = 0xff66ff;
    enemy.velocityY = 0;
    enemy.velocity = new THREE.Vector3();
    enemy.enemyType = 'splitling';
    enemy.behavior = 'chase';
    enemy.damageReduction = 0;
    enemy.movementSignature = 'sway';
    enemy.movementTimer = Math.random() * 100;
    enemy.deathVfx = { color: 0xff66ff, count: 6, type: 'burst' };
    
    // Brief spawn stun gives player reaction time (0.5s at 60fps)
    enemy.stunned = true;
    enemy.stunTimer = SPLITLING_SPAWN_STUN_FRAMES;
    
    scene.add(enemy);
    enemies.push(enemy);
}

export function spawnSpecificEnemy(typeName, nearPosition) {
    const typeData = ENEMY_TYPES[typeName];
    if (!typeData) return;
    
    const angle = Math.random() * Math.PI * 2;
    const dist = 3 + Math.random() * 5;
    const x = Math.max(-42, Math.min(42, nearPosition.x + Math.cos(angle) * dist));
    const z = Math.max(-42, Math.min(42, nearPosition.z + Math.sin(angle) * dist));
    
    // Build enemy with visual profile
    const enemy = buildEnemyMesh(typeData);
    
    enemy.position.set(x, typeData.size, z);
    enemy.health = typeData.health;
    enemy.maxHealth = typeData.health;
    enemy.speed = typeData.speed;
    enemy.damage = typeData.damage;
    enemy.size = typeData.size;
    enemy.baseSize = typeData.size;
    enemy.isBoss = false;
    enemy.isElite = false;
    enemy.xpValue = typeData.xpValue;
    enemy.baseColor = typeData.color;
    enemy.velocityY = 0;
    enemy.velocity = new THREE.Vector3();
    enemy.enemyType = typeName;
    enemy.behavior = typeData.behavior;
    enemy.damageReduction = typeData.damageReduction || 0;
    
    // Visual and movement properties
    enemy.movementSignature = typeData.movementSignature || null;
    enemy.telegraph = typeData.telegraph || null;
    enemy.deathVfx = typeData.deathVfx || null;
    enemy.movementTimer = Math.random() * 100;
    enemy.telegraphActive = false;
    enemy.telegraphTimer = 0;
    
    if (typeData.behavior === 'bouncer') {
        enemy.velocity.set(
            (Math.random() - 0.5) * enemy.speed * 2,
            0,
            (Math.random() - 0.5) * enemy.speed * 2
        );
        enemy.homingStrength = typeData.homingStrength || 0.001;
    }
    if (typeData.behavior === 'teleporter') {
        // Convert ms cooldown to frames (60fps = 16.67ms per frame)
        enemy.teleportCooldownFrames = Math.floor(typeData.teleportCooldown / 16.67);
        enemy.teleportRange = typeData.teleportRange;
        enemy.teleportTimer = enemy.teleportCooldownFrames; // Start ready to teleport
        enemy.teleportWindupTimer = 0;
    }
    if (typeData.behavior === 'waterBalloon') {
        enemy.growRate = typeData.growRate;
        enemy.maxSize = typeData.maxSize;
        enemy.explosionRadius = typeData.explosionRadius;
    }
    if (typeData.behavior === 'shieldBreaker') {
        enemy.rushRange = typeData.rushRange;
        enemy.rushSpeed = typeData.rushSpeed;
        enemy.isRushing = false;
        enemy.rushWindupTimer = 0;
    }
    if (typeData.behavior === 'pillarHopper') {
        enemy.hopSpeed = typeData.hopSpeed;
        enemy.pauseDuration = typeData.pauseDuration;
        enemy.detectionRange = typeData.detectionRange;
        // Cache pillar positions on first pillar hopper spawn
        cachePillarPositions();
        // Start on a random pillar
        if (cachedPillarTops.length > 0) {
            const startPillar = cachedPillarTops[Math.floor(Math.random() * cachedPillarTops.length)];
            enemy.position.x = startPillar.x;
            enemy.position.z = startPillar.z;
            enemy.position.y = startPillar.y + typeData.size;
            enemy.currentPillar = startPillar;
        }
    }
    
    scene.add(enemy);
    enemies.push(enemy);
}

// Spawn Pillar Police on all pillars (for Arena 2-3)
// Skips the pillar the player is currently on
export function spawnPillarPoliceOnAllPillars() {
    cachePillarPositions();
    
    if (cachedPillarTops.length === 0) return;
    
    const playerPillar = getPlayerPillar();
    const typeData = ENEMY_TYPES.pillarPolice;
    
    for (const pillar of cachedPillarTops) {
        // Skip pillar if player is standing on it
        if (playerPillar && pillar === playerPillar) continue;
        
        // Build the pillar police enemy
        const enemy = buildEnemyMesh(typeData);
        
        // Position on top of pillar
        enemy.position.set(pillar.x, pillar.y + typeData.size, pillar.z);
        
        // Set stats
        const arenaScale = 1 + (gameState.currentArena - 1) * 0.15;
        const waveScale = 1 + (gameState.currentWave - 1) * 0.05;
        
        enemy.health = Math.floor(typeData.health * arenaScale * waveScale);
        enemy.maxHealth = enemy.health;
        enemy.speed = typeData.speed * (1 + gameState.currentArena * 0.02);
        enemy.damage = Math.floor(typeData.damage * arenaScale);
        enemy.size = typeData.size;
        enemy.baseSize = typeData.size;
        enemy.isBoss = false;
        enemy.isElite = false;
        enemy.xpValue = typeData.xpValue;
        enemy.baseColor = typeData.color;
        enemy.velocityY = 0;
        enemy.velocity = new THREE.Vector3();
        enemy.enemyType = 'pillarPolice';
        enemy.behavior = typeData.behavior;
        enemy.damageReduction = typeData.damageReduction || 0;
        
        // Visual and movement properties
        enemy.movementSignature = typeData.movementSignature || null;
        enemy.telegraph = typeData.telegraph || null;
        enemy.deathVfx = typeData.deathVfx || null;
        enemy.movementTimer = Math.random() * 100;
        enemy.telegraphActive = false;
        enemy.telegraphTimer = 0;
        
        // Pillar hopper specific properties
        enemy.hopSpeed = typeData.hopSpeed;
        enemy.pauseDuration = typeData.pauseDuration;
        enemy.detectionRange = typeData.detectionRange;
        enemy.currentPillar = pillar;
        enemy.hopState = 'idle';
        enemy.hopTimer = 0;
        enemy.targetPillar = null;
        enemy.hopVelocity = new THREE.Vector3();
        
        // Mark as encountered for roster
        markEnemyEncountered('pillarPolice');
        
        scene.add(enemy);
        enemies.push(enemy);
    }
}

export function updateEnemies(delta) {
    // Tick frame-based damage cooldown
    tickDamageCooldown();
    
    // ==================== ENEMY-ENEMY SEPARATION ====================
    // Push overlapping enemies apart to prevent stacking
    // Only run when enough enemies to matter (O(n²) cost)
    if (enemies.length >= 8) {
        const SEPARATION_STRENGTH = 0.15;  // How strongly enemies push each other
        const MIN_SEPARATION = 0.1;  // Minimum distance to apply separation
        
        for (let i = 0; i < enemies.length; i++) {
        const enemyA = enemies[i];
        const sizeA = enemyA.size || 0.5;
        
        for (let j = i + 1; j < enemies.length; j++) {
            const enemyB = enemies[j];
            const sizeB = enemyB.size || 0.5;
            
            const dx = enemyB.position.x - enemyA.position.x;
            const dz = enemyB.position.z - enemyA.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            const minDist = sizeA + sizeB;
            
            if (dist < minDist && dist > MIN_SEPARATION) {
                // Calculate overlap amount
                const overlap = minDist - dist;
                
                // Normalize direction
                const nx = dx / dist;
                const nz = dz / dist;
                
                // Push both enemies apart (half each)
                const pushAmount = overlap * SEPARATION_STRENGTH;
                enemyA.position.x -= nx * pushAmount;
                enemyA.position.z -= nz * pushAmount;
                enemyB.position.x += nx * pushAmount;
                enemyB.position.z += nz * pushAmount;
            }
        }
        }
    }
    
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        if (!enemy.velocityY) enemy.velocityY = 0;
        if (!enemy.movementTimer) enemy.movementTimer = 0;
        enemy.movementTimer++;
        
        // Update shield visual (shieldMesh is null when broken)
        if (enemy.shieldMesh) {
            const shieldPercent = enemy.shieldHP / enemy.maxShieldHP;
            updateShieldVisual(enemy.shieldMesh, shieldPercent);
        }
        
        // Handle stun
        if (enemy.stunned) {
            enemy.stunTimer--;
            if (enemy.stunTimer <= 0) {
                enemy.stunned = false;
            }
            // Skip movement/behavior while stunned
            continue;
        }
        
        // Handle freeze (boss transition safety)
        if (enemy.frozen) {
            enemy.frozenTimer--;
            if (enemy.frozenTimer <= 0) {
                enemy.frozen = false;
                // Throttled: multiple enemies may unfreeze together
                logThrottled('freeze-expire', 500, 'SAFETY', 'freeze_expired', {
                    remainingFrozen: enemies.filter(e => e.frozen).length
                });
            }
            // Skip movement/behavior while frozen
            continue;
        }
        
        switch (enemy.behavior) {
            case 'chase': updateChaseEnemy(enemy); break;
            case 'shooter': updateShooterEnemy(enemy); break;
            case 'bouncer': updateBouncerEnemy(enemy); break;
            case 'shieldBreaker': updateShieldBreakerEnemy(enemy); break;
            case 'waterBalloon': updateWaterBalloonEnemy(enemy); break;
            case 'teleporter': updateTeleporterEnemy(enemy); break;
            case 'pillarHopper': updatePillarHopperEnemy(enemy); break;
            default: updateChaseEnemy(enemy);
        }
        
        // School formation update - followers track their leader
        if (enemy.schoolId && !enemy.isSchoolLeader && enemy.formationOffset) {
            const leader = findSchoolLeader(enemy.schoolId);
            if (leader) {
                // Calculate target position (leader position + formation offset)
                const targetX = leader.position.x + enemy.formationOffset.x;
                const targetZ = leader.position.z + enemy.formationOffset.z;
                
                // Smoothly interpolate toward formation position
                const tightness = SCHOOL_CONFIG.formationTightness;
                enemy.position.x += (targetX - enemy.position.x) * tightness;
                enemy.position.z += (targetZ - enemy.position.z) * tightness;
            }
            // If leader is dead, handleSchoolLeaderDeath will be called from damage system
        }
        
        // Shielded enemy "enrage" anti-camping mechanic
        // If stuck for too long, speed up to prevent players from camping behind cover
        if (enemy.enemyType === 'shielded' && !enemy.enraged) {
            // Initialize tracking
            if (!enemy.lastPosition) {
                enemy.lastPosition = enemy.position.clone();
                enemy.stuckTimer = 0;
            }
            
            // Check if enemy has barely moved
            const moved = enemy.position.distanceTo(enemy.lastPosition);
            if (moved < 0.01) {
                enemy.stuckTimer++;
            } else {
                enemy.stuckTimer = Math.max(0, enemy.stuckTimer - 2);  // Cool down faster than heat up
            }
            enemy.lastPosition.copy(enemy.position);
            
            // After ~2 seconds stuck (120 frames at 60fps), trigger enrage
            if (enemy.stuckTimer > 120) {
                enemy.enraged = true;
                enemy.speed *= 1.5;  // 50% speed boost
                enemy.stuckTimer = 0;
                
                // Visual feedback - increase emissive glow
                if (enemy.baseMaterial) {
                    enemy.baseMaterial.emissiveIntensity = 0.8;
                    enemy.baseMaterial.emissive.setHex(0xff4444);  // Red tint when enraged
                }
            }
        }
        
        // Apply movement signatures
        applyMovementSignature(enemy);
        
        // Update telegraph state
        updateTelegraph(enemy);
        
        // Gravity
        enemy.velocityY -= 0.012;
        enemy.position.y += enemy.velocityY;
        
        // Ground collision
        let groundY = enemy.baseSize * enemy.scale.x;
        if (gameState.unlockedEnemyBehaviors.jumping) {
            for (const obs of obstacles) {
                const c = obs.collisionData;
                const s = enemy.baseSize * enemy.scale.x;
                if (enemy.position.x + s > c.minX && 
                    enemy.position.x - s < c.maxX && 
                    enemy.position.z + s > c.minZ && 
                    enemy.position.z - s < c.maxZ && 
                    enemy.position.y >= c.topY) {
                    groundY = Math.max(groundY, c.topY + s);
                }
            }
        }
        if (enemy.position.y < groundY) {
            enemy.position.y = groundY;
            enemy.velocityY = 0;
        }
        
        // Mini porcupinefish enemies face the player; others spin
        if (enemy.isMiniPorcupinefish) {
            // Face toward player (calculate angle from enemy to player)
            const dx = player.position.x - enemy.position.x;
            const dz = player.position.z - enemy.position.z;
            enemy.rotation.y = Math.atan2(dx, dz);
        } else {
            enemy.rotation.y += 0.04;
        }
        
        // Player collision (using frame-based damage cooldown)
        const scaledSize = enemy.baseSize * enemy.scale.x;
        if (enemy.position.distanceTo(player.position) < scaledSize + 0.5) {
            if (canTakeCollisionDamage()) {
                const typeName = ENEMY_TYPES[enemy.enemyType]?.name || enemy.enemyType || 'Enemy';
                takeDamage(enemy.damage, typeName, 'enemy');
                resetDamageCooldown();
            }
            tempVec3.subVectors(enemy.position, player.position).normalize();
            enemy.position.add(tempVec3.multiplyScalar(0.5));
        }
    }
}

// Apply movement signature visual effects
function applyMovementSignature(enemy) {
    if (!enemy.movementSignature) return;
    
    const t = enemy.movementTimer;
    const profile = enemy.visualProfile;
    
    switch (enemy.movementSignature) {
        case 'sway':
            // Slight lean into movement direction
            enemy.rotation.z = Math.sin(t * 0.1) * 0.15;
            enemy.rotation.x = Math.cos(t * 0.08) * 0.1;
            break;
            
        case 'strafe':
            // Orbital wobble effect
            enemy.rotation.z = Math.sin(t * 0.15) * 0.2;
            break;
            
        case 'stomp':
            // Slow pulse effect for shielded enemies
            const stompScale = 1 + Math.sin(t * 0.05) * 0.05;
            enemy.scale.setScalar(stompScale);
            break;
            
        case 'squash':
            // Squash and stretch on bounces
            const squashY = 1 + Math.abs(enemy.velocityY || 0) * 3;
            const squashXZ = 1 / Math.sqrt(squashY);
            enemy.scale.set(squashXZ, squashY, squashXZ);
            break;
            
        case 'inertia':
            // Heavy rotation lag + pulsing glow
            enemy.rotation.z = Math.sin(t * 0.03) * 0.1;
            // Pulse effect for splitter
            if (profile?.type === 'pulse' && enemy.baseMaterial) {
                const pulseIntensity = profile.glowIntensity + Math.sin(t * profile.pulseSpeed) * profile.pulseRange;
                enemy.baseMaterial.emissiveIntensity = pulseIntensity;
            }
            break;
            
        case 'jitter':
            // Micro-jitters, especially before rush
            if (enemy.isRushing || enemy.rushWindupTimer > 0) {
                enemy.position.x += (Math.random() - 0.5) * 0.05;
                enemy.position.z += (Math.random() - 0.5) * 0.05;
            } else {
                enemy.rotation.z = (Math.random() - 0.5) * 0.05;
            }
            break;
            
        case 'wobble':
            // Wobble + bob as it grows (water balloon)
            const wobbleScale = enemy.size / enemy.baseSize;
            enemy.rotation.z = Math.sin(t * 0.12) * 0.2 * wobbleScale;
            enemy.rotation.x = Math.cos(t * 0.1) * 0.15 * wobbleScale;
            // Bob up and down slightly
            enemy.position.y += Math.sin(t * 0.08) * 0.02;
            break;
            
        case 'stutter':
            // Time-skip stutter effect (flicker visibility)
            if (profile?.type === 'flicker') {
                enemy.visible = Math.random() > 0.15;
            } else if (t % 15 < 2) {
                enemy.visible = false;
            } else {
                enemy.visible = true;
            }
            break;
            
        case 'hop':
            // Handled by pillarHopper behavior directly
            // Just add a subtle rotation
            enemy.rotation.y += 0.05;
            break;
            
        case 'orbiter':
            // Two spheres orbiting each other (flying drone effect)
            if (enemy.isOrbiter && enemy.sphere1 && enemy.sphere2) {
                enemy.orbitAngle += enemy.orbitSpeed || 0.15;
                const r = enemy.orbitRadius || 0.2;
                
                // Position spheres in orbit around center
                enemy.sphere1.position.x = Math.cos(enemy.orbitAngle) * r;
                enemy.sphere1.position.z = Math.sin(enemy.orbitAngle) * r;
                enemy.sphere1.position.y = Math.sin(enemy.orbitAngle * 2) * r * 0.3;  // Slight vertical wobble
                
                enemy.sphere2.position.x = Math.cos(enemy.orbitAngle + Math.PI) * r;
                enemy.sphere2.position.z = Math.sin(enemy.orbitAngle + Math.PI) * r;
                enemy.sphere2.position.y = Math.sin((enemy.orbitAngle + Math.PI) * 2) * r * 0.3;
                
                // Add subtle pulsing glow
                const glowPulse = 0.8 + Math.sin(t * 0.1) * 0.2;
                if (enemy.sphere1.material) enemy.sphere1.material.emissiveIntensity = glowPulse;
                if (enemy.sphere2.material) enemy.sphere2.material.emissiveIntensity = glowPulse;
            }
            break;
    }
    
    // Update orbiting particles for 'orbit' type profiles (e.g., shielded enemies)
    if (profile?.type === 'orbit' && enemy.orbitParticles) {
        enemy.orbitParticles.forEach(p => {
            p.orbitAngle += profile.orbitSpeed || 0.03;
            p.position.x = Math.cos(p.orbitAngle) * p.orbitRadius;
            p.position.z = Math.sin(p.orbitAngle) * p.orbitRadius;
            p.position.y = Math.sin(p.orbitAngle * 2) * 0.3;
        });
    }
    
    // Apply pulse glow effect for glow/pulse profiles
    if (profile && (profile.type === 'glow' || profile.type === 'pulse') && profile.pulseSpeed > 0 && enemy.baseMaterial) {
        const baseIntensity = profile.glowIntensity || 0.3;
        const pulseRange = profile.pulseRange || 0.15;
        enemy.baseMaterial.emissiveIntensity = baseIntensity + Math.sin(t * profile.pulseSpeed) * pulseRange;
    }
}

// Update telegraph visual state
function updateTelegraph(enemy) {
    if (!enemy.telegraph) return;
    
    // Check if telegraph should be active based on enemy behavior
    let shouldTelegraph = false;
    
    if (enemy.behavior === 'shieldBreaker' && enemy.rushWindupTimer > 0) {
        shouldTelegraph = true;
    } else if (enemy.behavior === 'shooter') {
        const dist = enemy.position.distanceTo(player.position);
        // Check if nearing shoot time (within 30 frames of shooting)
        const framesUntilShoot = enemy.shootCooldownFrames - (enemy.shootTimer || 0);
        const telegraphMultRaw = Number(TUNING.telegraphDurationMult ?? 1.0);
        const telegraphMult = Math.max(0.5, Math.min(2.0, telegraphMultRaw || 1.0));
        const baseTelegraphFrames = enemy.telegraph.duration ? Math.floor(enemy.telegraph.duration / 16.67) : 30;
        const telegraphFrames = Math.max(1, Math.floor(baseTelegraphFrames * telegraphMult));
        if (dist < enemy.shootRange && framesUntilShoot < telegraphFrames) {
            shouldTelegraph = true;
        }
    } else if (enemy.behavior === 'teleporter' && enemy.teleportWindupTimer > 0) {
        shouldTelegraph = true;
    } else if (enemy.behavior === 'waterBalloon' && enemy.size >= enemy.maxSize * 0.9) {
        shouldTelegraph = true;
    }
    
    // Apply telegraph visual - simple emissive glow change (use frame counter for animation)
    const mat = enemy.baseMaterial || enemy.material;
    if (shouldTelegraph && mat && mat.emissive) {
        mat.emissiveIntensity = 0.7 + Math.sin(enemy.movementTimer * 0.12) * 0.3;
    } else if (mat && mat.emissive) {
        const profile = enemy.visualProfile;
        mat.emissiveIntensity = profile?.glowIntensity || 0.3;
    }
}

// Calculate steering force to avoid obstacles (pillars, cover blocks)
// Uses look-ahead collision detection to steer around obstacles
function calculateSteeringForce(enemy, desiredDir) {
    const steer = new THREE.Vector3();
    const lookAhead = 3;  // Look 3 units ahead
    const futurePos = enemy.position.clone().add(desiredDir.clone().multiplyScalar(lookAhead));
    
    for (const obs of obstacles) {
        const c = obs.collisionData;
        if (!c) continue;
        
        // Check if future position would collide with obstacle
        const buffer = enemy.size + 0.5;  // Add buffer around enemy
        if (futurePos.x > c.minX - buffer &&
            futurePos.x < c.maxX + buffer &&
            futurePos.z > c.minZ - buffer &&
            futurePos.z < c.maxZ + buffer) {
            
            // Calculate push-away direction from obstacle center
            const obsCenter = new THREE.Vector3(
                (c.minX + c.maxX) / 2,
                0,
                (c.minZ + c.maxZ) / 2
            );
            const awayDir = enemy.position.clone().sub(obsCenter);
            awayDir.y = 0;
            awayDir.normalize();
            
            // Stronger steering when closer to obstacle
            const distToObs = enemy.position.distanceTo(obsCenter);
            const steerStrength = Math.max(0.3, 1.0 - distToObs / 10);
            steer.add(awayDir.multiplyScalar(steerStrength));
        }
    }
    
    return steer;
}

function updateChaseEnemy(enemy) {
    const dist = enemy.position.distanceTo(player.position);
    const tuningMult = getEnemySpeedTuningMultiplier();
    
    // Closing speed acceleration - enemies speed up when close to player
    let speedMultiplier = 1.0;
    if (dist < 10) speedMultiplier = 1.5;       // 50% faster when very close
    else if (dist < 20) speedMultiplier = 1.2;  // 20% faster when medium range
    
    // Calculate desired direction toward player
    tempVec3.subVectors(player.position, enemy.position);
    tempVec3.y = 0;
    tempVec3.normalize();
    
    // Apply obstacle steering to avoid getting stuck on pillars
    const steerForce = calculateSteeringForce(enemy, tempVec3);
    tempVec3.add(steerForce);
    tempVec3.normalize();
    
    enemy.position.x += tempVec3.x * enemy.speed * speedMultiplier * tuningMult;
    enemy.position.z += tempVec3.z * enemy.speed * speedMultiplier * tuningMult;
    
    if (gameState.unlockedEnemyBehaviors.jumping) {
        for (const obs of obstacles) {
            const c = obs.collisionData;
            const s = enemy.baseSize * enemy.scale.x;
            if (enemy.position.x + s > c.minX && 
                enemy.position.x - s < c.maxX && 
                enemy.position.z + s > c.minZ && 
                enemy.position.z - s < c.maxZ) {
                if (enemy.velocityY <= 0 && enemy.position.y < c.topY + s + 0.5) {
                    enemy.velocityY = 0.1;
                }
            }
        }
    }
}

function updateShooterEnemy(enemy) {
    const dist = enemy.position.distanceTo(player.position);
    const tuningMult = getEnemySpeedTuningMultiplier();
    
    // Increment shoot timer
    enemy.shootTimer = (enemy.shootTimer || 0) + 1;
    
    if (dist > enemy.shootRange) {
        tempVec3.subVectors(player.position, enemy.position);
        tempVec3.y = 0;
        tempVec3.normalize();
        enemy.position.x += tempVec3.x * enemy.speed * tuningMult;
        enemy.position.z += tempVec3.z * enemy.speed * tuningMult;
    } else if (dist < enemy.shootRange * 0.5) {
        tempVec3.subVectors(enemy.position, player.position);
        tempVec3.y = 0;
        tempVec3.normalize();
        enemy.position.x += tempVec3.x * enemy.speed * 0.5 * tuningMult;
        enemy.position.z += tempVec3.z * enemy.speed * 0.5 * tuningMult;
    }
    
    // Frame-based shooting cooldown
    if (dist < enemy.shootRange && enemy.shootTimer >= enemy.shootCooldownFrames) {
        spawnEnemyProjectile(enemy, player.position.clone());
        enemy.shootTimer = 0;
    }
}

function updateBouncerEnemy(enemy) {
    const tuningMult = getEnemySpeedTuningMultiplier();
    enemy.position.x += enemy.velocity.x * tuningMult;
    enemy.position.z += enemy.velocity.z * tuningMult;
    
    // Wall bouncing
    if (enemy.position.x < -42 || enemy.position.x > 42) {
        enemy.velocity.x *= -1;
        enemy.position.x = Math.max(-42, Math.min(42, enemy.position.x));
    }
    if (enemy.position.z < -42 || enemy.position.z > 42) {
        enemy.velocity.z *= -1;
        enemy.position.z = Math.max(-42, Math.min(42, enemy.position.z));
    }
    
    // Obstacle bouncing (proper reflection - only invert perpendicular axis)
    for (const obs of obstacles) {
        const c = obs.collisionData;
        if (!c) continue;
        
        const inX = enemy.position.x + enemy.size > c.minX && 
                    enemy.position.x - enemy.size < c.maxX;
        const inZ = enemy.position.z + enemy.size > c.minZ && 
                    enemy.position.z - enemy.size < c.maxZ;
        
        if (inX && inZ && enemy.position.y < c.topY + enemy.size) {
            // Determine which face was hit based on overlap
            const overlapX = Math.min(
                enemy.position.x + enemy.size - c.minX,
                c.maxX - enemy.position.x + enemy.size
            );
            const overlapZ = Math.min(
                enemy.position.z + enemy.size - c.minZ,
                c.maxZ - enemy.position.z + enemy.size
            );
            
            if (overlapX < overlapZ) {
                // Hit X face - invert X velocity only
                enemy.velocity.x *= -1;
                if (enemy.position.x < (c.minX + c.maxX) / 2) {
                    enemy.position.x = c.minX - enemy.size;
                } else {
                    enemy.position.x = c.maxX + enemy.size;
                }
            } else {
                // Hit Z face - invert Z velocity only
                enemy.velocity.z *= -1;
                if (enemy.position.z < (c.minZ + c.maxZ) / 2) {
                    enemy.position.z = c.minZ - enemy.size;
                } else {
                    enemy.position.z = c.maxZ + enemy.size;
                }
            }
            
            // Prevent multiple bounces in same frame
            break;
        }
    }
    
    // Slight homing (configurable strength)
    const homingStrength = enemy.homingStrength || 0.001;
    tempVec3.subVectors(player.position, enemy.position).normalize();
    enemy.velocity.x += tempVec3.x * homingStrength;
    enemy.velocity.z += tempVec3.z * homingStrength;
    
    // Speed cap
    const speed = Math.sqrt(enemy.velocity.x * enemy.velocity.x + enemy.velocity.z * enemy.velocity.z);
    const speedCap = enemy.speed * tuningMult;
    if (speed > speedCap) {
        enemy.velocity.x = (enemy.velocity.x / speed) * speedCap;
        enemy.velocity.z = (enemy.velocity.z / speed) * speedCap;
    }
    
    // Trail particles for enhanced visibility
    if (enemy.visualProfile?.trailEnabled && Math.random() < 0.3) {
        spawnParticle(enemy.position.clone(), enemy.baseColor, 2);
    }
}

function updateShieldBreakerEnemy(enemy) {
    const dist = enemy.position.distanceTo(player.position);
    const tuningMult = getEnemySpeedTuningMultiplier();
    
    // Windup phase before rush (telegraph)
    if (dist < enemy.rushRange && !enemy.isRushing && !enemy.rushWindupTimer) {
        enemy.rushWindupTimer = 20;  // ~0.33 second windup (20 frames)
        enemy.rushDirection = tempVec3.subVectors(player.position, enemy.position).normalize().clone();
        enemy.rushDirection.y = 0;
        // Create rush telegraph visual
        enemy.rushTelegraph = createRushTelegraph(enemy, player.position);
    }
    
    if (enemy.rushWindupTimer > 0) {
        enemy.rushWindupTimer--;
        // Compress visual during windup
        enemy.scale.z = 0.8 + (enemy.rushWindupTimer / 20) * 0.2;
        enemy.scale.x = 1.1 - (enemy.rushWindupTimer / 20) * 0.1;
        
        // Update telegraph visual
        if (enemy.rushTelegraph) {
            updateRushTelegraph(enemy.rushTelegraph);
        }
        
        if (enemy.rushWindupTimer <= 0) {
            enemy.isRushing = true;
            enemy.scale.set(1, 1, 1);
            // Cleanup telegraph
            if (enemy.rushTelegraph) {
                cleanupVFX(enemy.rushTelegraph);
                enemy.rushTelegraph = null;
            }
        }
        return;
    }
    
    if (enemy.isRushing) {
        enemy.position.add(enemy.rushDirection.clone().multiplyScalar(enemy.rushSpeed * tuningMult));
        if (Math.abs(enemy.position.x) > 42 || Math.abs(enemy.position.z) > 42) {
            enemy.isRushing = false;
            enemy.position.x = Math.max(-42, Math.min(42, enemy.position.x));
            enemy.position.z = Math.max(-42, Math.min(42, enemy.position.z));
        }
    } else {
        updateChaseEnemy(enemy);
    }
}

function updateWaterBalloonEnemy(enemy) {
    const tuningMult = getEnemySpeedTuningMultiplier();
    tempVec3.subVectors(player.position, enemy.position);
    tempVec3.y = 0;
    tempVec3.normalize();
    enemy.position.x += tempVec3.x * enemy.speed * tuningMult;
    enemy.position.z += tempVec3.z * enemy.speed * tuningMult;
    
    if (enemy.size < enemy.maxSize) {
        enemy.size += enemy.growRate;
        enemy.scale.setScalar(enemy.size / enemy.baseSize);
    } else {
        explodeWaterBalloon(enemy);
    }
}

export function explodeWaterBalloon(enemy) {
    createHazardZone(enemy.position.x, enemy.position.z, enemy.explosionRadius, 400);
    if (player.position.distanceTo(enemy.position) < enemy.explosionRadius) {
        takeDamage(enemy.damage * 2, 'Water Balloon Explosion', 'hazard');
    }
    spawnParticle(enemy.position, 0x44ffff, 20);
    enemy.health = 0;
}

function updateTeleporterEnemy(enemy) {
    const dist = enemy.position.distanceTo(player.position);
    const tuningMult = getEnemySpeedTuningMultiplier();
    
    // Increment teleport timer
    enemy.teleportTimer = (enemy.teleportTimer || 0) + 1;
    
    // Windup phase before teleport (telegraph)
    if (enemy.teleportWindupTimer > 0) {
        enemy.teleportWindupTimer--;
        // Flicker effect during windup
        enemy.scale.setScalar(0.8 + Math.sin(enemy.teleportWindupTimer * 0.5) * 0.2);
        
        if (enemy.teleportWindupTimer <= 0) {
            // Execute teleport with validated destination
            spawnParticle(enemy.position, 0xaa44ff, 8);
            PulseMusic.onTeleport(false); // Vanishing sound
            
            // Find valid destination (not in hazards/obstacles)
            const destination = findValidTeleportDestination(enemy, player.position);
            enemy.position.x = destination.x;
            enemy.position.z = destination.z;
            
            spawnParticle(enemy.position, 0xaa44ff, 8);
            PulseMusic.onTeleport(true); // Appearing sound
            enemy.teleportTimer = 0; // Reset cooldown
            enemy.scale.setScalar(1);
        }
        return;
    }
    
    // Frame-based teleport cooldown
    if (enemy.teleportTimer >= enemy.teleportCooldownFrames && dist < 20) {
        // Start teleport windup
        enemy.teleportWindupTimer = 15;  // ~0.25 second windup (15 frames)
    } else {
        tempVec3.subVectors(player.position, enemy.position);
        tempVec3.y = 0;
        tempVec3.normalize();
        enemy.position.x += tempVec3.x * enemy.speed * 0.5 * tuningMult;
        enemy.position.z += tempVec3.z * enemy.speed * 0.5 * tuningMult;
    }
}

// Pillar Police - hops between pillar tops, hunts players who camp on pillars
function updatePillarHopperEnemy(enemy) {
    const tuningMult = getEnemySpeedTuningMultiplier();
    // Initialize state if needed
    if (!enemy.hopState) {
        enemy.hopState = 'idle';
        enemy.hopTimer = 0;
        enemy.currentPillar = null;
        enemy.targetPillar = null;
        enemy.hopVelocity = new THREE.Vector3();
        enemy.isHunting = false;
    }
    
    enemy.hopTimer++;
    
    // Refresh pillar cache if empty
    if (cachedPillarTops.length === 0) {
        cachePillarPositions();
    }
    
    // Check if player is on a pillar every frame
    const playerPillar = getPlayerPillar();
    
    // Track grace period for pillar landing (frame-based for pause safety)
    if (playerPillar) {
        if (player.pillarLandFrames === undefined || player.pillarLandFrames === null) {
            player.pillarLandFrames = 0;
        } else {
            player.pillarLandFrames++;
        }
    } else {
        player.pillarLandFrames = null;
    }
    
    switch (enemy.hopState) {
        case 'idle':
            // PRIORITY: If player is on a pillar (not ours), hunt them after grace period
            if (playerPillar && playerPillar !== enemy.currentPillar) {
                const gracePeriodFrames = 90;  // 1.5 seconds at 60fps (was 1500ms)
                const framesSinceLanding = player.pillarLandFrames || 0;
                
                // Only hunt if grace period has passed
                if (framesSinceLanding >= gracePeriodFrames) {
                    enemy.targetPillar = playerPillar;
                    enemy.isHunting = true;
                    enemy.hopState = 'windup';
                    enemy.hopTimer = 0;
                    break;
                }
                // During grace period, don't start hunting - patrol normally
            }
            
            // Otherwise, wait for pause duration then pick random pillar
            if (enemy.hopTimer > (enemy.pauseDuration || 30)) {
                // Pick a random pillar (different from current)
                const availablePillars = cachedPillarTops.filter(p => p !== enemy.currentPillar);
                if (availablePillars.length > 0) {
                    enemy.targetPillar = availablePillars[Math.floor(Math.random() * availablePillars.length)];
                    enemy.isHunting = false;
                }
                
                if (enemy.targetPillar) {
                    enemy.hopState = 'windup';
                    enemy.hopTimer = 0;
                }
            }
            
            // If player is on same pillar, chase aggressively
            if (enemy.currentPillar && playerPillar === enemy.currentPillar) {
                tempVec3.subVectors(player.position, enemy.position);
                tempVec3.y = 0;
                tempVec3.normalize();
                enemy.position.x += tempVec3.x * enemy.speed * 2.5 * tuningMult;
                enemy.position.z += tempVec3.z * enemy.speed * 2.5 * tuningMult;
            }
            break;
            
        case 'windup':
            // Crouch before hop (telegraph)
            enemy.scale.y = 0.6 + enemy.hopTimer * 0.02;
            enemy.scale.x = 1.2 - enemy.hopTimer * 0.01;
            enemy.scale.z = 1.2 - enemy.hopTimer * 0.01;
            
            if (enemy.hopTimer > 12) {
                // Launch!
                enemy.hopState = 'hopping';
                enemy.hopTimer = 0;
                enemy.scale.set(1, 1, 1);
                
                // Calculate hop trajectory
                const targetX = enemy.targetPillar.x;
                const targetZ = enemy.targetPillar.z;
                const targetY = enemy.targetPillar.y + enemy.size;
                
                const dx = targetX - enemy.position.x;
                const dz = targetZ - enemy.position.z;
                const horizontalDist = Math.sqrt(dx * dx + dz * dz);
                const hopTime = horizontalDist / (enemy.hopSpeed || 0.4);
                
                enemy.hopVelocity.x = dx / hopTime;
                enemy.hopVelocity.z = dz / hopTime;
                // Arc upward then down
                enemy.hopVelocity.y = 0.3 + (targetY - enemy.position.y) / hopTime;
                enemy.hopTargetTime = hopTime;
                
                spawnParticle(enemy.position, 0xffffff, 5);
            }
            break;
            
        case 'hopping':
            // In the air
            enemy.position.x += enemy.hopVelocity.x * tuningMult;
            enemy.position.z += enemy.hopVelocity.z * tuningMult;
            enemy.velocityY = enemy.hopVelocity.y;
            enemy.hopVelocity.y -= 0.02; // Gravity
            
            // Stretch effect while hopping
            const hopProgress = enemy.hopTimer / (enemy.hopTargetTime || 30);
            if (hopProgress < 0.5) {
                enemy.scale.y = 1.3;
                enemy.scale.x = 0.85;
                enemy.scale.z = 0.85;
            } else {
                enemy.scale.y = 0.8;
                enemy.scale.x = 1.1;
                enemy.scale.z = 1.1;
            }
            
            // Check if landed on target pillar
            if (enemy.targetPillar && enemy.position.y <= enemy.targetPillar.y + enemy.size + 0.5) {
                const onPillar = Math.abs(enemy.position.x - enemy.targetPillar.x) < enemy.targetPillar.width / 2 + 0.5 &&
                                 Math.abs(enemy.position.z - enemy.targetPillar.z) < enemy.targetPillar.depth / 2 + 0.5;
                
                if (onPillar || enemy.hopTimer > enemy.hopTargetTime * 1.5) {
                    // Landed!
                    enemy.hopState = 'landing';
                    enemy.hopTimer = 0;
                    enemy.currentPillar = enemy.targetPillar;
                    enemy.position.y = enemy.targetPillar.y + enemy.size;
                    enemy.velocityY = 0;
                    spawnParticle(enemy.position, 0xffffff, 8);
                }
            }
            
            // Fallback: if we've been hopping too long, land wherever we are
            if (enemy.hopTimer > 120) {
                enemy.hopState = 'idle';
                enemy.hopTimer = 0;
                enemy.scale.set(1, 1, 1);
                enemy.currentPillar = null;
            }
            break;
            
        case 'landing':
            // Squash effect on landing
            enemy.scale.y = 0.7 + enemy.hopTimer * 0.03;
            enemy.scale.x = 1.15 - enemy.hopTimer * 0.015;
            enemy.scale.z = 1.15 - enemy.hopTimer * 0.015;
            
            if (enemy.hopTimer > 10) {
                enemy.hopState = 'idle';
                enemy.hopTimer = 0;
                enemy.scale.set(1, 1, 1);
            }
            break;
    }
}

// Check if player is standing on a pillar
function getPlayerPillar() {
    // Must be grounded or nearly grounded (not jumping/falling)
    if (!player.isGrounded && Math.abs(player.velocity.y) > 0.05) {
        return null;
    }
    
    const playerFeetY = player.position.y - 1;  // Player center is at y=1 above ground
    const playerRadius = 0.5;
    
    for (const pillar of cachedPillarTops) {
        // XZ check: player radius within pillar bounds (no ghost margin)
        const dx = Math.abs(player.position.x - pillar.x);
        const dz = Math.abs(player.position.z - pillar.z);
        const onPillarXZ = dx <= (pillar.width / 2 + playerRadius) &&
                          dz <= (pillar.depth / 2 + playerRadius);
        
        // Y check: feet must be within 0.3 units of pillar top surface (tightened to reduce false positives during climbing)
        const onPillarY = Math.abs(playerFeetY - pillar.topY) < 0.3;
        
        if (onPillarXZ && onPillarY) {
            return pillar;
        }
    }
    return null;
}

// Enemy projectile spawning using pooled projectiles
export function spawnEnemyProjectile(enemy, targetPos) {
    spawnEnemyProjectileFromPool(enemy.position, targetPos, enemy.damage * 0.5);
}

// Handle enemy death effects (called from projectiles.js)
export function handleEnemyDeath(enemy) {
    // Track kill for combat stats
    if (gameState.combatStats) {
        const type = enemy.enemyType || 'unknown';
        gameState.combatStats.kills[type] = (gameState.combatStats.kills[type] || 0) + 1;
    }
    
    // Handle school leader death - promote follower or disband
    if (enemy.schoolId && enemy.isSchoolLeader) {
        handleSchoolLeaderDeath(enemy);
    }
    
    // Spawn enemy-specific death VFX
    if (enemy.deathVfx) {
        spawnEnemyDeathVfx(enemy.position, enemy.deathVfx);
    } else {
        // Fallback to basic particle burst
        spawnParticle(enemy.position, enemy.baseColor, 8);
    }
    
    if (enemy.onDeath === 'split') {
        for (let s = 0; s < enemy.splitCount; s++) {
            spawnSplitEnemy(enemy.position, enemy.baseSize, s, enemy.splitCount);
        }
    }
    if (enemy.behavior === 'waterBalloon') {
        explodeWaterBalloon(enemy);
    }
}
