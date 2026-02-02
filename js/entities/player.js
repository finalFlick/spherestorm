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

// Lean animation state
let currentLeanX = 0;  // forward/back lean (W/S)
let currentLeanZ = 0;  // left/right lean (A/D)

export function createPlayer() {
    player = new THREE.Group();
    
    // Body group for visual model - receives lean rotation in local space
    const bodyGroup = new THREE.Group();
    player.add(bodyGroup);
    player.bodyGroup = bodyGroup;
    
    const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x44aaff,
        emissive: 0x224488,
        emissiveIntensity: 0.3
    });
    
    // Manta ray body - wide flat ellipsoid
    const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.6, 16, 12),
        bodyMat
    );
    body.scale.set(1.5, 0.4, 1.2);  // Wide, flat, slightly elongated
    body.castShadow = true;
    bodyGroup.add(body);
    
    // Wing left
    const wingGeo = new THREE.ConeGeometry(0.8, 1.5, 4);
    const wingLeft = new THREE.Mesh(wingGeo, bodyMat);
    wingLeft.rotation.z = Math.PI / 2;
    wingLeft.rotation.y = -0.3;
    wingLeft.position.set(-0.8, 0, 0.1);
    wingLeft.castShadow = true;
    bodyGroup.add(wingLeft);
    
    // Wing right (mirrored)
    const wingRight = new THREE.Mesh(wingGeo, bodyMat);
    wingRight.rotation.z = -Math.PI / 2;
    wingRight.rotation.y = 0.3;
    wingRight.position.set(0.8, 0, 0.1);
    wingRight.castShadow = true;
    bodyGroup.add(wingRight);
    
    // Tail
    const tail = new THREE.Mesh(
        new THREE.ConeGeometry(0.15, 0.8, 8),
        bodyMat
    );
    tail.rotation.x = Math.PI / 2;
    tail.position.set(0, 0, 0.9);
    tail.castShadow = true;
    bodyGroup.add(tail);
    
    // Glow effect
    const glow = new THREE.Mesh(
        new THREE.SphereGeometry(1.2, 16, 16),
        new THREE.MeshBasicMaterial({
            color: 0x44aaff,
            transparent: true,
            opacity: 0.15
        })
    );
    glow.scale.set(1.5, 0.5, 1.2);  // Match body proportions
    bodyGroup.add(glow);
    
    // Attack direction indicator (180° arc on ground)
    // Separate from player group to avoid lean rotation affecting it
    const attackIndicator = new THREE.Group();
    scene.add(attackIndicator);  // Add to scene, not player
    player.attackIndicator = attackIndicator;
    
    const arcGeometry = new THREE.CircleGeometry(10, 32, 0, Math.PI);  // radius 10, 180°
    const arcMaterial = new THREE.MeshBasicMaterial({
        color: 0x44ffff,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
        depthWrite: false
    });
    const attackArc = new THREE.Mesh(arcGeometry, arcMaterial);
    attackArc.rotation.x = -Math.PI / 2;  // Lay flat on ground
    attackIndicator.add(attackArc);
    
    // Edge glow for clearer boundary
    const edgeGeometry = new THREE.RingGeometry(9.8, 10, 32, 1, 0, Math.PI);
    const edgeMaterial = new THREE.MeshBasicMaterial({
        color: 0x44ffff,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
        depthWrite: false
    });
    const attackEdge = new THREE.Mesh(edgeGeometry, edgeMaterial);
    attackEdge.rotation.x = -Math.PI / 2;
    attackEdge.position.y = 0.01;  // Slightly above arc
    attackIndicator.add(attackEdge);
    
    player.position.y = 1;
    scene.add(player);
    
    player.bodyMaterial = bodyMat;
    player.velocity = new THREE.Vector3();
    player.isGrounded = true;
    player.bounceCount = 0;
    player.wasInAir = false;
    player.squashTime = 0;
    
    // Hit recovery state (invulnerability frames)
    player.isRecovering = false;
    player.recoveryTimer = 0;
    player.flashPhase = 0;
    
    return player;
}

export function updatePlayer(delta) {
    // Lock movement during cutscenes to prevent drift into danger
    // EXCEPTION: Allow movement during interactive dodge tutorial (demo_dodge_wait state)
    const allowMovementDuringCutscene = gameState.interactiveDodgeTutorial === true;
    
    if (gameState.cutsceneActive && !allowMovementDuringCutscene) {
        // Heavy movement dampening - decay any existing velocity
        if (player.velocity) {
            player.velocity.multiplyScalar(0.1);
            player.position.add(player.velocity);
        }
        // Still update visual lean decay
        currentLeanX *= 0.9;
        currentLeanZ *= 0.9;
        if (player.bodyGroup) {
            player.bodyGroup.rotation.x = currentLeanX * 0.3;
            player.bodyGroup.rotation.z = currentLeanZ * 0.3;
        }
        return;  // Skip normal input processing
    }
    
    const moveDir = new THREE.Vector3();
    const forward = tempVec3.set(0, 0, -1).applyAxisAngle(tempVec3_2.set(0, 1, 0), cameraAngleX);
    const right = tempVec3_3.set(1, 0, 0).applyAxisAngle(tempVec3_2.set(0, 1, 0), cameraAngleX);
    
    if (keys['KeyW']) moveDir.add(forward.clone());
    if (keys['KeyS']) moveDir.sub(forward.clone());
    if (keys['KeyA']) moveDir.sub(right.clone().multiplyScalar(0.5));  // Reduced strafe - use mouse to turn
    if (keys['KeyD']) moveDir.add(right.clone().multiplyScalar(0.5));  // Reduced strafe - use mouse to turn
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
    
    // Apply horizontal knockback velocity (from damage)
    if (player.velocity.x !== 0 || player.velocity.z !== 0) {
        player.position.x += player.velocity.x;
        player.position.z += player.velocity.z;
        // Decay knockback velocity
        player.velocity.x *= 0.85;
        player.velocity.z *= 0.85;
        // Stop when very small
        if (Math.abs(player.velocity.x) < 0.01) player.velocity.x = 0;
        if (Math.abs(player.velocity.z) < 0.01) player.velocity.z = 0;
    }
    
    // Hit recovery (invulnerability frames) - flash animation
    if (player.isRecovering) {
        player.recoveryTimer--;
        player.flashPhase += 0.4;  // Speed of flash cycle
        
        // Cycle opacity between 0.3 and 1.0 using sine wave
        const flashOpacity = 0.65 + 0.35 * Math.sin(player.flashPhase);
        if (player.bodyMaterial) {
            if (!player.bodyMaterial.transparent) {
                player.bodyMaterial.transparent = true;
                player.bodyMaterial.needsUpdate = true;
            }
            player.bodyMaterial.opacity = flashOpacity;
        }
        
        // Recovery complete
        if (player.recoveryTimer <= 0) {
            player.isRecovering = false;
            player.recoveryTimer = 0;
            player.flashPhase = 0;
            if (player.bodyMaterial) {
                player.bodyMaterial.opacity = 1;
                player.bodyMaterial.transparent = false;
                player.bodyMaterial.needsUpdate = true;
            }
        }
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
    
    // Rotate player group to face camera forward direction (Y axis only)
    player.rotation.y = cameraAngleX;
    
    // Calculate lean targets based on movement keys
    let targetLeanX = 0;  // forward/back
    let targetLeanZ = 0;  // left/right
    if (keys['KeyW']) targetLeanX = 0.15;   // lean forward
    if (keys['KeyS']) targetLeanX = -0.15;  // lean back
    if (keys['KeyA']) targetLeanZ = 0.15;   // lean left
    if (keys['KeyD']) targetLeanZ = -0.15;  // lean right
    
    // Smooth interpolation for leaning - apply to body group (local space)
    currentLeanX += (targetLeanX - currentLeanX) * 0.15;
    currentLeanZ += (targetLeanZ - currentLeanZ) * 0.15;
    player.bodyGroup.rotation.x = currentLeanX;
    player.bodyGroup.rotation.z = currentLeanZ;
    
    // Position attack indicator manually (it's not a child of player, so unaffected by lean)
    if (player.attackIndicator) {
        // Position at player's feet, offset forward in the facing direction
        const offsetDist = 5;
        player.attackIndicator.position.set(
            player.position.x - Math.sin(cameraAngleX) * offsetDist,
            0.15,  // Above ground to avoid z-fighting
            player.position.z - Math.cos(cameraAngleX) * offsetDist
        );
        player.attackIndicator.rotation.y = cameraAngleX;
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
        player.rotation.set(0, 0, 0);
        if (player.bodyGroup) {
            player.bodyGroup.rotation.set(0, 0, 0);
        }
        player.isGrounded = true;
        player.bounceCount = 0;
        player.wasInAir = false;
        player.scale.set(1, 1, 1);
        player.squashTime = 0;
        
        // Reset hit recovery state
        player.isRecovering = false;
        player.recoveryTimer = 0;
        player.flashPhase = 0;
        if (player.bodyMaterial) {
            player.bodyMaterial.opacity = 1;
            player.bodyMaterial.transparent = false;
            player.bodyMaterial.needsUpdate = true;
        }
    }
    isDashing = false;
    lastDash = 0;
    currentLeanX = 0;
    currentLeanZ = 0;
}

export function getPlayer() {
    return player;
}
