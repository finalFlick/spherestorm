import { scene } from '../core/scene.js';
import { gameState } from '../core/gameState.js';
import { enemies, obstacles, enemyProjectiles, tempVec3 } from '../core/entities.js';
import { player } from './player.js';
import { ENEMY_TYPES } from '../config/enemies.js';
import { DAMAGE_COOLDOWN } from '../config/constants.js';
import { spawnParticle } from '../effects/particles.js';
import { createHazardZone } from '../arena/generator.js';
import { takeDamage, lastDamageTime, setLastDamageTime } from '../systems/damage.js';

// Weighted enemy spawning
export function getWeightedEnemyType() {
    const availableTypes = [];
    let totalWeight = 0;
    
    for (const [typeName, typeData] of Object.entries(ENEMY_TYPES)) {
        if (typeData.minArena && gameState.currentArena < typeData.minArena) continue;
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
    
    const geometry = new THREE.SphereGeometry(typeData.size, 12, 12);
    const material = new THREE.MeshStandardMaterial({
        color: typeData.color,
        emissive: typeData.color,
        emissiveIntensity: 0.3
    });
    const enemy = new THREE.Mesh(geometry, material);
    
    enemy.position.set(x, typeData.size, z);
    enemy.castShadow = true;
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
    }
    
    scene.add(enemy);
    enemies.push(enemy);
}

export function spawnSplitEnemy(position, parentSize) {
    const size = parentSize * 0.4;
    const enemy = new THREE.Mesh(
        new THREE.SphereGeometry(size, 8, 8),
        new THREE.MeshStandardMaterial({
            color: 0xff66ff,
            emissive: 0xff44ff,
            emissiveIntensity: 0.3
        })
    );
    
    const offset = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        0,
        (Math.random() - 0.5) * 2
    );
    enemy.position.copy(position).add(offset);
    enemy.position.y = size;
    enemy.castShadow = true;
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
    
    const enemy = new THREE.Mesh(
        new THREE.SphereGeometry(typeData.size, 10, 10),
        new THREE.MeshStandardMaterial({
            color: typeData.color,
            emissive: typeData.color,
            emissiveIntensity: 0.3
        })
    );
    
    enemy.position.set(x, typeData.size, z);
    enemy.castShadow = true;
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
    }
    if (typeData.behavior === 'waterBalloon') {
        enemy.growRate = typeData.growRate;
        enemy.maxSize = typeData.maxSize;
        enemy.explosionRadius = typeData.explosionRadius;
    }
    
    scene.add(enemy);
    enemies.push(enemy);
}

export function updateEnemies(delta) {
    const now = Date.now();
    
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        if (!enemy.velocityY) enemy.velocityY = 0;
        
        switch (enemy.behavior) {
            case 'chase': updateChaseEnemy(enemy); break;
            case 'shooter': updateShooterEnemy(enemy, now); break;
            case 'bouncer': updateBouncerEnemy(enemy); break;
            case 'shieldBreaker': updateShieldBreakerEnemy(enemy); break;
            case 'waterBalloon': updateWaterBalloonEnemy(enemy); break;
            case 'teleporter': updateTeleporterEnemy(enemy, now); break;
            default: updateChaseEnemy(enemy);
        }
        
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

function updateShieldBreakerEnemy(enemy) {
    const dist = enemy.position.distanceTo(player.position);
    
    if (dist < enemy.rushRange && !enemy.isRushing) {
        enemy.isRushing = true;
        enemy.rushDirection = tempVec3.subVectors(player.position, enemy.position).normalize().clone();
        enemy.rushDirection.y = 0;
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
    
    if (now - (enemy.lastTeleport || 0) > enemy.teleportCooldown && dist < 20) {
        const angle = Math.random() * Math.PI * 2;
        const d = 3 + Math.random() * 3;
        spawnParticle(enemy.position, 0xaa44ff, 8);
        enemy.position.x = Math.max(-42, Math.min(42, player.position.x + Math.cos(angle) * d));
        enemy.position.z = Math.max(-42, Math.min(42, player.position.z + Math.sin(angle) * d));
        spawnParticle(enemy.position, 0xaa44ff, 8);
        enemy.lastTeleport = now;
    } else {
        tempVec3.subVectors(player.position, enemy.position);
        tempVec3.y = 0;
        tempVec3.normalize();
        enemy.position.x += tempVec3.x * enemy.speed * 0.5;
        enemy.position.z += tempVec3.z * enemy.speed * 0.5;
    }
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
    if (enemy.onDeath === 'split') {
        for (let s = 0; s < enemy.splitCount; s++) {
            spawnSplitEnemy(enemy.position, enemy.baseSize);
        }
    }
    if (enemy.behavior === 'waterBalloon') {
        explodeWaterBalloon(enemy);
    }
}
