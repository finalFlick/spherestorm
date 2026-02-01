import { scene } from '../core/scene.js';
import { gameState } from '../core/gameState.js';
import { enemies, obstacles, enemyProjectiles, tempVec3 } from '../core/entities.js';
import { player } from './player.js';
import { ENEMY_TYPES } from '../config/enemies.js';
import { DAMAGE_COOLDOWN } from '../config/constants.js';
import { spawnParticle, spawnEnemyDeathVfx } from '../effects/particles.js';
import { createHazardZone } from '../arena/generator.js';
import { takeDamage, lastDamageTime, setLastDamageTime } from '../systems/damage.js';

// Cache pillar positions for pillar hopper behavior
let cachedPillarTops = [];
import { markEnemyEncountered } from '../ui/rosterUI.js';

// Build enemy mesh - simple smooth sphere with glow/pulse/orbit effects
function buildEnemyMesh(typeData) {
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
        
        const sphere1 = new THREE.Mesh(new THREE.SphereGeometry(sphereSize, 12, 12), orbitMat1);
        const sphere2 = new THREE.Mesh(new THREE.SphereGeometry(sphereSize, 12, 12), orbitMat2);
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
    const geometry = new THREE.SphereGeometry(typeData.size, 16, 16);
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
        
        for (let i = 0; i < profile.orbitCount; i++) {
            const particle = new THREE.Mesh(
                new THREE.SphereGeometry(typeData.size * 0.15, 6, 6),
                orbitMat
            );
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
        // Pillars are taller obstacles (height > 2) that are roughly square
        const width = c.maxX - c.minX;
        const depth = c.maxZ - c.minZ;
        if (c.height > 2 && Math.abs(width - depth) < 1) {
            cachedPillarTops.push({
                x: (c.minX + c.maxX) / 2,
                z: (c.minZ + c.maxZ) / 2,
                y: c.topY,
                width: width,
                depth: depth
            });
        }
    }
}

// Weighted enemy spawning
export function getWeightedEnemyType() {
    const availableTypes = [];
    let totalWeight = 0;
    
    for (const [typeName, typeData] of Object.entries(ENEMY_TYPES)) {
        if (typeData.minArena && gameState.currentArena < typeData.minArena) continue;
        if (typeData.maxArena && gameState.currentArena > typeData.maxArena) continue;
        availableTypes.push({ name: typeName, data: typeData });
        totalWeight += typeData.spawnWeight;
    }
    
    const waveBonus = gameState.currentWave * 0.05;
    let random = Math.random() * totalWeight;
    
    for (const type of availableTypes) {
        let weight = type.data.spawnWeight;
        if (type.data.spawnWeight < 10) weight += waveBonus * 10;
        random -= weight;
        if (random <= 0) return type;
    }
    
    return availableTypes[0];
}

export function spawnWaveEnemy() {
    const distance = 28 + Math.random() * 12;
    const angle = Math.random() * Math.PI * 2;
    let x = Math.max(-42, Math.min(42, player.position.x + Math.cos(angle) * distance));
    let z = Math.max(-42, Math.min(42, player.position.z + Math.sin(angle) * distance));
    
    const enemyType = getWeightedEnemyType();
    const typeData = enemyType.data;
    const arenaScale = 1 + (gameState.currentArena - 1) * 0.15;
    const waveScale = 1 + (gameState.currentWave - 1) * 0.05;
    
    // Build enemy with visual profile
    const enemy = buildEnemyMesh(typeData);
    
    enemy.position.set(x, typeData.size, z);
    enemy.health = Math.floor(typeData.health * arenaScale * waveScale);
    enemy.maxHealth = enemy.health;
    enemy.speed = typeData.speed * (1 + gameState.currentArena * 0.02);
    enemy.damage = Math.floor(typeData.damage * arenaScale);
    enemy.size = typeData.size;
    enemy.baseSize = typeData.size;
    enemy.isBoss = false;
    enemy.isElite = typeData.spawnWeight < 10;
    enemy.xpValue = typeData.xpValue;
    enemy.baseColor = typeData.color;
    enemy.velocityY = 0;
    enemy.velocity = new THREE.Vector3();
    enemy.enemyType = enemyType.name;
    enemy.behavior = typeData.behavior;
    enemy.damageReduction = typeData.damageReduction || 0;
    enemy.onDeath = typeData.onDeath || null;
    enemy.splitCount = typeData.splitCount || 0;
    
    // Visual and movement properties
    enemy.movementSignature = typeData.movementSignature || null;
    enemy.telegraph = typeData.telegraph || null;
    enemy.deathVfx = typeData.deathVfx || null;
    enemy.movementTimer = Math.random() * 100;  // Offset for variety
    enemy.telegraphActive = false;
    enemy.telegraphTimer = 0;
    
    // Behavior-specific properties
    if (typeData.behavior === 'shooter') {
        enemy.shootRange = typeData.shootRange;
        enemy.shootCooldown = typeData.shootCooldown;
        enemy.lastShot = 0;
    }
    if (typeData.behavior === 'bouncer') {
        enemy.velocity.set(
            (Math.random() - 0.5) * enemy.speed * 2,
            0,
            (Math.random() - 0.5) * enemy.speed * 2
        );
    }
    if (typeData.behavior === 'shieldBreaker') {
        enemy.rushRange = typeData.rushRange;
        enemy.rushSpeed = typeData.rushSpeed;
        enemy.isRushing = false;
        enemy.rushWindup = 0;
    }
    if (typeData.behavior === 'waterBalloon') {
        enemy.growRate = typeData.growRate;
        enemy.maxSize = typeData.maxSize;
        enemy.explosionRadius = typeData.explosionRadius;
    }
    if (typeData.behavior === 'teleporter') {
        enemy.teleportCooldown = typeData.teleportCooldown;
        enemy.teleportRange = typeData.teleportRange;
        enemy.lastTeleport = 0;
        enemy.teleportWindup = 0;
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
    
    // Mark enemy as encountered for roster
    markEnemyEncountered(enemyType.name);
    
    scene.add(enemy);
    enemies.push(enemy);
}

export function spawnSplitEnemy(position, parentSize) {
    const size = parentSize * 0.4;
    
    // Splitlings are simple smooth spheres with bright glow
    const material = new THREE.MeshStandardMaterial({
        color: 0xff66ff,
        emissive: 0xff44ff,
        emissiveIntensity: 0.5
    });
    const enemy = new THREE.Mesh(
        new THREE.SphereGeometry(size, 10, 10),
        material
    );
    enemy.castShadow = true;
    enemy.baseMaterial = material;
    
    const offset = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        0,
        (Math.random() - 0.5) * 2
    );
    enemy.position.copy(position).add(offset);
    enemy.position.y = size;
    
    enemy.health = 5;
    enemy.maxHealth = 5;
    enemy.speed = 0.05;
    enemy.damage = 5;
    enemy.size = size;
    enemy.baseSize = size;
    enemy.isBoss = false;
    enemy.isElite = false;
    enemy.xpValue = 1;
    enemy.baseColor = 0xff66ff;
    enemy.velocityY = 0;
    enemy.velocity = new THREE.Vector3();
    enemy.enemyType = 'splitling';
    enemy.behavior = 'chase';
    enemy.damageReduction = 0;
    enemy.movementSignature = 'sway';
    enemy.movementTimer = Math.random() * 100;
    enemy.deathVfx = { color: 0xff66ff, count: 6, type: 'burst' };
    
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
    }
    if (typeData.behavior === 'teleporter') {
        enemy.teleportCooldown = typeData.teleportCooldown;
        enemy.teleportRange = typeData.teleportRange;
        enemy.lastTeleport = Date.now();
        enemy.teleportWindup = 0;
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
        enemy.rushWindup = 0;
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
    const now = Date.now();
    
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        if (!enemy.velocityY) enemy.velocityY = 0;
        if (!enemy.movementTimer) enemy.movementTimer = 0;
        enemy.movementTimer++;
        
        switch (enemy.behavior) {
            case 'chase': updateChaseEnemy(enemy); break;
            case 'shooter': updateShooterEnemy(enemy, now); break;
            case 'bouncer': updateBouncerEnemy(enemy); break;
            case 'shieldBreaker': updateShieldBreakerEnemy(enemy, now); break;
            case 'waterBalloon': updateWaterBalloonEnemy(enemy); break;
            case 'teleporter': updateTeleporterEnemy(enemy, now); break;
            case 'pillarHopper': updatePillarHopperEnemy(enemy); break;
            default: updateChaseEnemy(enemy);
        }
        
        // Apply movement signatures
        applyMovementSignature(enemy);
        
        // Update telegraph state
        updateTelegraph(enemy, now);
        
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
        
        enemy.rotation.y += 0.04;
        
        // Player collision
        const scaledSize = enemy.baseSize * enemy.scale.x;
        if (enemy.position.distanceTo(player.position) < scaledSize + 0.5) {
            if (now - lastDamageTime > DAMAGE_COOLDOWN) {
                takeDamage(enemy.damage);
                setLastDamageTime(now);
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
            if (enemy.isRushing || enemy.rushWindup > 0) {
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
function updateTelegraph(enemy, now) {
    if (!enemy.telegraph) return;
    
    // Check if telegraph should be active based on enemy behavior
    let shouldTelegraph = false;
    
    if (enemy.behavior === 'shieldBreaker' && enemy.rushWindup > 0) {
        shouldTelegraph = true;
    } else if (enemy.behavior === 'shooter') {
        const dist = enemy.position.distanceTo(player.position);
        const timeSinceShot = now - (enemy.lastShot || 0);
        if (dist < enemy.shootRange && timeSinceShot > enemy.shootCooldown - enemy.telegraph.duration) {
            shouldTelegraph = true;
        }
    } else if (enemy.behavior === 'teleporter' && enemy.teleportWindup > 0) {
        shouldTelegraph = true;
    } else if (enemy.behavior === 'waterBalloon' && enemy.size >= enemy.maxSize * 0.9) {
        shouldTelegraph = true;
    }
    
    // Apply telegraph visual - simple emissive glow change
    const mat = enemy.baseMaterial || enemy.material;
    if (shouldTelegraph && mat && mat.emissive) {
        mat.emissiveIntensity = 0.7 + Math.sin(now * 0.02) * 0.3;
    } else if (mat && mat.emissive) {
        const profile = enemy.visualProfile;
        mat.emissiveIntensity = profile?.glowIntensity || 0.3;
    }
}

function updateChaseEnemy(enemy) {
    tempVec3.subVectors(player.position, enemy.position);
    tempVec3.y = 0;
    tempVec3.normalize();
    enemy.position.x += tempVec3.x * enemy.speed;
    enemy.position.z += tempVec3.z * enemy.speed;
    
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

function updateShooterEnemy(enemy, now) {
    const dist = enemy.position.distanceTo(player.position);
    
    if (dist > enemy.shootRange) {
        tempVec3.subVectors(player.position, enemy.position);
        tempVec3.y = 0;
        tempVec3.normalize();
        enemy.position.x += tempVec3.x * enemy.speed;
        enemy.position.z += tempVec3.z * enemy.speed;
    } else if (dist < enemy.shootRange * 0.5) {
        tempVec3.subVectors(enemy.position, player.position);
        tempVec3.y = 0;
        tempVec3.normalize();
        enemy.position.x += tempVec3.x * enemy.speed * 0.5;
        enemy.position.z += tempVec3.z * enemy.speed * 0.5;
    }
    
    if (dist < enemy.shootRange && now - (enemy.lastShot || 0) > enemy.shootCooldown) {
        spawnEnemyProjectile(enemy, player.position.clone());
        enemy.lastShot = now;
    }
}

function updateBouncerEnemy(enemy) {
    enemy.position.x += enemy.velocity.x;
    enemy.position.z += enemy.velocity.z;
    
    // Wall bouncing
    if (enemy.position.x < -42 || enemy.position.x > 42) {
        enemy.velocity.x *= -1;
        enemy.position.x = Math.max(-42, Math.min(42, enemy.position.x));
    }
    if (enemy.position.z < -42 || enemy.position.z > 42) {
        enemy.velocity.z *= -1;
        enemy.position.z = Math.max(-42, Math.min(42, enemy.position.z));
    }
    
    // Obstacle bouncing
    for (const obs of obstacles) {
        const c = obs.collisionData;
        if (enemy.position.x + enemy.size > c.minX && 
            enemy.position.x - enemy.size < c.maxX && 
            enemy.position.z + enemy.size > c.minZ && 
            enemy.position.z - enemy.size < c.maxZ) {
            enemy.velocity.x *= -1;
            enemy.velocity.z *= -1;
            enemy.position.x += enemy.velocity.x * 2;
            enemy.position.z += enemy.velocity.z * 2;
        }
    }
    
    // Slight homing
    tempVec3.subVectors(player.position, enemy.position).normalize();
    enemy.velocity.x += tempVec3.x * 0.001;
    enemy.velocity.z += tempVec3.z * 0.001;
    
    // Speed cap
    const speed = Math.sqrt(enemy.velocity.x * enemy.velocity.x + enemy.velocity.z * enemy.velocity.z);
    if (speed > enemy.speed) {
        enemy.velocity.x = enemy.velocity.x / speed * enemy.speed;
        enemy.velocity.z = enemy.velocity.z / speed * enemy.speed;
    }
}

function updateShieldBreakerEnemy(enemy, now) {
    const dist = enemy.position.distanceTo(player.position);
    
    // Windup phase before rush (telegraph)
    if (dist < enemy.rushRange && !enemy.isRushing && !enemy.rushWindup) {
        enemy.rushWindup = 20;  // ~0.33 second windup
        enemy.rushDirection = tempVec3.subVectors(player.position, enemy.position).normalize().clone();
        enemy.rushDirection.y = 0;
    }
    
    if (enemy.rushWindup > 0) {
        enemy.rushWindup--;
        // Compress visual during windup
        enemy.scale.z = 0.8 + (enemy.rushWindup / 20) * 0.2;
        enemy.scale.x = 1.1 - (enemy.rushWindup / 20) * 0.1;
        
        if (enemy.rushWindup <= 0) {
            enemy.isRushing = true;
            enemy.scale.set(1, 1, 1);
        }
        return;
    }
    
    if (enemy.isRushing) {
        enemy.position.add(enemy.rushDirection.clone().multiplyScalar(enemy.rushSpeed));
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
    tempVec3.subVectors(player.position, enemy.position);
    tempVec3.y = 0;
    tempVec3.normalize();
    enemy.position.x += tempVec3.x * enemy.speed;
    enemy.position.z += tempVec3.z * enemy.speed;
    
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
        takeDamage(enemy.damage * 2);
    }
    spawnParticle(enemy.position, 0x44ffff, 20);
    enemy.health = 0;
}

function updateTeleporterEnemy(enemy, now) {
    const dist = enemy.position.distanceTo(player.position);
    
    // Windup phase before teleport (telegraph)
    if (enemy.teleportWindup > 0) {
        enemy.teleportWindup--;
        // Flicker effect during windup
        enemy.scale.setScalar(0.8 + Math.sin(enemy.teleportWindup * 0.5) * 0.2);
        
        if (enemy.teleportWindup <= 0) {
            // Execute teleport
            const angle = Math.random() * Math.PI * 2;
            const d = 3 + Math.random() * 3;
            spawnParticle(enemy.position, 0xaa44ff, 8);
            enemy.position.x = Math.max(-42, Math.min(42, player.position.x + Math.cos(angle) * d));
            enemy.position.z = Math.max(-42, Math.min(42, player.position.z + Math.sin(angle) * d));
            spawnParticle(enemy.position, 0xaa44ff, 8);
            enemy.lastTeleport = now;
            enemy.scale.setScalar(1);
        }
        return;
    }
    
    if (now - (enemy.lastTeleport || 0) > enemy.teleportCooldown && dist < 20) {
        // Start teleport windup
        enemy.teleportWindup = 15;  // ~0.25 second windup
    } else {
        tempVec3.subVectors(player.position, enemy.position);
        tempVec3.y = 0;
        tempVec3.normalize();
        enemy.position.x += tempVec3.x * enemy.speed * 0.5;
        enemy.position.z += tempVec3.z * enemy.speed * 0.5;
    }
}

// Pillar Police - hops between pillar tops, hunts players who camp on pillars
function updatePillarHopperEnemy(enemy) {
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
    
    switch (enemy.hopState) {
        case 'idle':
            // PRIORITY: If player is on a pillar (not ours), immediately hunt them!
            if (playerPillar && playerPillar !== enemy.currentPillar) {
                enemy.targetPillar = playerPillar;
                enemy.isHunting = true;
                enemy.hopState = 'windup';
                enemy.hopTimer = 0;
                break;
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
                enemy.position.x += tempVec3.x * enemy.speed * 2.5;
                enemy.position.z += tempVec3.z * enemy.speed * 2.5;
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
            enemy.position.x += enemy.hopVelocity.x;
            enemy.position.z += enemy.hopVelocity.z;
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
    for (const pillar of cachedPillarTops) {
        const onPillarXZ = Math.abs(player.position.x - pillar.x) < pillar.width / 2 + 0.5 &&
                          Math.abs(player.position.z - pillar.z) < pillar.depth / 2 + 0.5;
        const onPillarY = Math.abs(player.position.y - pillar.y) < 2;
        
        if (onPillarXZ && onPillarY) {
            return pillar;
        }
    }
    return null;
}

// Enemy projectile spawning (moved here to avoid circular dependency with projectiles.js)
export function spawnEnemyProjectile(enemy, targetPos) {
    const projectile = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 6, 6),
        new THREE.MeshBasicMaterial({
            color: 0xff6644,
            transparent: true,
            opacity: 0.9
        })
    );
    
    projectile.position.copy(enemy.position);
    projectile.velocity = tempVec3.subVectors(targetPos, enemy.position).normalize().clone().multiplyScalar(0.3);
    projectile.damage = enemy.damage * 0.5;
    projectile.life = 150;
    
    scene.add(projectile);
    enemyProjectiles.push(projectile);
}

// Handle enemy death effects (called from projectiles.js)
export function handleEnemyDeath(enemy) {
    // Spawn enemy-specific death VFX
    if (enemy.deathVfx) {
        spawnEnemyDeathVfx(enemy.position, enemy.deathVfx);
    } else {
        // Fallback to basic particle burst
        spawnParticle(enemy.position, enemy.baseColor, 8);
    }
    
    if (enemy.onDeath === 'split') {
        for (let s = 0; s < enemy.splitCount; s++) {
            spawnSplitEnemy(enemy.position, enemy.baseSize);
        }
    }
    if (enemy.behavior === 'waterBalloon') {
        explodeWaterBalloon(enemy);
    }
}
