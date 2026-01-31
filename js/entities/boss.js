import { scene } from '../core/scene.js';
import { gameState } from '../core/gameState.js';
import { enemies, tempVec3, getCurrentBoss, setCurrentBoss } from '../core/entities.js';
import { player } from './player.js';
import { spawnSpecificEnemy, spawnSplitEnemy } from './enemies.js';
import { BOSS_CONFIG } from '../config/bosses.js';
import { DAMAGE_COOLDOWN, HEART_HEAL } from '../config/constants.js';
import { spawnParticle } from '../effects/particles.js';
import { spawnXpGem, spawnHeart } from '../systems/pickups.js';
import { createHazardZone } from '../arena/generator.js';
import { takeDamage, lastDamageTime, setLastDamageTime } from '../systems/damage.js';
import { showBossHealthBar, updateBossHealthBar, hideBossHealthBar } from '../ui/hud.js';

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
    boss.speed = 0.025;
    boss.isBoss = true;
    boss.isElite = false;
    boss.xpValue = 60 + arenaNumber * 15;
    boss.baseColor = config.color;
    boss.ai = config.ai;
    boss.bodyMaterial = bodyMat;
    boss.velocityY = 0;
    boss.aiState = 'idle';
    boss.aiTimer = 0;
    boss.phase = 1;
    boss.chargeSpeed = 0.25;
    
    boss.position.set(0, config.size, -35);
    scene.add(boss);
    setCurrentBoss(boss);
    showBossHealthBar(config.name);
    
    return boss;
}

export function updateBoss() {
    const currentBoss = getCurrentBoss();
    if (!currentBoss) return;
    
    const boss = currentBoss;
    boss.aiTimer++;
    
    // Phase transitions
    const healthPercent = boss.health / boss.maxHealth;
    if (healthPercent < 0.33 && boss.phase < 3) {
        boss.phase = 3;
        boss.speed *= 1.3;
    } else if (healthPercent < 0.66 && boss.phase < 2) {
        boss.phase = 2;
        boss.speed *= 1.15;
    }
    
    // AI routing
    switch (boss.ai) {
        case 'pillarGuardian': updatePillarGuardianAI(boss); break;
        case 'slimeQueen': updateSlimeQueenAI(boss); break;
        case 'teleportingTyrant': updateTeleportingTyrantAI(boss); break;
        case 'balloonKing': updateBalloonKingAI(boss); break;
        case 'tunnelWyrm': updateTunnelWyrmAI(boss); break;
        case 'chaosIncarnate': updateChaosIncarnateAI(boss); break;
        default: updateDefaultBossAI(boss);
    }
    
    // Gravity
    boss.velocityY = (boss.velocityY || 0) - 0.015;
    boss.position.y += boss.velocityY;
    if (boss.position.y < boss.size) {
        boss.position.y = boss.size;
        boss.velocityY = 0;
    }
    
    // Player collision
    const distToPlayer = boss.position.distanceTo(player.position);
    if (distToPlayer < boss.size * boss.scale.x + 0.5) {
        const now = Date.now();
        if (now - lastDamageTime > DAMAGE_COOLDOWN) {
            takeDamage(boss.damage);
            setLastDamageTime(now);
        }
    }
    
    updateBossHealthBar();
}

function updateDefaultBossAI(boss) {
    tempVec3.subVectors(player.position, boss.position);
    tempVec3.y = 0;
    tempVec3.normalize();
    boss.position.add(tempVec3.multiplyScalar(boss.speed));
    boss.position.x = Math.max(-42, Math.min(42, boss.position.x));
    boss.position.z = Math.max(-42, Math.min(42, boss.position.z));
}

function updatePillarGuardianAI(boss) {
    if (boss.aiState === 'idle') {
        updateDefaultBossAI(boss);
        if (boss.aiTimer > 200 && Math.random() < 0.02 * boss.phase) {
            boss.aiState = 'summon';
            boss.aiTimer = 0;
        }
        if (boss.aiTimer > 150) {
            boss.aiState = 'wind_up';
            boss.aiTimer = 0;
            boss.bodyMaterial.emissiveIntensity = 1;
        }
    } else if (boss.aiState === 'wind_up') {
        if (boss.aiTimer > 60) {
            boss.aiState = 'charging';
            boss.chargeDirection = tempVec3.subVectors(player.position, boss.position).normalize();
            boss.chargeDirection.y = 0;
            boss.aiTimer = 0;
        }
    } else if (boss.aiState === 'charging') {
        boss.position.add(boss.chargeDirection.clone().multiplyScalar(boss.chargeSpeed));
        if (boss.aiTimer > 35 || Math.abs(boss.position.x) > 42 || Math.abs(boss.position.z) > 42) {
            boss.aiState = 'cooldown';
            boss.aiTimer = 0;
            boss.bodyMaterial.emissiveIntensity = 0.5;
            boss.position.x = Math.max(-42, Math.min(42, boss.position.x));
            boss.position.z = Math.max(-42, Math.min(42, boss.position.z));
        }
    } else if (boss.aiState === 'summon') {
        if (boss.aiTimer === 30) {
            for (let i = 0; i < boss.phase; i++) {
                spawnSpecificEnemy('fastBouncer', boss.position);
            }
        }
        if (boss.aiTimer > 60) {
            boss.aiState = 'idle';
            boss.aiTimer = 0;
        }
    } else if (boss.aiState === 'cooldown') {
        if (boss.aiTimer > 80) {
            boss.aiState = 'idle';
            boss.aiTimer = 0;
        }
    }
}

function updateSlimeQueenAI(boss) {
    if (boss.aiState === 'idle') {
        updateDefaultBossAI(boss);
        if (boss.aiTimer % 60 === 0) {
            createHazardZone(boss.position.x, boss.position.z, 2 + boss.phase * 0.5, 300);
        }
        if (boss.aiTimer > 180) {
            boss.aiState = 'jump_prep';
            boss.aiTimer = 0;
        }
    } else if (boss.aiState === 'jump_prep') {
        boss.bodyMaterial.emissiveIntensity = 1;
        if (boss.aiTimer > 40) {
            boss.aiState = 'jumping';
            boss.velocityY = 0.45;
            boss.jumpTarget = player.position.clone();
            boss.aiTimer = 0;
        }
    } else if (boss.aiState === 'jumping') {
        tempVec3.subVectors(boss.jumpTarget, boss.position);
        tempVec3.y = 0;
        tempVec3.normalize();
        boss.position.add(tempVec3.multiplyScalar(0.15));
        
        if (boss.position.y <= boss.size + 0.1 && boss.velocityY < 0) {
            boss.aiState = 'landed';
            boss.aiTimer = 0;
            boss.bodyMaterial.emissiveIntensity = 0.5;
            if (player.position.distanceTo(boss.position) < 6) {
                takeDamage(boss.damage * 0.6);
            }
            createHazardZone(boss.position.x, boss.position.z, 4, 400);
            spawnParticle(boss.position, 0x44ff88, 25);
        }
    } else if (boss.aiState === 'landed') {
        if (boss.aiTimer > 60) {
            if (boss.phase >= 2 && Math.random() < 0.5) {
                for (let i = 0; i < boss.phase; i++) {
                    spawnSpecificEnemy('grunt', boss.position);
                }
            }
            boss.aiState = 'idle';
            boss.aiTimer = 0;
        }
    }
}

function updateTeleportingTyrantAI(boss) {
    if (boss.aiState === 'idle') {
        updateDefaultBossAI(boss);
        if (boss.aiTimer > 120 + Math.random() * 60) {
            boss.aiState = 'teleport_out';
            boss.aiTimer = 0;
        }
    } else if (boss.aiState === 'teleport_out') {
        boss.scale.setScalar(Math.max(0, 1 - boss.aiTimer / 30));
        if (boss.aiTimer > 30) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 15 + Math.random() * 15;
            boss.position.x = Math.max(-40, Math.min(40, player.position.x + Math.cos(angle) * dist));
            boss.position.z = Math.max(-40, Math.min(40, player.position.z + Math.sin(angle) * dist));
            boss.aiState = 'teleport_in';
            boss.aiTimer = 0;
            spawnParticle(boss.position, 0xaa44ff, 15);
        }
    } else if (boss.aiState === 'teleport_in') {
        boss.scale.setScalar(Math.min(1, boss.aiTimer / 30));
        if (boss.aiTimer > 30) {
            boss.scale.setScalar(1);
            if (boss.phase >= 2 && Math.random() < 0.4) {
                spawnSpecificEnemy('teleporter', boss.position);
            }
            boss.aiState = 'idle';
            boss.aiTimer = 0;
        }
    }
}

function updateBalloonKingAI(boss) {
    updateDefaultBossAI(boss);
    
    if (boss.scale.x < 1.3) {
        boss.scale.multiplyScalar(1.0005);
    }
    
    if (boss.aiTimer > 200 && Math.random() < 0.02 * boss.phase) {
        spawnSpecificEnemy('waterBalloon', boss.position);
    }
    
    if (boss.aiTimer > 150 && boss.aiTimer % 100 === 0) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 8 + Math.random() * 10;
        createHazardZone(
            boss.position.x + Math.cos(angle) * dist,
            boss.position.z + Math.sin(angle) * dist,
            3 + boss.phase,
            300
        );
    }
    
    if (boss.phase === 3 && !boss.hasSplit && boss.health < boss.maxHealth * 0.25) {
        boss.hasSplit = true;
        for (let i = 0; i < 3; i++) {
            spawnMiniBoss(boss.position, i);
        }
    }
}

function updateTunnelWyrmAI(boss) {
    if (boss.aiState === 'idle') {
        updateDefaultBossAI(boss);
        if (boss.aiTimer > 180) {
            boss.aiState = 'burrowing';
            boss.aiTimer = 0;
        }
    } else if (boss.aiState === 'burrowing') {
        boss.position.y -= 0.1;
        if (boss.position.y < -2) {
            boss.position.x = player.position.x + (Math.random() - 0.5) * 10;
            boss.position.z = player.position.z + (Math.random() - 0.5) * 10;
            boss.aiState = 'emerging';
            boss.aiTimer = 0;
        }
    } else if (boss.aiState === 'emerging') {
        boss.position.y += 0.15;
        if (boss.position.y >= boss.size) {
            boss.position.y = boss.size;
            boss.aiState = 'idle';
            boss.aiTimer = 0;
            if (player.position.distanceTo(boss.position) < 5) {
                takeDamage(boss.damage * 0.8);
            }
            spawnParticle(boss.position, 0xff44ff, 20);
        }
    }
}

function updateChaosIncarnateAI(boss) {
    const pattern = Math.floor(boss.aiTimer / 300) % 5;
    switch (pattern) {
        case 0: updatePillarGuardianAI(boss); break;
        case 1: updateSlimeQueenAI(boss); break;
        case 2: updateTeleportingTyrantAI(boss); break;
        case 3: updateBalloonKingAI(boss); break;
        case 4: updateTunnelWyrmAI(boss); break;
    }
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
    if (!currentBoss) return;
    
    // Spawn XP gems
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
    spawnParticle(currentBoss.position, currentBoss.baseColor, 40);
    
    // Cleanup
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
