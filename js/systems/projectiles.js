import { scene } from '../core/scene.js';
import { gameState } from '../core/gameState.js';
import { 
    enemies, 
    projectiles, 
    enemyProjectiles, 
    getCurrentBoss,
    tempVec3, 
    tempVec3_2 
} from '../core/entities.js';
import { player } from '../entities/player.js';
import { cameraAngleX } from '../core/input.js';
import { handleEnemyDeath } from '../entities/enemies.js';
import { killBoss } from '../entities/boss.js';
import { spawnParticle, spawnShieldHitVFX, spawnShieldBreakVFX } from '../effects/particles.js';
import { spawnXpGem, spawnHeart } from './pickups.js';
import { takeDamage, lastDamageTime, setLastDamageTime } from './damage.js';
import { DAMAGE_COOLDOWN, HEART_DROP_CHANCE, HEART_HEAL } from '../config/constants.js';
import { triggerSlowMo, triggerScreenFlash, createExposedVFX, createTetherSnapVFX, cleanupVFX } from './visualFeedback.js';
import { showTutorialCallout } from '../ui/hud.js';
import { PulseMusic } from './pulseMusic.js';
import { safeFlashMaterial } from './materialUtils.js';

let lastShot = 0;

export function resetLastShot() {
    lastShot = 0;
}

// Player max shoot range
const MAX_PROJECTILE_RANGE = 25;

// Object pool for projectiles - prevents memory leaks
const PROJECTILE_POOL_SIZE = 60;
const ENEMY_PROJECTILE_POOL_SIZE = 40;
let projectilePool = [];
let enemyProjectilePool = [];
let poolInitialized = false;

// Shared geometry and materials for all projectiles
let sharedProjectileGeometry = null;
let sharedProjectileMaterial = null;
let sharedEnemyProjectileGeometry = null;
let sharedEnemyProjectileMaterial = null;

export function initProjectilePool() {
    if (poolInitialized) return;
    
    // Create shared geometries and materials once
    sharedProjectileGeometry = new THREE.SphereGeometry(0.15, 8, 8);
    sharedProjectileMaterial = new THREE.MeshBasicMaterial({
        color: 0x44ffff,
        transparent: true,
        opacity: 0.9
    });
    
    sharedEnemyProjectileGeometry = new THREE.SphereGeometry(0.12, 6, 6);
    sharedEnemyProjectileMaterial = new THREE.MeshBasicMaterial({
        color: 0xff6644,
        transparent: true,
        opacity: 0.9
    });
    
    // Pre-create player projectile pool
    for (let i = 0; i < PROJECTILE_POOL_SIZE; i++) {
        const proj = new THREE.Mesh(sharedProjectileGeometry, sharedProjectileMaterial);
        proj.visible = false;
        proj.active = false;
        proj.velocity = new THREE.Vector3();
        proj.spawnPos = new THREE.Vector3();
        scene.add(proj);
        projectilePool.push(proj);
    }
    
    // Pre-create enemy projectile pool
    for (let i = 0; i < ENEMY_PROJECTILE_POOL_SIZE; i++) {
        const proj = new THREE.Mesh(sharedEnemyProjectileGeometry, sharedEnemyProjectileMaterial);
        proj.visible = false;
        proj.active = false;
        proj.velocity = new THREE.Vector3();
        scene.add(proj);
        enemyProjectilePool.push(proj);
    }
    
    poolInitialized = true;
}

function getNextPlayerProjectile() {
    // Find inactive projectile
    for (const proj of projectilePool) {
        if (!proj.active) {
            proj.active = true;
            proj.visible = true;
            return proj;
        }
    }
    // Pool exhausted - reuse oldest
    const proj = projectilePool[0];
    projectiles.splice(projectiles.indexOf(proj), 1);
    proj.active = true;
    proj.visible = true;
    return proj;
}

function getNextEnemyProjectile() {
    // Find inactive projectile
    for (const proj of enemyProjectilePool) {
        if (!proj.active) {
            proj.active = true;
            proj.visible = true;
            return proj;
        }
    }
    // Pool exhausted - reuse oldest
    const proj = enemyProjectilePool[0];
    enemyProjectiles.splice(enemyProjectiles.indexOf(proj), 1);
    proj.active = true;
    proj.visible = true;
    return proj;
}

function returnProjectileToPool(proj) {
    proj.active = false;
    proj.visible = false;
    proj.life = 0;
}

export function spawnEnemyProjectileFromPool(fromPosition, targetPosition, damage) {
    if (!poolInitialized) initProjectilePool();
    
    const projectile = getNextEnemyProjectile();
    
    projectile.position.copy(fromPosition);
    tempVec3.subVectors(targetPosition, fromPosition).normalize();
    projectile.velocity.copy(tempVec3).multiplyScalar(0.3);
    projectile.damage = damage;
    projectile.life = 150;
    
    enemyProjectiles.push(projectile);
    return projectile;
}

// Vertical aim lock-on helper - only targets enemies in front of player (180° arc)
function getNearestEnemies(count, maxRange) {
    maxRange = maxRange || MAX_PROJECTILE_RANGE;
    const currentBoss = getCurrentBoss();
    const allTargets = [...enemies];
    if (currentBoss) allTargets.push(currentBoss);
    
    // Player forward direction (negative Z rotated by cameraAngleX)
    const forwardX = -Math.sin(cameraAngleX);
    const forwardZ = -Math.cos(cameraAngleX);
    
    return allTargets
        .map(e => {
            const dx = e.position.x - player.position.x;
            const dz = e.position.z - player.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            
            // Dot product to check if in front (positive = in front)
            const dot = (dx * forwardX + dz * forwardZ) / (dist || 1);
            
            return { enemy: e, dist, dot };
        })
        .filter(e => e.dist < maxRange && e.dot > 0)  // dot > 0 = within 180° forward
        .sort((a, b) => a.dist - b.dist)
        .slice(0, count)
        .map(e => e.enemy);
}

export function shootProjectile() {
    if (!poolInitialized) initProjectilePool();
    
    // Block attacks during hit recovery (invulnerability frames)
    if (player.isRecovering) return;
    
    const now = Date.now();
    const fireRate = 500 / gameState.stats.attackSpeed;
    if (now - lastShot < fireRate) return;
    lastShot = now;
    
    const projectileCount = Math.floor(gameState.stats.projectileCount);
    const targets = getNearestEnemies(projectileCount);
    if (targets.length === 0) return;
    
    for (let i = 0; i < projectileCount; i++) {
        const target = targets[i % targets.length];
        const projectile = getNextPlayerProjectile();
        
        projectile.position.copy(player.position);
        projectile.position.y += 0.5;
        
        // Vertical aim lock-on: target enemy center
        tempVec3.copy(target.position);
        const direction = tempVec3_2.subVectors(tempVec3, projectile.position).normalize();
        projectile.velocity.copy(direction).multiplyScalar(gameState.stats.projectileSpeed);
        projectile.damage = gameState.stats.damage;
        projectile.life = 120;
        projectile.spawnPos.copy(player.position);  // Track spawn position for range limit
        
        projectiles.push(projectile);
    }
}

export function updateProjectiles(delta) {
    // Player projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const proj = projectiles[i];
        proj.position.add(proj.velocity);
        proj.life--;
        
        // Range limit check - remove projectiles that traveled too far
        if (proj.spawnPos) {
            const distTraveled = proj.position.distanceTo(proj.spawnPos);
            if (distTraveled > MAX_PROJECTILE_RANGE) {
                returnProjectileToPool(proj);
                projectiles.splice(i, 1);
                continue;
            }
        }
        
        let hit = false;
        
        // Check enemy hits
        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            const hitboxSize = enemy.baseSize * enemy.scale.x * 0.85;
            
            if (proj.position.distanceTo(enemy.position) < hitboxSize + 0.2) {
                let damageDealt = proj.damage * (1 - (enemy.damageReduction || 0));
                
                // Check for shield
                if (enemy.shieldHP > 0) {
                    // First time hitting shield - show tutorial
                    showTutorialCallout('shield', 'Break shields first!', 2000);
                    
                    enemy.shieldHP -= damageDealt;
                    spawnShieldHitVFX(proj.position, enemy.baseColor);
                    PulseMusic.onShieldHit();
                    
                    // Shield break
                    if (enemy.shieldHP <= 0) {
                        enemy.shieldBroken = true;
                        spawnShieldBreakVFX(enemy.position, 0x4488ff);
                        PulseMusic.onShieldBreak();
                        triggerSlowMo(5, 0.3);
                        triggerScreenFlash(0x4488ff, 6);
                        
                        // Brief stun (12 frames = 200ms)
                        enemy.stunned = true;
                        enemy.stunTimer = 12;
                        
                        // Remove shield visual
                        if (enemy.shieldMesh) {
                            enemy.remove(enemy.shieldMesh);
                            enemy.shieldMesh = null;
                        }
                    }
                } else {
                    // Normal damage
                    enemy.health -= damageDealt;
                    spawnParticle(proj.position, 0xff4444, 2);
                    
                    // Track damage dealt for combat stats
                    if (gameState.combatStats) {
                        gameState.combatStats.damageDealt += damageDealt;
                    }
                }
                
                // Shrink on damage
                const healthPercent = Math.max(0, enemy.health / enemy.maxHealth);
                enemy.scale.setScalar(0.65 + 0.35 * healthPercent);
                
                // Hit flash - handle both Mesh and Group enemies
                const enemyMat = enemy.baseMaterial || enemy.material;
                if (enemyMat && enemyMat.emissive) {
                    safeFlashMaterial(enemyMat, enemy, 0xffffff, enemy.baseColor, 0.3, 50);
                }
                
                // Check death
                if (enemy.health <= 0) {
                    // Check if this was a boss minion
                    if (enemy.isBossMinion && enemy.parentBoss) {
                        const boss = enemy.parentBoss;
                        const index = boss.summonedMinions.indexOf(enemy);
                        if (index > -1) {
                            boss.summonedMinions.splice(index, 1);
                        }
                        
                        // Create tether snap VFX when minion dies
                        if (enemy.tether) {
                            // Create snap VFX at minion position
                            const snapVFX = createTetherSnapVFX(enemy.position.clone(), boss.baseColor);
                            if (boss.tetherSnapVFXList) {
                                boss.tetherSnapVFXList.push(snapVFX);
                            }
                            
                            // Remove tether from boss's list
                            const tetherIndex = boss.minionTethers ? boss.minionTethers.indexOf(enemy.tether) : -1;
                            if (tetherIndex > -1) {
                                boss.minionTethers.splice(tetherIndex, 1);
                            }
                            
                            // Cleanup tether geometry
                            cleanupVFX(enemy.tether);
                            enemy.tether = null;
                        }
                        
                        // Check if all minions dead - trigger exposed state (full reward)
                        if (boss.summonedMinions.length === 0 && boss.shieldActive) {
                            boss.shieldActive = false;
                            boss.isExposed = true;
                            
                            // Use phase-scaled duration from config (rewarding kill-based break)
                            const exposedConfig = boss.exposedConfig;
                            const phaseDuration = exposedConfig?.durationByPhase?.[boss.phase] || exposedConfig?.duration || 300;
                            boss.exposedTimer = phaseDuration;
                            boss.exposedDamageMultiplier = exposedConfig?.damageMultiplier || 1.25;
                            
                            // Shield shatter VFX and audio
                            if (boss.shieldMesh) {
                                boss.shieldMesh.visible = false;
                            }
                            spawnShieldBreakVFX(boss.position, 0x4488ff);
                            PulseMusic.onBossShieldBreak();
                            PulseMusic.onBossExposed();
                            
                            // Create exposed VFX
                            boss.exposedVFX = createExposedVFX(boss);
                            
                            // Clean up any remaining tethers (shouldn't be any, but just in case)
                            if (boss.minionTethers) {
                                for (const tether of boss.minionTethers) {
                                    cleanupVFX(tether);
                                }
                                boss.minionTethers = [];
                            }
                        }
                    }
                    
                    handleEnemyDeath(enemy);
                    
                    spawnXpGem(enemy.position, enemy.xpValue);
                    spawnParticle(enemy.position, enemy.baseColor, 5);
                    
                    // Heart drop
                    if (Math.random() < (enemy.isElite ? HEART_DROP_CHANCE.elite : HEART_DROP_CHANCE.normal)) {
                        spawnHeart(enemy.position.clone(), enemy.isElite ? HEART_HEAL.elite : HEART_HEAL.normal);
                    }
                    
                    // Cleanup - handle both Mesh and Group enemies
                    // NOTE: Don't dispose geometry (it's cached/shared), only materials
                    if (enemy.isGroup || enemy.type === 'Group') {
                        enemy.traverse(child => {
                            if (child.material) child.material.dispose();
                        });
                    } else {
                        if (enemy.material) enemy.material.dispose();
                    }
                    scene.remove(enemy);
                    enemies.splice(j, 1);
                    
                    gameState.kills++;
                    gameState.score += enemy.isElite ? 30 : 10;
                }
                
                hit = true;
                break;
            }
        }
        
        // Check boss hit
        const currentBoss = getCurrentBoss();
        if (!hit && currentBoss && proj.position.distanceTo(currentBoss.position) < currentBoss.size * currentBoss.scale.x + 0.2) {
            let damageDealt = proj.damage;
            
            // Check for boss shield
            if (currentBoss.shieldActive) {
                // First time hitting boss shield - show tutorial
                showTutorialCallout('bossShield', 'Kill minions to drop the shield!', 3000);
                
                // Boss shield reduces damage significantly (uses config value)
                const shieldReduction = currentBoss.shieldConfig?.damageReduction || 0.95;
                damageDealt *= (1 - shieldReduction);
                spawnShieldHitVFX(proj.position, currentBoss.baseColor);
                PulseMusic.onShieldHit();
            } else if (currentBoss.isExposed) {
                // Exposed state - bonus damage
                damageDealt *= 1.25;
                spawnParticle(proj.position, 0xffdd44, 3);
            } else {
                spawnParticle(proj.position, 0xff4444, 2);
            }
            
            currentBoss.health -= damageDealt;
            
            // Track damage dealt for combat stats
            if (gameState.combatStats) {
                gameState.combatStats.damageDealt += damageDealt;
            }
            
            currentBoss.scale.setScalar(0.75 + 0.25 * Math.max(0, currentBoss.health / currentBoss.maxHealth));
            
            if (currentBoss.bodyMaterial) {
                safeFlashMaterial(currentBoss.bodyMaterial, currentBoss, 0xffffff, currentBoss.baseColor, 0.3, 50);
            }
            
            if (currentBoss.health <= 0 && !currentBoss.isDying) {
                killBoss();
            }
            
            hit = true;
        }
        
        // Remove projectile
        if (hit || proj.life <= 0) {
            returnProjectileToPool(proj);
            projectiles.splice(i, 1);
        }
    }
    
    // Enemy projectiles
    for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
        const proj = enemyProjectiles[i];
        proj.position.add(proj.velocity);
        proj.life--;
        
        // Check player hit
        if (proj.position.distanceTo(player.position) < 1) {
            const now = Date.now();
            if (now - lastDamageTime > DAMAGE_COOLDOWN * 0.5) {
                takeDamage(proj.damage, 'Enemy Projectile', 'projectile');
                setLastDamageTime(now);
            }
            returnProjectileToPool(proj);
            enemyProjectiles.splice(i, 1);
            continue;
        }
        
        // Remove expired
        if (proj.life <= 0) {
            returnProjectileToPool(proj);
            enemyProjectiles.splice(i, 1);
        }
    }
}
