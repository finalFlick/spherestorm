import { scene } from '../core/scene.js';
import { gameState } from '../core/gameState.js';
import { enemies, obstacles, tempVec3, getCurrentBoss, setCurrentBoss } from '../core/entities.js';
import { player } from './player.js';
import { spawnSpecificEnemy, spawnSplitEnemy } from './enemies.js';
import { BOSS_CONFIG, ABILITY_COOLDOWNS, ABILITY_TELLS } from '../config/bosses.js';
import { DAMAGE_COOLDOWN, HEART_HEAL } from '../config/constants.js';
import { spawnParticle } from '../effects/particles.js';
import { spawnXpGem, spawnHeart } from '../systems/pickups.js';
import { createHazardZone } from '../arena/generator.js';
import { takeDamage, lastDamageTime, setLastDamageTime } from '../systems/damage.js';
import { showBossHealthBar, updateBossHealthBar, hideBossHealthBar } from '../ui/hud.js';
import { markBossEncountered } from '../ui/rosterUI.js';

// Anti-stuck detection - more aggressive settings
const STUCK_THRESHOLD = 0.02;  // Minimum movement per frame
const STUCK_FRAMES = 20;       // Frames before considered stuck (faster detection)

export function spawnBoss(arenaNumber) {
    const config = BOSS_CONFIG[Math.min(arenaNumber, 6)];
    const boss = new THREE.Group();
    
    const bodyMat = new THREE.MeshStandardMaterial({
        color: config.color,
        emissive: config.color,
        emissiveIntensity: 0.5
    });
    
    const body = new THREE.Mesh(
        new THREE.SphereGeometry(config.size, 16, 16),
        bodyMat
    );
    body.castShadow = true;
    boss.add(body);
    
    // Glow effect
    boss.add(new THREE.Mesh(
        new THREE.SphereGeometry(config.size * 1.2, 16, 16),
        new THREE.MeshBasicMaterial({
            color: config.color,
            transparent: true,
            opacity: 0.3
        })
    ));
    
    // Crown/horns
    const hornMat = new THREE.MeshStandardMaterial({ color: 0xffdd44 });
    for (let i = 0; i < 5; i++) {
        const horn = new THREE.Mesh(
            new THREE.ConeGeometry(0.4, 1.2, 8),
            hornMat
        );
        horn.position.set((i - 2) * 0.6, config.size + 0.4, 0);
        horn.rotation.z = (i - 2) * 0.15;
        boss.add(horn);
    }
    
    // Boss properties
    boss.health = config.health + gameState.level * 25;
    boss.maxHealth = boss.health;
    boss.damage = config.damage;
    boss.size = config.size;
    boss.baseSize = config.size;
    boss.speed = config.speed || 0.045;
    boss.isBoss = true;
    boss.isElite = false;
    boss.xpValue = 15 + arenaNumber * 5;  // Balanced: ~1-2 level-ups per boss
    boss.baseColor = config.color;
    boss.bodyMaterial = bodyMat;
    boss.velocityY = 0;
    boss.aiState = 'idle';
    boss.aiTimer = 0;
    boss.phase = 1;
    boss.chargeSpeed = 0.35;
    
    // Modular ability system
    boss.abilities = { ...config.abilities };
    boss.abilityWeights = config.abilityWeights;
    boss.phaseCombos = config.phaseCombos || {};
    boss.abilityCooldowns = {};
    boss.currentCombo = null;
    boss.comboIndex = 0;
    
    // Initialize cooldowns
    for (const ability in ABILITY_COOLDOWNS) {
        boss.abilityCooldowns[ability] = 0;
    }
    
    // Anti-stuck tracking
    boss.lastPosition = new THREE.Vector3();
    boss.stuckFrames = 0;
    boss.strafeDirection = 1;  // 1 = right, -1 = left
    boss.strafeTimer = 0;
    
    // Jump target for jump slam
    boss.jumpTarget = new THREE.Vector3();
    
    // Burrow state
    boss.burrowTarget = new THREE.Vector3();
    
    // Growth tracking
    boss.growthScale = 1.0;
    boss.hasSplit = false;
    
    boss.position.set(0, config.size, -35);
    scene.add(boss);
    setCurrentBoss(boss);
    showBossHealthBar(config.name);
    
    // Mark boss as encountered for roster
    markBossEncountered(arenaNumber);
    
    return boss;
}

export function updateBoss() {
    const currentBoss = getCurrentBoss();
    if (!currentBoss) return;
    
    const boss = currentBoss;
    boss.aiTimer++;
    
    // Update cooldowns
    for (const ability in boss.abilityCooldowns) {
        if (boss.abilityCooldowns[ability] > 0) {
            boss.abilityCooldowns[ability]--;
        }
    }
    
    // Phase transitions
    const healthPercent = boss.health / boss.maxHealth;
    if (healthPercent < 0.33 && boss.phase < 3) {
        boss.phase = 3;
        boss.speed *= 1.3;
        // Reset combo to potentially trigger phase 3 combos
        boss.currentCombo = null;
    } else if (healthPercent < 0.66 && boss.phase < 2) {
        boss.phase = 2;
        boss.speed *= 1.15;
        boss.currentCombo = null;
    }
    
    // Anti-stuck detection
    updateAntiStuck(boss);
    
    // Unified AI loop
    updateBossAI(boss);
    
    // Gravity
    boss.velocityY = (boss.velocityY || 0) - 0.015;
    boss.position.y += boss.velocityY;
    if (boss.position.y < boss.size * boss.growthScale) {
        boss.position.y = boss.size * boss.growthScale;
        boss.velocityY = 0;
    }
    
    // Player collision
    const distToPlayer = boss.position.distanceTo(player.position);
    const effectiveSize = boss.size * boss.growthScale * boss.scale.x;
    if (distToPlayer < effectiveSize + 0.5) {
        const now = Date.now();
        if (now - lastDamageTime > DAMAGE_COOLDOWN) {
            takeDamage(boss.damage);
            setLastDamageTime(now);
        }
    }
    
    updateBossHealthBar();
}

// ==================== ANTI-STUCK SYSTEM ====================

function updateAntiStuck(boss) {
    const moved = boss.position.distanceTo(boss.lastPosition);
    
    // Check for stuck in any ground state (not jumping/burrowing/teleporting)
    const groundStates = ['idle', 'cooldown', 'landed', 'hazards', 'summon', 'growth'];
    const isGroundState = groundStates.includes(boss.aiState);
    
    if (isGroundState) {
        if (moved < STUCK_THRESHOLD) {
            boss.stuckFrames++;
        } else {
            boss.stuckFrames = Math.max(0, boss.stuckFrames - 2); // Decay faster when moving
        }
    } else {
        boss.stuckFrames = 0;
    }
    
    boss.lastPosition.copy(boss.position);
    
    // If stuck, trigger recovery behavior
    if (boss.stuckFrames > STUCK_FRAMES) {
        triggerStuckRecovery(boss);
    }
    
    // Handle strafe recovery - more aggressive movement
    if (boss.strafeTimer > 0) {
        boss.strafeTimer--;
        const strafeVec = new THREE.Vector3();
        strafeVec.subVectors(player.position, boss.position);
        strafeVec.y = 0;
        
        // Perpendicular strafe + slight forward movement
        const perpX = -strafeVec.z * boss.strafeDirection;
        const perpZ = strafeVec.x * boss.strafeDirection;
        strafeVec.normalize();
        
        // Combine perpendicular and forward movement
        boss.position.x += (perpX * 0.7 + strafeVec.x * 0.3) * boss.speed * 2;
        boss.position.z += (perpZ * 0.7 + strafeVec.z * 0.3) * boss.speed * 2;
        clampBossPosition(boss);
    }
}

function triggerStuckRecovery(boss) {
    boss.stuckFrames = 0;
    
    // Track recovery attempts
    boss.recoveryAttempts = (boss.recoveryAttempts || 0) + 1;
    
    // After multiple strafe attempts, force an ability
    if (boss.recoveryAttempts > 3) {
        boss.recoveryAttempts = 0;
        
        // Force teleport or jump if available (ignore cooldowns for stuck recovery)
        if (boss.abilities.teleport) {
            boss.aiState = 'teleport_out';
            boss.aiTimer = 0;
            return;
        } else if (boss.abilities.jumpSlam) {
            boss.aiState = 'jump_prep';
            boss.aiTimer = 0;
            return;
        }
    }
    
    // Pick recovery based on available abilities
    if (boss.abilities.teleport && boss.abilityCooldowns.teleport <= 0) {
        // Teleport bailout
        boss.aiState = 'teleport_out';
        boss.aiTimer = 0;
        boss.abilityCooldowns.teleport = ABILITY_COOLDOWNS.teleport;
        boss.recoveryAttempts = 0;
    } else if (boss.abilities.jumpSlam && boss.abilityCooldowns.jumpSlam <= 0) {
        // Jump slam bailout
        boss.aiState = 'jump_prep';
        boss.aiTimer = 0;
        boss.abilityCooldowns.jumpSlam = ABILITY_COOLDOWNS.jumpSlam;
        boss.recoveryAttempts = 0;
    } else if (boss.abilities.charge && boss.abilityCooldowns.charge <= 0) {
        // Charge redirect (tangent direction)
        boss.aiState = 'wind_up';
        boss.aiTimer = 0;
        boss.abilityCooldowns.charge = ABILITY_COOLDOWNS.charge;
        boss.recoveryAttempts = 0;
    } else {
        // Default: strafe mode - longer duration
        boss.strafeTimer = 60;  // 1 second strafe
        boss.strafeDirection *= -1;  // Alternate direction
    }
}

// ==================== UNIFIED AI LOOP ====================

function updateBossAI(boss) {
    // If in strafe recovery, don't change state
    if (boss.strafeTimer > 0) return;
    
    // Continue current action if busy
    if (boss.aiState !== 'idle' && boss.aiState !== 'cooldown') {
        continueCurrentAbility(boss);
        return;
    }
    
    // In cooldown, move toward player slowly
    if (boss.aiState === 'cooldown') {
        moveTowardPlayer(boss, 0.5);
        if (boss.aiTimer > 30) {
            boss.aiState = 'idle';
            boss.aiTimer = 0;
        }
        return;
    }
    
    // Idle state - pick next ability
    moveTowardPlayer(boss, 1.0);
    
    // Check if we should execute a combo
    if (boss.currentCombo && boss.comboIndex < boss.currentCombo.length) {
        const nextAbility = boss.currentCombo[boss.comboIndex];
        if (boss.abilityCooldowns[nextAbility] <= 0) {
            startAbility(boss, nextAbility);
            boss.comboIndex++;
            return;
        }
    } else {
        boss.currentCombo = null;
        boss.comboIndex = 0;
    }
    
    // Wait minimum time before next ability
    if (boss.aiTimer < 60) return;
    
    // Pick next ability
    const ability = pickAbility(boss);
    if (ability) {
        // Check for combo opportunity
        const combos = boss.phaseCombos[boss.phase];
        if (combos && combos.length > 0 && Math.random() < 0.3 * boss.phase) {
            // Try to start a combo that begins with this ability
            const matchingCombos = combos.filter(c => c[0] === ability);
            if (matchingCombos.length > 0) {
                boss.currentCombo = matchingCombos[Math.floor(Math.random() * matchingCombos.length)];
                boss.comboIndex = 0;
            }
        }
        
        startAbility(boss, ability);
    }
}

function pickAbility(boss) {
    const available = [];
    let totalWeight = 0;
    
    for (const [ability, enabled] of Object.entries(boss.abilities)) {
        if (!enabled) continue;
        if (boss.abilityCooldowns[ability] > 0) continue;
        
        const weights = boss.abilityWeights[ability];
        if (!weights) continue;
        
        const weight = weights[boss.phase - 1] || weights[0];
        available.push({ ability, weight });
        totalWeight += weight;
    }
    
    if (available.length === 0) return null;
    
    // Weighted random selection
    let random = Math.random() * totalWeight;
    for (const { ability, weight } of available) {
        random -= weight;
        if (random <= 0) return ability;
    }
    
    return available[0].ability;
}

function startAbility(boss, ability) {
    boss.aiTimer = 0;
    boss.abilityCooldowns[ability] = ABILITY_COOLDOWNS[ability];
    
    switch (ability) {
        case 'charge':
            boss.aiState = 'wind_up';
            boss.bodyMaterial.emissiveIntensity = 1;
            break;
        case 'summon':
            boss.aiState = 'summon';
            break;
        case 'jumpSlam':
            boss.aiState = 'jump_prep';
            boss.bodyMaterial.emissiveIntensity = 1;
            break;
        case 'hazards':
            boss.aiState = 'hazards';
            break;
        case 'teleport':
            boss.aiState = 'teleport_out';
            break;
        case 'growth':
            boss.aiState = 'growth';
            break;
        case 'split':
            if (!boss.hasSplit && boss.health < boss.maxHealth * 0.5) {
                boss.aiState = 'split';
            } else {
                boss.aiState = 'idle';  // Can't split yet
            }
            break;
        case 'burrow':
            boss.aiState = 'burrowing';
            break;
    }
}

function continueCurrentAbility(boss) {
    const tellDuration = getTellDuration(boss);
    
    switch (boss.aiState) {
        // CHARGE ABILITY
        case 'wind_up':
            if (boss.aiTimer > tellDuration.charge) {
                boss.aiState = 'charging';
                boss.chargeDirection = tempVec3.subVectors(player.position, boss.position).normalize().clone();
                boss.chargeDirection.y = 0;
                boss.aiTimer = 0;
            }
            break;
        case 'charging':
            boss.position.add(boss.chargeDirection.clone().multiplyScalar(boss.chargeSpeed));
            if (boss.aiTimer > 50 || isOutOfBounds(boss)) {
                boss.aiState = 'cooldown';
                boss.aiTimer = 0;
                boss.bodyMaterial.emissiveIntensity = 0.5;
                clampBossPosition(boss);
            }
            break;
            
        // SUMMON ABILITY
        case 'summon':
            if (boss.aiTimer === Math.floor(tellDuration.summon)) {
                const summonCount = boss.phase + 1;
                for (let i = 0; i < summonCount; i++) {
                    // Arena-aware minion spawning - spawn what player has learned
                    let enemyType;
                    if (gameState.currentArena === 1) {
                        // Arena 1: Only grunts (what player has learned)
                        enemyType = 'grunt';
                    } else if (boss.abilities.teleport && Math.random() < 0.3) {
                        // Later arenas with teleport: chance to spawn teleporters
                        enemyType = 'teleporter';
                    } else {
                        // Default: fastBouncers
                        enemyType = 'fastBouncer';
                    }
                    spawnSpecificEnemy(enemyType, boss.position);
                }
                spawnParticle(boss.position, boss.baseColor, 10);
            }
            if (boss.aiTimer > tellDuration.summon + 20) {
                boss.aiState = 'idle';
                boss.aiTimer = 0;
            }
            break;
            
        // JUMP SLAM ABILITY
        case 'jump_prep':
            if (boss.aiTimer > tellDuration.jumpSlam) {
                boss.aiState = 'jumping';
                boss.velocityY = 0.45;
                boss.jumpTarget.copy(player.position);
                boss.aiTimer = 0;
            }
            break;
        case 'jumping':
            tempVec3.subVectors(boss.jumpTarget, boss.position);
            tempVec3.y = 0;
            tempVec3.normalize();
            boss.position.add(tempVec3.multiplyScalar(0.15));
            
            if (boss.position.y <= boss.size * boss.growthScale + 0.1 && boss.velocityY < 0) {
                boss.aiState = 'landed';
                boss.aiTimer = 0;
                boss.bodyMaterial.emissiveIntensity = 0.5;
                // Damage nearby player
                if (player.position.distanceTo(boss.position) < 6) {
                    takeDamage(boss.damage * 0.6);
                }
                // Create hazard if boss has hazards ability
                if (boss.abilities.hazards) {
                    createHazardZone(boss.position.x, boss.position.z, 4, 400);
                }
                spawnParticle(boss.position, boss.baseColor, 25);
            }
            break;
        case 'landed':
            if (boss.aiTimer > 40) {
                boss.aiState = 'idle';
                boss.aiTimer = 0;
            }
            break;
            
        // HAZARDS ABILITY
        case 'hazards':
            if (boss.aiTimer === Math.floor(tellDuration.hazards)) {
                const hazardCount = boss.phase + 1;
                for (let i = 0; i < hazardCount; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const dist = 5 + Math.random() * 10;
                    createHazardZone(
                        boss.position.x + Math.cos(angle) * dist,
                        boss.position.z + Math.sin(angle) * dist,
                        2 + boss.phase * 0.5,
                        300
                    );
                }
            }
            if (boss.aiTimer > tellDuration.hazards + 30) {
                boss.aiState = 'idle';
                boss.aiTimer = 0;
            }
            break;
            
        // TELEPORT ABILITY
        case 'teleport_out':
            boss.scale.setScalar(Math.max(0.01, 1 - boss.aiTimer / tellDuration.teleport));
            if (boss.aiTimer > tellDuration.teleport) {
                const angle = Math.random() * Math.PI * 2;
                const dist = 12 + Math.random() * 12;
                boss.position.x = Math.max(-40, Math.min(40, player.position.x + Math.cos(angle) * dist));
                boss.position.z = Math.max(-40, Math.min(40, player.position.z + Math.sin(angle) * dist));
                boss.aiState = 'teleport_in';
                boss.aiTimer = 0;
                spawnParticle(boss.position, 0xaa44ff, 15);
            }
            break;
        case 'teleport_in':
            boss.scale.setScalar(Math.min(1, boss.aiTimer / 20));
            if (boss.aiTimer > 20) {
                boss.scale.setScalar(1);
                // Spawn teleporter minion in higher phases
                if (boss.phase >= 2 && Math.random() < 0.4) {
                    spawnSpecificEnemy('teleporter', boss.position);
                }
                boss.aiState = 'idle';
                boss.aiTimer = 0;
            }
            break;
            
        // GROWTH ABILITY
        case 'growth':
            if (boss.growthScale < 1.5) {
                boss.growthScale += 0.003;
                boss.scale.setScalar(boss.growthScale);
            }
            // Spawn water balloons during growth
            if (boss.aiTimer % 60 === 0 && boss.aiTimer > 0) {
                spawnSpecificEnemy('waterBalloon', boss.position);
            }
            if (boss.aiTimer > 120) {
                boss.aiState = 'idle';
                boss.aiTimer = 0;
            }
            break;
            
        // SPLIT ABILITY
        case 'split':
            if (boss.aiTimer === Math.floor(tellDuration.split)) {
                boss.hasSplit = true;
                for (let i = 0; i < 3; i++) {
                    spawnMiniBoss(boss.position, i);
                }
                spawnParticle(boss.position, boss.baseColor, 20);
            }
            if (boss.aiTimer > tellDuration.split + 30) {
                boss.aiState = 'idle';
                boss.aiTimer = 0;
            }
            break;
            
        // BURROW ABILITY
        case 'burrowing':
            boss.position.y -= 0.1;
            if (boss.position.y < -2) {
                // Emerge near player
                boss.burrowTarget.set(
                    player.position.x + (Math.random() - 0.5) * 8,
                    boss.size * boss.growthScale,
                    player.position.z + (Math.random() - 0.5) * 8
                );
                boss.position.x = boss.burrowTarget.x;
                boss.position.z = boss.burrowTarget.z;
                clampBossPosition(boss);
                boss.aiState = 'emerging';
                boss.aiTimer = 0;
            }
            break;
        case 'emerging':
            boss.position.y += 0.15;
            if (boss.position.y >= boss.size * boss.growthScale) {
                boss.position.y = boss.size * boss.growthScale;
                boss.aiState = 'idle';
                boss.aiTimer = 0;
                // Damage player if nearby
                if (player.position.distanceTo(boss.position) < 5) {
                    takeDamage(boss.damage * 0.8);
                }
                // Create hazard on emerge
                if (boss.abilities.hazards) {
                    createHazardZone(boss.position.x, boss.position.z, 3, 300);
                }
                spawnParticle(boss.position, boss.baseColor, 20);
            }
            break;
    }
}

// ==================== HELPER FUNCTIONS ====================

function getTellDuration(boss) {
    const phaseKey = `phase${boss.phase}`;
    const tells = {};
    for (const [ability, durations] of Object.entries(ABILITY_TELLS)) {
        tells[ability] = durations[phaseKey] || durations.phase1;
    }
    return tells;
}

function moveTowardPlayer(boss, speedMultiplier = 1.0) {
    tempVec3.subVectors(player.position, boss.position);
    tempVec3.y = 0;
    tempVec3.normalize();
    boss.position.add(tempVec3.multiplyScalar(boss.speed * speedMultiplier));
    clampBossPosition(boss);
}

function clampBossPosition(boss) {
    boss.position.x = Math.max(-42, Math.min(42, boss.position.x));
    boss.position.z = Math.max(-42, Math.min(42, boss.position.z));
}

function isOutOfBounds(boss) {
    return Math.abs(boss.position.x) > 42 || Math.abs(boss.position.z) > 42;
}

function spawnMiniBoss(position, index) {
    const angle = (index / 3) * Math.PI * 2;
    const miniBoss = new THREE.Mesh(
        new THREE.SphereGeometry(1.5, 12, 12),
        new THREE.MeshStandardMaterial({
            color: 0x66ffff,
            emissive: 0x44ffff,
            emissiveIntensity: 0.4
        })
    );
    
    miniBoss.position.set(
        position.x + Math.cos(angle) * 5,
        1.5,
        position.z + Math.sin(angle) * 5
    );
    miniBoss.castShadow = true;
    miniBoss.health = 150;
    miniBoss.maxHealth = 150;
    miniBoss.speed = 0.04;
    miniBoss.damage = 15;
    miniBoss.size = 1.5;
    miniBoss.baseSize = 1.5;
    miniBoss.isBoss = false;
    miniBoss.isElite = true;
    miniBoss.xpValue = 20;
    miniBoss.baseColor = 0x66ffff;
    miniBoss.velocityY = 0;
    miniBoss.velocity = new THREE.Vector3();
    miniBoss.enemyType = 'miniBoss';
    miniBoss.behavior = 'chase';
    miniBoss.damageReduction = 0.3;
    
    scene.add(miniBoss);
    enemies.push(miniBoss);
}

export function killBoss() {
    const currentBoss = getCurrentBoss();
    if (!currentBoss || currentBoss.isDying) return;
    currentBoss.isDying = true;
    
    // Spawn XP gems from boss
    for (let i = 0; i < 12; i++) {
        const offset = new THREE.Vector3(
            (Math.random() - 0.5) * 6,
            0,
            (Math.random() - 0.5) * 6
        );
        spawnXpGem(currentBoss.position.clone().add(offset), currentBoss.xpValue / 12);
    }
    
    // Spawn heart
    spawnHeart(currentBoss.position.clone(), HEART_HEAL.boss);
    
    // Particles
    spawnParticle(currentBoss.position, currentBoss.baseColor, 20);
    
    // Clear all remaining enemies on boss defeat
    for (const enemy of enemies) {
        // Spawn small particle burst for each cleared enemy
        spawnParticle(enemy.position, enemy.baseColor || 0xffffff, 5);
        
        // Cleanup enemy resources
        if (enemy.isGroup || enemy.type === 'Group') {
            enemy.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
        } else {
            if (enemy.geometry) enemy.geometry.dispose();
            if (enemy.baseMaterial) enemy.baseMaterial.dispose();
            if (enemy.material) enemy.material.dispose();
        }
        scene.remove(enemy);
    }
    enemies.length = 0;
    
    // Cleanup boss
    currentBoss.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
    });
    scene.remove(currentBoss);
    setCurrentBoss(null);
    
    gameState.bossActive = false;
    hideBossHealthBar();
    gameState.kills++;
    gameState.score += 750;
}
