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
import { handleEnemyDeath } from '../entities/enemies.js';
import { killBoss } from '../entities/boss.js';
import { spawnParticle } from '../effects/particles.js';
import { spawnXpGem, spawnHeart } from './pickups.js';
import { takeDamage, lastDamageTime, setLastDamageTime } from './damage.js';
import { DAMAGE_COOLDOWN, HEART_DROP_CHANCE, HEART_HEAL } from '../config/constants.js';

let lastShot = 0;

export function resetLastShot() {
    lastShot = 0;
}

// Vertical aim lock-on helper
function getNearestEnemies(count, maxRange) {
    maxRange = maxRange || 35;
    const currentBoss = getCurrentBoss();
    const allTargets = [...enemies];
    if (currentBoss) allTargets.push(currentBoss);
    
    return allTargets
        .map(e => {
            const dx = e.position.x - player.position.x;
            const dz = e.position.z - player.position.z;
            return { enemy: e, dist: Math.sqrt(dx * dx + dz * dz) };
        })
        .filter(e => e.dist < maxRange)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, count)
        .map(e => e.enemy);
}

export function shootProjectile() {
    const now = Date.now();
    const fireRate = 500 / gameState.stats.attackSpeed;
    if (now - lastShot < fireRate) return;
    lastShot = now;
    
    const projectileCount = Math.floor(gameState.stats.projectileCount);
    const targets = getNearestEnemies(projectileCount);
    if (targets.length === 0) return;
    
    for (let i = 0; i < projectileCount; i++) {
        const target = targets[i % targets.length];
        const projectile = new THREE.Mesh(
            new THREE.SphereGeometry(0.15, 8, 8),
            new THREE.MeshBasicMaterial({
                color: 0x44ffff,
                transparent: true,
                opacity: 0.9
            })
        );
        
        projectile.position.copy(player.position);
        projectile.position.y += 0.5;
        
        // Vertical aim lock-on: target enemy center
        tempVec3.copy(target.position);
        const direction = tempVec3_2.subVectors(tempVec3, projectile.position).normalize();
        projectile.velocity = direction.clone().multiplyScalar(gameState.stats.projectileSpeed);
        projectile.damage = gameState.stats.damage;
        projectile.life = 120;
        
        scene.add(projectile);
        projectiles.push(projectile);
    }
}

export function updateProjectiles(delta) {
    // Player projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const proj = projectiles[i];
        proj.position.add(proj.velocity);
        proj.life--;
        let hit = false;
        
        // Check enemy hits
        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            const hitboxSize = enemy.baseSize * enemy.scale.x * 0.85;
            
            if (proj.position.distanceTo(enemy.position) < hitboxSize + 0.2) {
                enemy.health -= proj.damage * (1 - (enemy.damageReduction || 0));
                spawnParticle(proj.position, 0xff4444, 3);
                
                // Shrink on damage
                const healthPercent = Math.max(0, enemy.health / enemy.maxHealth);
                enemy.scale.setScalar(0.65 + 0.35 * healthPercent);
                
                // Hit flash
                enemy.material.emissive.setHex(0xffffff);
                enemy.material.emissiveIntensity = 1;
                setTimeout(() => {
                    if (enemy.material) {
                        enemy.material.emissive.setHex(enemy.baseColor);
                        enemy.material.emissiveIntensity = 0.3;
                    }
                }, 50);
                
                // Check death
                if (enemy.health <= 0) {
                    handleEnemyDeath(enemy);
                    
                    spawnXpGem(enemy.position, enemy.xpValue);
                    spawnParticle(enemy.position, enemy.baseColor, 10);
                    
                    // Heart drop
                    if (Math.random() < (enemy.isElite ? HEART_DROP_CHANCE.elite : HEART_DROP_CHANCE.normal)) {
                        spawnHeart(enemy.position.clone(), enemy.isElite ? HEART_HEAL.elite : HEART_HEAL.normal);
                    }
                    
                    enemy.geometry.dispose();
                    enemy.material.dispose();
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
            currentBoss.health -= proj.damage;
            spawnParticle(proj.position, 0xff4444, 3);
            
            currentBoss.scale.setScalar(0.75 + 0.25 * Math.max(0, currentBoss.health / currentBoss.maxHealth));
            
            if (currentBoss.bodyMaterial) {
                currentBoss.bodyMaterial.emissive.setHex(0xffffff);
                const bossRef = currentBoss;
                setTimeout(() => {
                    if (bossRef && bossRef.bodyMaterial) {
                        bossRef.bodyMaterial.emissive.setHex(bossRef.baseColor);
                    }
                }, 50);
            }
            
            if (currentBoss.health <= 0) {
                killBoss();
            }
            
            hit = true;
        }
        
        // Remove projectile
        if (hit || proj.life <= 0) {
            proj.geometry.dispose();
            proj.material.dispose();
            scene.remove(proj);
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
                takeDamage(proj.damage);
                setLastDamageTime(now);
            }
            proj.geometry.dispose();
            proj.material.dispose();
            scene.remove(proj);
            enemyProjectiles.splice(i, 1);
            continue;
        }
        
        // Remove expired
        if (proj.life <= 0) {
            proj.geometry.dispose();
            proj.material.dispose();
            scene.remove(proj);
            enemyProjectiles.splice(i, 1);
        }
    }
}
