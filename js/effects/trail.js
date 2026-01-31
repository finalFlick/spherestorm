import { scene } from '../core/scene.js';
import { TRAIL_MAX, TRAIL_LIFETIME } from '../config/constants.js';

let trailPool = [];
let trailIndex = 0;
export let lastTrailPos = null;

export function setLastTrailPos(pos) {
    lastTrailPos = pos;
}

export function initTrailPool() {
    const trailGeom = new THREE.BoxGeometry(0.5, 0.08, 0.5);
    const trailMat = new THREE.MeshBasicMaterial({
        color: 0x44ffff,
        transparent: true,
        opacity: 0
    });
    
    for (let i = 0; i < TRAIL_MAX; i++) {
        const segment = new THREE.Mesh(trailGeom.clone(), trailMat.clone());
        segment.visible = false;
        segment.life = 0;
        scene.add(segment);
        trailPool.push(segment);
    }
}

export function spawnTrail(position) {
    const segment = trailPool[trailIndex];
    segment.position.set(position.x, 0.05, position.z);
    segment.life = TRAIL_LIFETIME;
    segment.visible = true;
    segment.material.opacity = 0.85;
    segment.scale.set(1, 1, 1);
    trailIndex = (trailIndex + 1) % TRAIL_MAX;
}

export function updateTrail() {
    for (const segment of trailPool) {
        if (segment.life > 0) {
            segment.life--;
            const t = segment.life / TRAIL_LIFETIME;
            segment.material.opacity = t * 0.85;
            segment.material.color.setRGB(0x44 / 255 * t, 0xff / 255 * t, 1);
            segment.scale.set(0.6 + t * 0.4, 0.5 + t * 0.5, 0.6 + t * 0.4);
            if (segment.life <= 0) segment.visible = false;
        }
    }
}

export function resetTrail() {
    trailPool.forEach(t => {
        t.visible = false;
        t.life = 0;
    });
    trailIndex = 0;
    lastTrailPos = null;
}

export function getTrailPool() {
    return trailPool;
}
