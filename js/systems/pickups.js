import { scene } from '../core/scene.js';
import { gameState } from '../core/gameState.js';
import { xpGems, hearts, tempVec3, obstacles } from '../core/entities.js';
import { player } from '../entities/player.js';
import { HEART_TTL, XP_GEM_TTL } from '../config/constants.js';
import { spawnParticle } from '../effects/particles.js';
import { levelUp } from '../ui/menus.js';

// Get the surface height at a given X/Z position (checks platforms/obstacles)
function getSurfaceHeight(x, z) {
    let maxHeight = 0;  // Floor level
    for (const obs of obstacles) {
        const cd = obs.collisionData;
        if (cd && x >= cd.minX && x <= cd.maxX && z >= cd.minZ && z <= cd.maxZ) {
            maxHeight = Math.max(maxHeight, cd.topY);
        }
    }
    return maxHeight;
}

export function spawnXpGem(position, value) {
    const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.2, 0),
        new THREE.MeshBasicMaterial({
            color: 0x44ff44,
            transparent: true,
            opacity: 0.9
        })
    );
    
    gem.position.copy(position);
    // Hover above the surface at spawn position
    const surfaceHeight = getSurfaceHeight(position.x, position.z);
    gem.baseY = surfaceHeight + 0.5;
    gem.position.y = gem.baseY;
    gem.value = value * gameState.stats.xpMultiplier;
    gem.bobOffset = Math.random() * Math.PI * 2;
    gem.ttl = XP_GEM_TTL;  // 15 seconds at 60fps
    
    scene.add(gem);
    xpGems.push(gem);
}

export function spawnHeart(position, healAmount) {
    const heartGroup = new THREE.Group();
    const heartMat = new THREE.MeshBasicMaterial({
        color: 0xff4488,
        transparent: true,
        opacity: 0.9
    });
    
    const sphereGeo = new THREE.SphereGeometry(0.15, 8, 8);
    const left = new THREE.Mesh(sphereGeo, heartMat);
    left.position.set(-0.1, 0.1, 0);
    heartGroup.add(left);
    
    const right = new THREE.Mesh(sphereGeo, heartMat.clone());
    right.position.set(0.1, 0.1, 0);
    heartGroup.add(right);
    
    const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.2, 0.3, 8),
        heartMat.clone()
    );
    cone.position.y = -0.1;
    cone.rotation.x = Math.PI;
    heartGroup.add(cone);
    
    heartGroup.position.copy(position);
    // Hover above the surface at spawn position
    const surfaceHeight = getSurfaceHeight(position.x, position.z);
    heartGroup.baseY = surfaceHeight + 0.5;
    heartGroup.position.y = heartGroup.baseY;
    heartGroup.healAmount = healAmount;
    heartGroup.bobOffset = Math.random() * Math.PI * 2;
    heartGroup.ttl = HEART_TTL;
    
    scene.add(heartGroup);
    hearts.push(heartGroup);
}

export function updateXpGems(delta) {
    const time = Date.now() * 0.003;
    
    for (let i = xpGems.length - 1; i >= 0; i--) {
        const gem = xpGems[i];
        // Bob relative to base height (defaults to 0.5 for backwards compatibility)
        const baseY = gem.baseY !== undefined ? gem.baseY : 0.5;
        gem.position.y = baseY + Math.sin(time + gem.bobOffset) * 0.2;
        gem.rotation.y += 0.05;
        
        // Decrement TTL
        gem.ttl--;
        
        // Fade out over last 3 seconds (180 frames)
        if (gem.ttl < 180) {
            gem.material.opacity = (gem.ttl / 180) * 0.9;
        }
        
        // Remove expired gems
        if (gem.ttl <= 0) {
            gem.geometry.dispose();
            gem.material.dispose();
            scene.remove(gem);
            xpGems.splice(i, 1);
            continue;
        }
        
        const dist = gem.position.distanceTo(player.position);
        
        // Attract to player
        if (dist < gameState.stats.pickupRange) {
            tempVec3.subVectors(player.position, gem.position).normalize();
            gem.position.add(tempVec3.multiplyScalar(0.3));
        }
        
        // Collect
        if (dist < 1) {
            gameState.xp += gem.value;
            spawnParticle(gem.position, 0x44ff44, 5);
            
            gem.geometry.dispose();
            gem.material.dispose();
            scene.remove(gem);
            xpGems.splice(i, 1);
            
            // Check level up
            while (gameState.xp >= gameState.xpToLevel) {
                gameState.xp -= gameState.xpToLevel;
                gameState.pendingLevelUps++;
                gameState.xpToLevel = Math.floor(gameState.xpToLevel * 1.5);
            }
            
            if (gameState.pendingLevelUps > 0 && !gameState.paused) {
                levelUp();
            }
        }
    }
}

export function updateHearts(delta) {
    const time = Date.now() * 0.004;
    
    for (let i = hearts.length - 1; i >= 0; i--) {
        const heart = hearts[i];
        // Bob relative to base height (defaults to 0.5 for backwards compatibility)
        const baseY = heart.baseY !== undefined ? heart.baseY : 0.5;
        heart.position.y = baseY + Math.sin(time + heart.bobOffset) * 0.2;
        heart.rotation.y += 0.03;
        heart.ttl--;
        
        // Fade out near expiry
        if (heart.ttl < 60) {
            heart.children.forEach(c => {
                if (c.material) c.material.opacity = (heart.ttl / 60) * 0.9;
            });
        }
        
        // Remove expired
        if (heart.ttl <= 0) {
            heart.children.forEach(c => {
                if (c.geometry) c.geometry.dispose();
                if (c.material) c.material.dispose();
            });
            scene.remove(heart);
            hearts.splice(i, 1);
            continue;
        }
        
        const dist = heart.position.distanceTo(player.position);
        
        // Attract to player
        if (dist < gameState.stats.pickupRange) {
            tempVec3.subVectors(player.position, heart.position).normalize();
            heart.position.add(tempVec3.multiplyScalar(0.25));
        }
        
        // Collect
        if (dist < 1) {
            gameState.health = Math.min(gameState.health + heart.healAmount, gameState.maxHealth);
            spawnParticle(heart.position, 0xff4488, 8);
            
            heart.children.forEach(c => {
                if (c.geometry) c.geometry.dispose();
                if (c.material) c.material.dispose();
            });
            scene.remove(heart);
            hearts.splice(i, 1);
        }
    }
}
