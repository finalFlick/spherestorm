import { scene, camera } from '../core/scene.js';
import { gameState } from '../core/gameState.js';
import { keys, cameraAngleX, cameraAngleY } from '../core/input.js';
import { obstacles, hazardZones, tempVec3, tempVec3_2, tempVec3_3 } from '../core/entities.js';
import { PLAYER_JUMP_VELOCITY, PLAYER_GRAVITY, BOUNCE_FACTORS, TRAIL_SPAWN_DISTANCE } from '../config/constants.js';
import { spawnParticle } from '../effects/particles.js';
import { spawnTrail, lastTrailPos, setLastTrailPos } from '../effects/trail.js';
import { takeDamage } from '../systems/damage.js';

export let player = null;
export let isDashing = false;
export let lastDash = 0;
const dashDirection = new THREE.Vector3();

export function createPlayer() {
    player = new THREE.Group();
    
    const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x44aaff,
        emissive: 0x224488,
        emissiveIntensity: 0.3
    });
    
    const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.4, 0.8, 16),
        bodyMat
    );
    body.castShadow = true;
    player.add(body);
    
    const top = new THREE.Mesh(
        new THREE.SphereGeometry(0.4, 16, 8),
        bodyMat
    );
    top.position.y = 0.4;
    top.castShadow = true;
    player.add(top);
    
    const bottom = new THREE.Mesh(
        new THREE.SphereGeometry(0.4, 16, 8),
        bodyMat
    );
    bottom.position.y = -0.4;
    bottom.castShadow = true;
    player.add(bottom);
    
    const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.8, 16, 16),
        new THREE.MeshBasicMaterial({
            color: 0x44aaff,
            transparent: true,
            opacity: 0.2
        })
    );
    player.add(glow);
    
    player.position.y = 1;
    scene.add(player);
    
    player.bodyMaterial = bodyMat;
    player.velocity = new THREE.Vector3();
    player.isGrounded = true;
    player.bounceCount = 0;
    player.wasInAir = false;
    player.squashTime = 0;
    
    return player;
}

export function updatePlayer(delta) {
    const moveDir = new THREE.Vector3();
    const forward = tempVec3.set(0, 0, -1).applyAxisAngle(tempVec3_2.set(0, 1, 0), cameraAngleX);
    const right = tempVec3_3.set(1, 0, 0).applyAxisAngle(tempVec3_2.set(0, 1, 0), cameraAngleX);
    
    if (keys['KeyW']) moveDir.add(forward.clone());
    if (keys['KeyS']) moveDir.sub(forward.clone());
    if (keys['KeyA']) moveDir.sub(right.clone());
    if (keys['KeyD']) moveDir.add(right.clone());
    moveDir.normalize();
    
    const now = Date.now();
    if ((keys['ShiftLeft'] || keys['ShiftRight']) && now - lastDash > 1000 && moveDir.length() > 0) {
        isDashing = true;
        lastDash = now;
        dashDirection.copy(moveDir);
    }
    
    const oldX = player.position.x;
    const oldZ = player.position.z;
    const oldY = player.position.y;
    
    if (isDashing) {
        if (now - lastDash < 200) {
            player.position.add(dashDirection.clone().multiplyScalar(0.5));
        } else {
            isDashing = false;
        }
    } else if (moveDir.length() > 0) {
        player.position.add(moveDir.multiplyScalar(gameState.stats.moveSpeed));
    }
    
    // Platform collision
    const playerRadius = 0.5;
    for (const obs of obstacles) {
        const c = obs.collisionData;
        if (player.position.y < c.topY + 0.1) {
            // X-axis collision
            if (player.position.x + playerRadius > c.minX && 
                player.position.x - playerRadius < c.maxX && 
                oldZ + playerRadius > c.minZ && 
                oldZ - playerRadius < c.maxZ && 
                player.position.y < c.topY) {
                if (oldX <= c.minX) player.position.x = c.minX - playerRadius;
                else if (oldX >= c.maxX) player.position.x = c.maxX + playerRadius;
            }
            // Z-axis collision
            if (player.position.x + playerRadius > c.minX && 
                player.position.x - playerRadius < c.maxX && 
                player.position.z + playerRadius > c.minZ && 
                player.position.z - playerRadius < c.maxZ && 
                player.position.y < c.topY) {
                if (oldZ <= c.minZ) player.position.z = c.minZ - playerRadius;
                else if (oldZ >= c.maxZ) player.position.z = c.maxZ + playerRadius;
            }
        }
    }
    
    // Jumping with bounce feedback
    if (keys['Space'] && player.isGrounded) {
        player.velocity.y = PLAYER_JUMP_VELOCITY;
        player.isGrounded = false;
        player.wasInAir = true;
        player.bounceCount = 0;
        player.squashTime = 8;
    }
    
    player.velocity.y -= PLAYER_GRAVITY;
    player.position.y += player.velocity.y;
    
    // Ground/Platform landing
    let groundY = 1;
    for (const obs of obstacles) {
        const c = obs.collisionData;
        if (player.position.x + playerRadius > c.minX && 
            player.position.x - playerRadius < c.maxX && 
            player.position.z + playerRadius > c.minZ && 
            player.position.z - playerRadius < c.maxZ) {
            if (oldY >= c.topY + 0.9 && player.position.y < c.topY + 1.1) {
                groundY = Math.max(groundY, c.topY + 1);
            } else if (player.position.y >= c.topY + 0.8 && 
                       player.position.y < c.topY + 1.3 && 
                       player.velocity.y <= 0) {
                groundY = Math.max(groundY, c.topY + 1);
            }
        }
    }
    
    if (player.position.y < groundY) {
        player.position.y = groundY;
        if (player.wasInAir) {
            if (player.bounceCount < BOUNCE_FACTORS.length) {
                player.velocity.y = PLAYER_JUMP_VELOCITY * BOUNCE_FACTORS[player.bounceCount];
                player.bounceCount++;
                player.squashTime = 6 - player.bounceCount * 2;
                if (player.bounceCount === 1) spawnParticle(player.position, 0x44aaff, 5);
            } else {
                player.velocity.y = 0;
                player.isGrounded = true;
                player.wasInAir = false;
                player.bounceCount = 0;
            }
        } else {
            player.velocity.y = 0;
            player.isGrounded = true;
        }
    } else {
        player.isGrounded = false;
    }
    
    // Squash/stretch animation
    if (player.squashTime > 0) {
        player.squashTime--;
        player.scale.set(
            1 + player.squashTime * 0.02,
            1 - player.squashTime * 0.03,
            1 + player.squashTime * 0.02
        );
    } else {
        player.scale.set(1, 1, 1);
    }
    
    // Arena bounds
    player.position.x = Math.max(-45, Math.min(45, player.position.x));
    player.position.z = Math.max(-45, Math.min(45, player.position.z));
    
    // Enhanced trail
    const isMoving = moveDir.length() > 0 || isDashing;
    const currentLastTrailPos = lastTrailPos;
    if (isMoving && player.isGrounded && 
        (!currentLastTrailPos || player.position.distanceTo(currentLastTrailPos) > TRAIL_SPAWN_DISTANCE)) {
        spawnTrail(player.position.clone());
        setLastTrailPos(player.position.clone());
    }
    
    // Hazard damage - frame-based for consistent behavior with slow-mo/lag
    for (const hz of hazardZones) {
        const dx = player.position.x - hz.position.x;
        const dz = player.position.z - hz.position.z;
        if (Math.sqrt(dx * dx + dz * dz) < hz.radius && player.position.y < 1.5) {
            // Increment frame counter while in hazard
            hz.tickTimer++;
            
            // Apply damage every N frames to prevent micro-ticks
            if (hz.tickTimer >= hz.damageTickInterval) {
                takeDamage(hz.damagePerTick, 'Hazard Zone', 'hazard');
                hz.tickTimer = 0;
            }
        } else {
            // Reset timer when player exits hazard
            hz.tickTimer = 0;
        }
    }
    
    // Camera follow
    camera.position.x = player.position.x + Math.sin(cameraAngleX) * 8;
    camera.position.z = player.position.z + Math.cos(cameraAngleX) * 8;
    camera.position.y = player.position.y + 4 + Math.sin(cameraAngleY) * 3;
    camera.lookAt(player.position.x, player.position.y + 1, player.position.z);
}

export function resetPlayer() {
    if (player) {
        player.position.set(0, 1, 0);
        player.velocity.set(0, 0, 0);
        player.isGrounded = true;
        player.bounceCount = 0;
        player.wasInAir = false;
        player.scale.set(1, 1, 1);
        player.squashTime = 0;
    }
    isDashing = false;
    lastDash = 0;
}

export function getPlayer() {
    return player;
}
