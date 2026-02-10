// Arena zone triggers: flow modifiers (plaza reset, alleys, district reward) for Arena 1 reef city.
// Zones are defined by bounds; updateArenaZones applies effects to player and enemies each frame.
// Also updates Arena 1 heading-stability (anti-backpedal) and dynamic events (geyser, current, predator).

import { arenaZones, arenaEvents, enemies } from '../core/entities.js';
import { gameState } from '../core/gameState.js';
import { scene } from '../core/scene.js';
import { TUNING } from '../config/tuning.js';
import { WAVE_STATE } from '../config/constants.js';

const HEADING_STABLE_DOT = 0.95;
const HEADING_STABLE_FRAMES_THRESHOLD = 600;  // ~10 seconds

function pointInRect(x, z, minX, maxX, minZ, maxZ) {
    return x >= minX && x <= maxX && z >= minZ && z <= maxZ;
}

function pointInCircle(x, z, cx, cz, r) {
    const dx = x - cx;
    const dz = z - cz;
    return dx * dx + dz * dz <= r * r;
}

export function isInZone(x, z, zone) {
    const b = zone.bounds;
    if (zone.shape === 'circle') return pointInCircle(x, z, b.cx, b.cz, b.r);
    return pointInRect(x, z, b.minX, b.maxX, b.minZ, b.maxZ);
}

export function getZoneAt(x, z) {
    for (let i = arenaZones.length - 1; i >= 0; i--) {
        if (isInZone(x, z, arenaZones[i])) return arenaZones[i];
    }
    return null;
}

export function initArenaZonesForArena(arenaNum) {
    arenaZones.length = 0;
    if (arenaNum !== 1) return;

    // Central plaza reset zone.
    arenaZones.push({
        type: 'plazaReset',
        shape: 'circle',
        bounds: { cx: 0, cz: 0, r: 12 },
        params: { enemySpeedMult: 0.6 }
    });

    // Alley compression zones: small side streets around the boulevards.
    const alleys = [
        { minX: -28, maxX: -18, minZ: -10, maxZ: -6 },
        { minX: 18, maxX: 28, minZ: -10, maxZ: -6 },
        { minX: -28, maxX: -18, minZ: 6, maxZ: 10 },
        { minX: 18, maxX: 28, minZ: 6, maxZ: 10 },
        { minX: -10, maxX: -6, minZ: -28, maxZ: -18 },
        { minX: 6, maxX: 10, minZ: -28, maxZ: -18 },
        { minX: -10, maxX: -6, minZ: 18, maxZ: 28 },
        { minX: 6, maxX: 10, minZ: 18, maxZ: 28 }
    ];
    alleys.forEach(bounds => {
        arenaZones.push({
            type: 'alleyCompression',
            shape: 'rect',
            bounds,
            params: { enemySpeedMult: 0.8 }
        });
    });

    // District reward pockets.
    const districts = [
        { minX: -38, maxX: -30, minZ: -38, maxZ: -30 },
        { minX: 30, maxX: 38, minZ: -38, maxZ: -30 },
        { minX: -38, maxX: -30, minZ: 30, maxZ: 38 },
        { minX: 30, maxX: 38, minZ: 30, maxZ: 38 }
    ];
    districts.forEach(bounds => {
        arenaZones.push({
            type: 'districtReward',
            shape: 'rect',
            bounds,
            params: {}
        });
    });

    // Outer reef drift ring.
    arenaZones.push({
        type: 'outerReef',
        shape: 'circle',
        bounds: { cx: 0, cz: 0, r: 105, rInner: 60 },
        params: { driftStrength: 0.003 }
    });
}

const _tangent = { x: 0, z: 0 };
const _toCenter = { x: 0, z: 0 };

export function updateArenaZones(player, delta) {
    if (!player) return;

    const px = player.position.x;
    const pz = player.position.z;
    const mult = (delta || 1) * (TUNING.arenaZoneStrength ?? 1);

    gameState.arenaZoneTreasureGap = false;

    // Arena 1: heading-stability (anti-backpedal) for spawn system
    if (gameState.currentArena === 1 && (player.velocity.x !== 0 || player.velocity.z !== 0)) {
        const speed = Math.sqrt(player.velocity.x * player.velocity.x + player.velocity.z * player.velocity.z);
        if (speed > 0.02) {
            const hx = player.velocity.x / speed;
            const hz = player.velocity.z / speed;
            const last = gameState.arena1LastHeading;
            if (last && last.x !== undefined) {
                const dot = hx * last.x + hz * last.z;
                if (dot >= HEADING_STABLE_DOT) {
                    gameState.arena1HeadingStableFrames = (gameState.arena1HeadingStableFrames || 0) + 1;
                } else {
                    gameState.arena1HeadingStableFrames = 0;
                }
            }
            gameState.arena1LastHeading = { x: hx, z: hz };
        } else {
            gameState.arena1HeadingStableFrames = Math.max(0, (gameState.arena1HeadingStableFrames || 0) - 1);
        }
    } else if (gameState.currentArena !== 1) {
        gameState.arena1HeadingStableFrames = 0;
        gameState.arena1LastHeading = null;
    }

    if (arenaZones.length === 0) return;

    for (const zone of arenaZones) {
        if (!isInZone(px, pz, zone)) continue;

        if (zone.type === 'districtReward') {
            gameState.arenaZoneTreasureGap = true;
        } else if (zone.type === 'outerReef') {
            const b = zone.bounds;
            _toCenter.x = px - b.cx;
            _toCenter.z = pz - b.cz;
            const distSq = _toCenter.x * _toCenter.x + _toCenter.z * _toCenter.z;
            const rInner = b.rInner != null ? b.rInner : 0;
            if (distSq >= rInner * rInner && distSq <= b.r * b.r) {
                const len = Math.sqrt(distSq) || 1;
                _toCenter.x /= len;
                _toCenter.z /= len;
                _tangent.x = -_toCenter.z;
                _tangent.z = _toCenter.x;
                const drift = (zone.params.driftStrength || 0.003) * mult;
                player.velocity.x += _tangent.x * drift;
                player.velocity.z += _tangent.z * drift;
            }
        }
    }

    for (const enemy of enemies) {
        if (!enemy.position || enemy.isDying) continue;
        const ex = enemy.position.x;
        const ez = enemy.position.z;
        let speedMult = 1;
        for (const zone of arenaZones) {
            if (!isInZone(ex, ez, zone)) continue;
            if (zone.type === 'alleyCompression' && zone.params.enemySpeedMult)
                speedMult *= zone.params.enemySpeedMult;
            else if (zone.type === 'plazaReset' && zone.params.enemySpeedMult)
                speedMult *= zone.params.enemySpeedMult;
        }
        enemy.arenaZoneSpeedMult = speedMult;
    }
}

// --- Arena 1 dynamic events (Wave 3+, no cutscene) ---

export function trySpawnArena1Event() {
    if (gameState.currentArena !== 1) return;
    if (gameState.currentWave < 3) return;
    if (gameState.cutsceneActive || gameState.announcementPaused) return;
    if (gameState.waveState !== WAVE_STATE.WAVE_ACTIVE) return;

    let cooldown = gameState.arena1EventCooldownFrames ?? 0;
    if (cooldown > 0) {
        gameState.arena1EventCooldownFrames = cooldown - 1;
        return;
    }
    const chance = TUNING.arena1EventChancePerFrame ?? 0.002;
    if (Math.random() > chance) return;

    const roll = Math.random();
    const bound = 200;
    if (roll < 0.4) {
        const x = (Math.random() - 0.5) * 80;
        const z = (Math.random() - 0.5) * 80;
        const r = 6 + Math.random() * 4;
        const duration = 120;
        const ringGeom = new THREE.RingGeometry(r - 0.5, r + 0.5, 24);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x44aaff,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(ringGeom, ringMat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(x, 0.02, z);
        scene.add(mesh);
        arenaEvents.push({
            type: 'geyser',
            x, z, r, duration,
            elapsed: 0,
            knockbackUp: 0.12,
            knockbackOut: 0.06,
            mesh
        });
    } else if (roll < 0.75) {
        const angle = Math.random() * Math.PI * 2;
        const len = 35;
        const halfW = 6;
        const cx = Math.cos(angle) * 50;
        const cz = Math.sin(angle) * 50;
        const dx = Math.cos(angle);
        const dz = Math.sin(angle);
        const perpX = -dz;
        const perpZ = dx;
        const minX = cx - dx * len - perpX * halfW;
        const maxX = cx + dx * len + perpX * halfW;
        const minZ = cz - dz * len - perpZ * halfW;
        const maxZ = cz + dz * len + perpZ * halfW;
        arenaEvents.push({
            type: 'skateCurrent',
            minX: Math.min(minX, maxX), maxX: Math.max(minX, maxX),
            minZ: Math.min(minZ, maxZ), maxZ: Math.max(minZ, maxZ),
            dirX: dx, dirZ: dz,
            strength: 0.04,
            duration: 300,
            elapsed: 0
        });
    } else {
        const side = Math.floor(Math.random() * 4);
        let x, z, dirX, dirZ;
        if (side === 0) { x = -bound; z = (Math.random() - 0.5) * 100; dirX = 1; dirZ = 0; }
        else if (side === 1) { x = bound; z = (Math.random() - 0.5) * 100; dirX = -1; dirZ = 0; }
        else if (side === 2) { z = -bound; x = (Math.random() - 0.5) * 100; dirX = 0; dirZ = 1; }
        else { z = bound; x = (Math.random() - 0.5) * 100; dirX = 0; dirZ = -1; }
        arenaEvents.push({
            type: 'predatorPass',
            x, z, dirX, dirZ,
            halfW: 4, halfL: 12,
            speed: 1.8,
            duration: 400,
            elapsed: 0
        });
    }
    const cMin = TUNING.arena1EventCooldownMinFrames ?? 480;
    const cMax = Math.max(cMin + 1, TUNING.arena1EventCooldownMaxFrames ?? 900);
    gameState.arena1EventCooldownFrames = cMin + Math.floor(Math.random() * (cMax - cMin));
}

export function updateArenaEvents(player, delta) {
    if (!player || gameState.currentArena !== 1) return;
    const d = (delta || 1);
    for (let i = arenaEvents.length - 1; i >= 0; i--) {
        const e = arenaEvents[i];
        e.elapsed += d;
        if (e.elapsed >= e.duration) {
            if (e.mesh) {
                scene.remove(e.mesh);
                if (e.mesh.geometry) e.mesh.geometry.dispose();
                if (e.mesh.material) e.mesh.material.dispose();
            }
            arenaEvents.splice(i, 1);
            continue;
        }
        if (e.type === 'geyser') {
            const px = player.position.x;
            const pz = player.position.z;
            if (pointInCircle(px, pz, e.x, e.z, e.r)) {
                const dx = px - e.x;
                const dz = pz - e.z;
                const len = Math.sqrt(dx * dx + dz * dz) || 1;
                const outX = dx / len;
                const outZ = dz / len;
                player.velocity.x += outX * e.knockbackOut * d;
                player.velocity.z += outZ * e.knockbackOut * d;
                player.velocity.y += e.knockbackUp * d;
            }
            for (const enemy of enemies) {
                if (!enemy.position || enemy.isDying) continue;
                const ex = enemy.position.x;
                const ez = enemy.position.z;
                if (!pointInCircle(ex, ez, e.x, e.z, e.r)) continue;
                const dx = ex - e.x;
                const dz = ez - e.z;
                const len = Math.sqrt(dx * dx + dz * dz) || 1;
                enemy.position.x += (dx / len) * e.knockbackOut * d * 0.8;
                enemy.position.z += (dz / len) * e.knockbackOut * d * 0.8;
                if (enemy.velocityY !== undefined) enemy.velocityY += e.knockbackUp * d * 0.5;
            }
            if (e.mesh && e.mesh.material.opacity !== undefined) {
                e.mesh.material.opacity = 0.3 + 0.4 * Math.sin(e.elapsed * 0.2);
            }
        } else if (e.type === 'skateCurrent') {
            const px = player.position.x;
            const pz = player.position.z;
            if (pointInRect(px, pz, e.minX, e.maxX, e.minZ, e.maxZ)) {
                player.velocity.x += e.dirX * e.strength * d;
                player.velocity.z += e.dirZ * e.strength * d;
            }
        } else if (e.type === 'predatorPass') {
            e.x += e.dirX * e.speed * d;
            e.z += e.dirZ * e.speed * d;
            const px = player.position.x;
            const pz = player.position.z;
            const inX = px >= e.x - e.halfL && px <= e.x + e.halfL && Math.abs(pz - e.z) <= e.halfW;
            const inZ = pz >= e.z - e.halfL && pz <= e.z + e.halfL && Math.abs(px - e.x) <= e.halfW;
            if (inX || inZ) {
                const push = 0.15 * d;
                player.velocity.x += e.dirX * push;
                player.velocity.z += e.dirZ * push;
            }
            for (const enemy of enemies) {
                if (!enemy.position || enemy.isDying) continue;
                const ex = enemy.position.x;
                const ez = enemy.position.z;
                const inEx = ex >= e.x - e.halfL && ex <= e.x + e.halfL && Math.abs(ez - e.z) <= e.halfW;
                const inEz = ez >= e.z - e.halfL && ez <= e.z + e.halfL && Math.abs(ex - e.x) <= e.halfW;
                if (inEx || inEz) {
                    const push = 0.12 * d;
                    enemy.position.x += e.dirX * push;
                    enemy.position.z += e.dirZ * push;
                }
            }
        }
    }
}
