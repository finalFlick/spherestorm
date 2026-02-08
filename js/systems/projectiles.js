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
import { handleEnemyDeath, shatterWardenGrantedShields } from '../entities/enemies.js';
import { killBoss, checkBossRetreat } from '../entities/boss.js';
import { spawnParticle, spawnShieldHitVFX, spawnShieldBreakVFX } from '../effects/particles.js';
import { spawnXpGem, spawnHeart } from './pickups.js';
import { takeDamage, canTakeCollisionDamage, resetDamageCooldown } from './damage.js';
import { HEART_DROP_CHANCE, HEART_HEAL } from '../config/constants.js';
import { PROJECTILE_ITEMS } from '../config/items.js';
import { triggerSlowMo, triggerScreenFlash, createExposedVFX, createTetherSnapVFX, cleanupVFX } from './visualFeedback.js';
import { showTutorialCallout } from '../ui/hud.js';
import { PulseMusic } from './pulseMusic.js';
import { safeFlashMaterial } from './materialUtils.js';

let lastShot = 0;  // Kept for UI charge ring (visual only)
let shotCooldownFrames = 0;  // Frame-based cooldown counter

export function resetLastShot() {
    lastShot = 0;
    shotCooldownFrames = 0;
}

export function clearProjectiles() {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        returnProjectileToPool(projectiles[i]);
    }
    projectiles.length = 0;

    for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
        const proj = enemyProjectiles[i];
        proj.active = false;
        proj.visible = false;
        proj.life = 0;
    }
    enemyProjectiles.length = 0;
}

export function getLastShot() {
    return lastShot;
}

export function getFireRate() {
    return 500 / gameState.stats.attackSpeed;
}

// Get fire rate in frames (for game logic)
export function getFireRateFrames() {
    // Base 500ms at attackSpeed 1.0, converted to frames (60fps = 16.67ms/frame)
    return Math.floor((500 / gameState.stats.attackSpeed) / 16.67);
}

// Player max shoot range
const MAX_PROJECTILE_RANGE = 25;

// Mild homing: projectiles steer toward their target each frame at this rate (radians/frame).
// 0 = no homing (straight line). ~0.03 = gentle correction. ~0.1 = aggressive tracking.
const HOMING_TURN_RATE = 0.04;

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
        color: 0xffdd44,  // Yellow (matches UI)
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
    const idx = projectiles.indexOf(proj);
    if (idx > -1) projectiles.splice(idx, 1);
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
    const idx = enemyProjectiles.indexOf(proj);
    if (idx > -1) enemyProjectiles.splice(idx, 1);
    proj.active = true;
    proj.visible = true;
    return proj;
}

function returnProjectileToPool(proj) {
    proj.active = false;
    proj.visible = false;
    proj.life = 0;
    proj.targetRef = null;  // Release reference to prevent stale homing
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

// Vertical aim lock-on helper - targets enemies in front of player (180° arc)
// Close-range override: enemies within CLOSE_RANGE are targetable regardless of facing
const CLOSE_RANGE = 3;  // Units — allows targeting overlapping/contact enemies

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
        .filter(e => {
            if (e.dist >= maxRange) return false;
            // Close-range override: always targetable when overlapping/touching
            if (e.dist <= CLOSE_RANGE) return true;
            // Normal forward-arc check (>= 0 includes perpendicular)
            return e.dot >= 0;
        })
        .sort((a, b) => a.dist - b.dist)
        .slice(0, count)
        .map(e => e.enemy);
}

export function shootProjectile() {
    if (!poolInitialized) initProjectilePool();
    
    // Block attacks during hit recovery (invulnerability frames)
    if (player.isRecovering) return;
    
    // Frame-based cooldown (respects slow-mo and pause)
    const fireRateInFrames = getFireRateFrames();
    shotCooldownFrames++;
    
    if (shotCooldownFrames < fireRateInFrames) return;
    
    // Check for targets BEFORE resetting cooldown
    // This ensures the charge indicator only resets when an actual shot fires
    const projectileCount = Math.floor(gameState.stats.projectileCount);
    const targets = getNearestEnemies(projectileCount);
    if (targets.length === 0) return;  // No targets = no shot = don't reset timer
    
    // Reset frame counter and update lastShot for UI charge ring
    shotCooldownFrames = 0;
    lastShot = Date.now();  // WALL_CLOCK_OK: UI charge ring visual only
    
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
        projectile.targetRef = target;  // Mild homing: steer toward this target in flight
        
        projectiles.push(projectile);
    }
}

export function updateProjectiles(delta) {
    const turnRate = Math.min(1, HOMING_TURN_RATE * delta);

    // Player projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const proj = projectiles[i];
        
        // Mild homing: steer velocity toward target each frame
        if (turnRate > 0 && proj.targetRef) {
            // Validate target is still alive/in scene
            if (!proj.targetRef.parent || (proj.targetRef.health !== undefined && proj.targetRef.health <= 0)) {
                proj.targetRef = null;  // Target gone — fly straight
            } else {
                const speed = proj.velocity.length();
                tempVec3.subVectors(proj.targetRef.position, proj.position).normalize();
                // Blend: lerp velocity direction toward target direction
                proj.velocity.normalize().lerp(tempVec3, turnRate).normalize().multiplyScalar(speed);
            }
        }
        
        proj.position.addScaledVector(proj.velocity, delta);
        proj.life -= delta;
        
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
                
                // Guardian Crab anemone core absorbs damage first (disables aura when broken)
                if (enemy.behavior === 'wardenSupport' && !enemy.anemoneCoreBroken && enemy.anemoneCoreHP > 0) {
                    enemy.anemoneCoreHP -= damageDealt;
                    if (enemy.anemoneCoreHP <= 0) {
                        const spillover = Math.abs(enemy.anemoneCoreHP);
                        enemy.anemoneCoreHP = 0;
                        enemy.anemoneCoreBroken = true;
                        if (enemy.guardianCoreMesh) {
                            enemy.guardianCoreMesh.visible = false;
                        }
                        shatterWardenGrantedShields(enemy, { triggerSlowMo: true, playAudio: true });
                        damageDealt = spillover;
                    } else {
                        // Dim core as it weakens
                        if (enemy.guardianCoreMesh?.material?.emissive) {
                            const pct = enemy.anemoneCoreHP / (enemy.anemoneCoreMaxHP || enemy.anemoneCoreHP);
                            enemy.guardianCoreMesh.material.emissiveIntensity = 0.2 + pct * 0.7;
                        }
                        damageDealt = 0;
                    }
                }

                // Check for shield
                if (damageDealt > 0 && enemy.shieldHP > 0) {
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
                            enemy.shieldMesh.geometry = null;  // Don't dispose cached geometry
                            if (enemy.shieldMesh.material) enemy.shieldMesh.material.dispose();
                            enemy.shieldMesh = null;
                        }
                    }
                } else if (damageDealt > 0) {
                    // Normal damage
                    enemy.health -= damageDealt;
                    spawnParticle(proj.position, 0xff4444, 2);
                    
                    // Track damage dealt for combat stats
                    if (gameState.combatStats) {
                        gameState.combatStats.damageDealt += damageDealt;
                    }
                }
                // Hit flash - handle both Mesh and Group enemies
                const enemyMat = enemy.baseMaterial || enemy.material;
                if (enemyMat && enemyMat.emissive) {
                    safeFlashMaterial(enemyMat, enemy, 0xffffff, enemy.baseColor, 0.3, 50);
                }
                
                // Check death
                if (enemy.health <= 0) {
                    // Debug log
                    console.log('[XP] Enemy died:', { 
                        type: enemy.enemyType, 
                        xpValue: enemy.xpValue,
                        position: enemy.position.clone() 
                    });
                    
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
                
                // Item effects on hit
                applyOnHitItemEffects(proj, enemy, proj.damage);
                
                // Pierce: allow projectile to pass through extra targets
                const hasPierce = gameState.heldItems.includes('pierce');
                if (hasPierce) {
                    proj.pierceCount = (proj.pierceCount || 0) + 1;
                    const maxPierce = PROJECTILE_ITEMS.pierce.extraPierceTargets;
                    if (proj.pierceCount > maxPierce) {
                        hit = true;
                        break;
                    }
                    // Pierce budget remaining — continue to next enemy
                    continue;
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
            
            // Item effects on boss hit (explosion AoE can hit nearby mobs)
            applyOnHitItemEffects(proj, currentBoss, damageDealt);
            
            currentBoss.scale.setScalar(0.75 + 0.25 * Math.max(0, currentBoss.health / currentBoss.maxHealth));
            
            if (currentBoss.bodyMaterial) {
                safeFlashMaterial(currentBoss.bodyMaterial, currentBoss, 0xffffff, currentBoss.baseColor, 0.3, 50);
            }
            
            // Check for retreat threshold before death (Arena 1 chase mode)
            if (checkBossRetreat(currentBoss)) {
                // Boss is retreating - don't kill
                hit = true;
                continue;
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
        proj.position.addScaledVector(proj.velocity, delta);
        proj.life -= delta;
        
        // Check player hit (using frame-based damage cooldown)
        if (proj.position.distanceTo(player.position) < 1) {
            if (canTakeCollisionDamage()) {
                takeDamage(proj.damage, 'Enemy Projectile', 'projectile');
                resetDamageCooldown();
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

// ============================================================================
// PROJECTILE ITEM ON-HIT EFFECTS (Chain, Explosion)
// Pierce is handled inline in the hit loop above.
// ============================================================================

/**
 * Apply held-item on-hit effects (chain bolt, explosion AoE).
 * @param {Object} proj - The projectile that hit
 * @param {Object} hitTarget - The enemy/boss that was hit
 * @param {number} damageDealt - Damage dealt by the hit
 */
function applyOnHitItemEffects(proj, hitTarget, damageDealt) {
    const held = gameState.heldItems;
    if (held.length === 0) return;
    
    // Explosion: deal AoE damage to nearby enemies (not the hit target)
    if (held.includes('explosion')) {
        const cfg = PROJECTILE_ITEMS.explosion;
        const aoeDamage = damageDealt * cfg.explosionDamageMult;
        for (let k = enemies.length - 1; k >= 0; k--) {
            const nearby = enemies[k];
            if (nearby === hitTarget) continue;
            const dist = nearby.position.distanceTo(proj.position);
            if (dist < cfg.explosionRadius) {
                nearby.health -= aoeDamage * (1 - (nearby.damageReduction || 0));
                spawnParticle(nearby.position, 0xff6622, 2);
                if (nearby.health <= 0) {
                    handleEnemyDeath(nearby);
                    spawnXpGem(nearby.position, nearby.xpValue);
                    spawnParticle(nearby.position, nearby.baseColor, 5);
                    if (nearby.isGroup || nearby.type === 'Group') {
                        nearby.traverse(child => { if (child.material) child.material.dispose(); });
                    } else {
                        if (nearby.material) nearby.material.dispose();
                    }
                    scene.remove(nearby);
                    enemies.splice(k, 1);
                    gameState.kills++;
                    gameState.score += nearby.isElite ? 30 : 10;
                }
            }
        }
        // Small screen-shake-like particle burst at impact
        spawnParticle(proj.position, 0xff4422, 4);
    }
    
    // Chain: spawn a secondary projectile toward nearest other enemy
    if (held.includes('chain') && !proj.isChainBolt) {
        const cfg = PROJECTILE_ITEMS.chain;
        let nearest = null;
        let nearestDist = cfg.chainRange;
        for (const e of enemies) {
            if (e === hitTarget) continue;
            const d = e.position.distanceTo(proj.position);
            if (d < nearestDist) {
                nearestDist = d;
                nearest = e;
            }
        }
        if (nearest) {
            const chainProj = getNextPlayerProjectile();
            chainProj.position.copy(proj.position);
            const dir = tempVec3.subVectors(nearest.position, proj.position).normalize();
            chainProj.velocity.copy(dir).multiplyScalar(gameState.stats.projectileSpeed * 1.2);
            chainProj.damage = damageDealt * cfg.chainDamageMult;
            chainProj.life = 60;
            chainProj.spawnPos.copy(proj.position);
            chainProj.targetRef = nearest;
            chainProj.isChainBolt = true;  // Prevent infinite chaining
            projectiles.push(chainProj);
        }
    }
}

// ============================================================================
// DASH STRIKE DAMAGE HELPERS
// Shared damage logic for Dash Strike ability (reuses projectile kill paths)
// ============================================================================

/**
 * Finalize enemy kill - handles death effects, XP drops, cleanup
 * Mirrors the projectile kill path for consistency
 */
export function finalizeEnemyKill(enemy, enemyIndex = -1) {
    if (!enemy) return false;

    const idx = Number.isInteger(enemyIndex) && enemyIndex >= 0
        ? enemyIndex
        : enemies.indexOf(enemy);

    // Boss minion cleanup + shield expose logic (mirrors projectile kill path)
    if (enemy.isBossMinion && enemy.parentBoss) {
        const boss = enemy.parentBoss;
        const minionIndex = boss.summonedMinions ? boss.summonedMinions.indexOf(enemy) : -1;
        if (minionIndex > -1) {
            boss.summonedMinions.splice(minionIndex, 1);
        }

        // Tether snap VFX + cleanup
        if (enemy.tether) {
            const snapVFX = createTetherSnapVFX(enemy.position.clone(), boss.baseColor);
            if (boss.tetherSnapVFXList) {
                boss.tetherSnapVFXList.push(snapVFX);
            }

            const tetherIndex = boss.minionTethers ? boss.minionTethers.indexOf(enemy.tether) : -1;
            if (tetherIndex > -1) {
                boss.minionTethers.splice(tetherIndex, 1);
            }

            cleanupVFX(enemy.tether);
            enemy.tether = null;
        }

        // All minions dead => expose boss (full reward)
        if ((boss.summonedMinions?.length || 0) === 0 && boss.shieldActive) {
            boss.shieldActive = false;
            boss.isExposed = true;

            const exposedConfig = boss.exposedConfig;
            const phaseDuration = exposedConfig?.durationByPhase?.[boss.phase] || exposedConfig?.duration || 300;
            boss.exposedTimer = phaseDuration;
            boss.exposedDamageMultiplier = exposedConfig?.damageMultiplier || 1.25;

            if (boss.shieldMesh) boss.shieldMesh.visible = false;
            spawnShieldBreakVFX(boss.position, 0x4488ff);
            PulseMusic.onBossShieldBreak();
            PulseMusic.onBossExposed();

            boss.exposedVFX = createExposedVFX(boss);

            if (boss.minionTethers) {
                for (const tether of boss.minionTethers) cleanupVFX(tether);
                boss.minionTethers = [];
            }
        }
    }

    handleEnemyDeath(enemy);

    spawnXpGem(enemy.position, enemy.xpValue);
    spawnParticle(enemy.position, enemy.baseColor, 5);

    if (Math.random() < (enemy.isElite ? HEART_DROP_CHANCE.elite : HEART_DROP_CHANCE.normal)) {
        spawnHeart(enemy.position.clone(), enemy.isElite ? HEART_HEAL.elite : HEART_HEAL.normal);
    }

    // Cleanup (match existing projectile kill behavior)
    if (enemy.isGroup || enemy.type === 'Group') {
        enemy.traverse(child => {
            if (child.material) child.material.dispose();
        });
    } else {
        if (enemy.material) enemy.material.dispose();
    }

    scene.remove(enemy);
    if (idx >= 0) enemies.splice(idx, 1);

    gameState.kills++;
    gameState.score += enemy.isElite ? 30 : 10;

    return true;
}

/**
 * Apply Dash Strike damage to an enemy (handles shields, death, etc.)
 * Returns { hit: boolean, killed: boolean, damageDealt: number }
 */
export function applyDashStrikeDamageToEnemy(enemy, rawDamage, hitPosition, enemyIndex = -1) {
    if (!enemy || enemy.isDying) return { hit: false, killed: false, damageDealt: 0 };

    let damageDealt = rawDamage * (1 - (enemy.damageReduction || 0));

    // Guardian Crab anemone core absorbs damage first
    if (enemy.behavior === 'wardenSupport' && !enemy.anemoneCoreBroken && enemy.anemoneCoreHP > 0) {
        enemy.anemoneCoreHP -= damageDealt;

        if (enemy.anemoneCoreHP <= 0) {
            const spillover = Math.abs(enemy.anemoneCoreHP);
            enemy.anemoneCoreHP = 0;
            enemy.anemoneCoreBroken = true;

            if (enemy.guardianCoreMesh) enemy.guardianCoreMesh.visible = false;

            shatterWardenGrantedShields(enemy, { triggerSlowMo: true, playAudio: true });
            damageDealt = spillover;
        } else {
            if (enemy.guardianCoreMesh?.material?.emissive) {
                const pct = enemy.anemoneCoreHP / (enemy.anemoneCoreMaxHP || enemy.anemoneCoreHP);
                enemy.guardianCoreMesh.material.emissiveIntensity = 0.2 + pct * 0.7;
            }
            damageDealt = 0;
        }
    }

    // Shields absorb first (match projectile rules)
    if (damageDealt > 0 && enemy.shieldHP > 0) {
        showTutorialCallout('shield', 'Break shields first!', 2000);

        enemy.shieldHP -= damageDealt;
        spawnShieldHitVFX(hitPosition || enemy.position, enemy.baseColor);
        PulseMusic.onShieldHit();

        if (enemy.shieldHP <= 0) {
            enemy.shieldBroken = true;
            spawnShieldBreakVFX(enemy.position, 0x4488ff);
            PulseMusic.onShieldBreak();
            triggerSlowMo(5, 0.3);
            triggerScreenFlash(0x4488ff, 6);

            enemy.stunned = true;
            enemy.stunTimer = 12;

            if (enemy.shieldMesh) {
                enemy.remove(enemy.shieldMesh);
                enemy.shieldMesh.geometry = null; // cached/shared
                if (enemy.shieldMesh.material) enemy.shieldMesh.material.dispose();
                enemy.shieldMesh = null;
            }
        }
    } else if (damageDealt > 0) {
        enemy.health -= damageDealt;

        // Dash Strike hit VFX (cyan)
        spawnParticle(hitPosition || enemy.position, 0x00ffff, 4);

        if (gameState.combatStats) {
            gameState.combatStats.damageDealt += damageDealt;
        }
    }

    // Hit flash
    const enemyMat = enemy.baseMaterial || enemy.material;
    if (enemyMat && enemyMat.emissive) {
        safeFlashMaterial(enemyMat, enemy, 0x00ffff, enemy.baseColor, 0.3, 90);
    }

    if (enemy.health <= 0) {
        finalizeEnemyKill(enemy, enemyIndex);
        return { hit: true, killed: true, damageDealt };
    }

    return { hit: true, killed: false, damageDealt };
}

/**
 * Apply Dash Strike damage to boss (handles shields, exposed state, retreat, death)
 * Returns { hit: boolean, damageDealt: number, retreated: boolean, killed: boolean }
 */
export function applyDashStrikeDamageToBoss(boss, rawDamage, hitPosition) {
    if (!boss || boss.isDying) return { hit: false, damageDealt: 0, retreated: false, killed: false };

    const pos = hitPosition || boss.position;
    let damageDealt = rawDamage;

    if (boss.shieldActive) {
        showTutorialCallout('bossShield', 'Kill minions to drop the shield!', 3000);

        const shieldReduction = boss.shieldConfig?.damageReduction || 0.95;
        damageDealt *= (1 - shieldReduction);

        spawnShieldHitVFX(pos, boss.baseColor);
        PulseMusic.onShieldHit();
    } else if (boss.isExposed) {
        damageDealt *= 1.25;
        spawnParticle(pos, 0xffdd44, 3);
    } else {
        spawnParticle(pos, 0x00ffff, 4);
    }

    boss.health -= damageDealt;

    if (gameState.combatStats) {
        gameState.combatStats.damageDealt += damageDealt;
    }

    boss.scale.setScalar(0.75 + 0.25 * Math.max(0, boss.health / boss.maxHealth));

    if (boss.bodyMaterial) {
        safeFlashMaterial(boss.bodyMaterial, boss, 0x00ffff, boss.baseColor, 0.3, 90);
    }

    const retreated = checkBossRetreat(boss);
    if (retreated) return { hit: true, damageDealt, retreated: true, killed: false };

    let killed = false;
    if (boss.health <= 0 && !boss.isDying) {
        killBoss();
        killed = true;
    }

    return { hit: true, damageDealt, retreated: false, killed };
}
