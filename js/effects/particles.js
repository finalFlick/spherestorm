import { scene } from '../core/scene.js';

// Object pool for particles - reuse instead of creating/destroying
const PARTICLE_POOL_SIZE = 300;  // Increased for VFX variety
let particlePool = [];
let poolIndex = 0;
let poolInitialized = false;

// Shared geometry for all particles (huge performance gain)
let sharedGeometry = null;

export function initParticlePool() {
    if (poolInitialized) return;
    
    sharedGeometry = new THREE.SphereGeometry(0.1, 4, 4);
    
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
        const particle = new THREE.Mesh(
            sharedGeometry,
            new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0
            })
        );
        particle.visible = false;
        particle.life = 0;
        particle.maxLife = 30;
        particle.velocity = new THREE.Vector3();
        particle.vfxType = 'burst';  // Default type
        particle.scale.setScalar(1);
        scene.add(particle);
        particlePool.push(particle);
    }
    
    poolInitialized = true;
}

export function spawnParticle(position, color, count) {
    // Ensure pool is initialized
    if (!poolInitialized) initParticlePool();
    
    count = count || 5;
    
    for (let i = 0; i < count; i++) {
        const particle = particlePool[poolIndex];
        poolIndex = (poolIndex + 1) % PARTICLE_POOL_SIZE;
        
        // Reset particle state
        particle.position.copy(position);
        particle.velocity.set(
            (Math.random() - 0.5) * 0.3,
            Math.random() * 0.3,
            (Math.random() - 0.5) * 0.3
        );
        particle.life = 30;
        particle.maxLife = 30;
        particle.material.color.setHex(color);
        particle.material.opacity = 1;
        particle.visible = true;
        particle.vfxType = 'burst';
        particle.scale.setScalar(1);
    }
}

// Spawn enemy-specific death VFX based on deathVfx config
export function spawnEnemyDeathVfx(position, vfxConfig) {
    if (!poolInitialized) initParticlePool();
    
    const { color, count, type } = vfxConfig;
    
    switch (type) {
        case 'burst':
            spawnBurstVfx(position, color, count);
            break;
        case 'sparkRing':
            spawnSparkRingVfx(position, color, count);
            break;
        case 'shatter':
            spawnShatterVfx(position, color, count);
            break;
        case 'streak':
            spawnStreakVfx(position, color, count);
            break;
        case 'crackSplit':
            spawnCrackSplitVfx(position, color, count);
            break;
        case 'shockCone':
            spawnShockConeVfx(position, color, count);
            break;
        case 'splash':
            spawnSplashVfx(position, color, count);
            break;
        case 'glitch':
            spawnGlitchVfx(position, color, count);
            break;
        default:
            spawnBurstVfx(position, color, count);
    }
}

// Standard burst (grunt, default)
function spawnBurstVfx(position, color, count) {
    for (let i = 0; i < count; i++) {
        const p = getNextParticle();
        p.position.copy(position);
        p.velocity.set(
            (Math.random() - 0.5) * 0.4,
            Math.random() * 0.35,
            (Math.random() - 0.5) * 0.4
        );
        p.life = 25;
        p.maxLife = 25;
        p.material.color.setHex(color);
        p.material.opacity = 1;
        p.visible = true;
        p.vfxType = 'burst';
        p.scale.setScalar(0.8 + Math.random() * 0.4);
    }
}

// Spark ring (shooter) - particles expand outward in a ring
function spawnSparkRingVfx(position, color, count) {
    for (let i = 0; i < count; i++) {
        const p = getNextParticle();
        const angle = (i / count) * Math.PI * 2;
        p.position.copy(position);
        p.velocity.set(
            Math.cos(angle) * 0.3,
            0.1 + Math.random() * 0.1,
            Math.sin(angle) * 0.3
        );
        p.life = 20;
        p.maxLife = 20;
        p.material.color.setHex(color);
        p.material.opacity = 1;
        p.visible = true;
        p.vfxType = 'sparkRing';
        p.scale.setScalar(0.6);
    }
}

// Shatter (shielded) - angular shards flying outward
function spawnShatterVfx(position, color, count) {
    for (let i = 0; i < count; i++) {
        const p = getNextParticle();
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
        const upAngle = Math.random() * 0.5;
        p.position.copy(position);
        p.velocity.set(
            Math.cos(angle) * 0.35,
            0.2 + upAngle * 0.3,
            Math.sin(angle) * 0.35
        );
        p.life = 35;
        p.maxLife = 35;
        p.material.color.setHex(color);
        p.material.opacity = 1;
        p.visible = true;
        p.vfxType = 'shatter';
        p.scale.set(0.5 + Math.random() * 0.5, 1.2, 0.3);  // Shard shape
    }
}

// Streak (fastBouncer) - trailing particles in movement direction
function spawnStreakVfx(position, color, count) {
    for (let i = 0; i < count; i++) {
        const p = getNextParticle();
        p.position.copy(position);
        p.position.x += (Math.random() - 0.5) * 0.5;
        p.position.z += (Math.random() - 0.5) * 0.5;
        p.velocity.set(
            (Math.random() - 0.5) * 0.5,
            0.05,
            (Math.random() - 0.5) * 0.5
        );
        p.life = 15 + i * 2;  // Staggered fade
        p.maxLife = p.life;
        p.material.color.setHex(color);
        p.material.opacity = 0.8;
        p.visible = true;
        p.vfxType = 'streak';
        p.scale.setScalar(0.4);
    }
}

// Crack split (splitter) - flash then spawn puffs
function spawnCrackSplitVfx(position, color, count) {
    // Central flash
    for (let i = 0; i < 5; i++) {
        const p = getNextParticle();
        p.position.copy(position);
        p.velocity.set(0, 0.1, 0);
        p.life = 8;
        p.maxLife = 8;
        p.material.color.setHex(0xffffff);  // White flash
        p.material.opacity = 1;
        p.visible = true;
        p.vfxType = 'flash';
        p.scale.setScalar(2 + Math.random());
    }
    // Split puffs
    for (let i = 0; i < count - 5; i++) {
        const p = getNextParticle();
        const angle = (i / (count - 5)) * Math.PI * 2;
        p.position.copy(position);
        p.position.x += Math.cos(angle) * 0.5;
        p.position.z += Math.sin(angle) * 0.5;
        p.velocity.set(
            Math.cos(angle) * 0.15,
            0.2,
            Math.sin(angle) * 0.15
        );
        p.life = 30;
        p.maxLife = 30;
        p.material.color.setHex(color);
        p.material.opacity = 1;
        p.visible = true;
        p.vfxType = 'puff';
        p.scale.setScalar(0.7);
    }
}

// Shock cone (shieldBreaker) - directional cone of particles
function spawnShockConeVfx(position, color, count) {
    for (let i = 0; i < count; i++) {
        const p = getNextParticle();
        const spread = (Math.random() - 0.5) * 0.8;
        p.position.copy(position);
        p.velocity.set(
            spread * 0.3,
            0.15 + Math.random() * 0.2,
            0.3 + Math.random() * 0.2  // Forward bias
        );
        p.life = 22;
        p.maxLife = 22;
        p.material.color.setHex(color);
        p.material.opacity = 1;
        p.visible = true;
        p.vfxType = 'shockCone';
        p.scale.setScalar(0.6 + Math.random() * 0.4);
    }
}

// Splash (waterBalloon) - upward splash then mist settling
function spawnSplashVfx(position, color, count) {
    // Upward splash
    for (let i = 0; i < count * 0.6; i++) {
        const p = getNextParticle();
        const angle = Math.random() * Math.PI * 2;
        p.position.copy(position);
        p.velocity.set(
            Math.cos(angle) * 0.2,
            0.3 + Math.random() * 0.3,  // High upward
            Math.sin(angle) * 0.2
        );
        p.life = 35;
        p.maxLife = 35;
        p.material.color.setHex(color);
        p.material.opacity = 0.8;
        p.visible = true;
        p.vfxType = 'splash';
        p.scale.setScalar(0.5);
    }
    // Settling mist
    for (let i = 0; i < count * 0.4; i++) {
        const p = getNextParticle();
        const angle = Math.random() * Math.PI * 2;
        const dist = 1 + Math.random() * 2;
        p.position.copy(position);
        p.position.x += Math.cos(angle) * dist;
        p.position.z += Math.sin(angle) * dist;
        p.position.y += 0.2;
        p.velocity.set(0, -0.02, 0);  // Slow settle
        p.life = 50;
        p.maxLife = 50;
        p.material.color.setHex(color);
        p.material.opacity = 0.4;
        p.visible = true;
        p.vfxType = 'mist';
        p.scale.setScalar(1.5);
    }
}

// Glitch (teleporter) - flickering square-ish particles
function spawnGlitchVfx(position, color, count) {
    for (let i = 0; i < count; i++) {
        const p = getNextParticle();
        p.position.copy(position);
        p.position.x += (Math.random() - 0.5) * 1.5;
        p.position.y += Math.random() * 1;
        p.position.z += (Math.random() - 0.5) * 1.5;
        p.velocity.set(
            (Math.random() - 0.5) * 0.1,
            (Math.random() - 0.5) * 0.1,
            (Math.random() - 0.5) * 0.1
        );
        p.life = 20 + Math.random() * 15;
        p.maxLife = p.life;
        p.material.color.setHex(color);
        p.material.opacity = 0.9;
        p.visible = true;
        p.vfxType = 'glitch';
        // Square-ish scale
        p.scale.set(0.8 + Math.random() * 0.4, 0.1, 0.8 + Math.random() * 0.4);
    }
}

function getNextParticle() {
    const particle = particlePool[poolIndex];
    poolIndex = (poolIndex + 1) % PARTICLE_POOL_SIZE;
    return particle;
}

export function updateParticles(delta) {
    for (let i = 0; i < particlePool.length; i++) {
        const p = particlePool[i];
        if (p.life > 0) {
            p.position.add(p.velocity);
            p.life--;
            
            // VFX-specific behaviors
            switch (p.vfxType) {
                case 'burst':
                case 'shockCone':
                    p.velocity.y -= 0.01;
                    p.material.opacity = p.life / p.maxLife;
                    break;
                    
                case 'sparkRing':
                    p.velocity.y -= 0.005;
                    p.material.opacity = p.life / p.maxLife;
                    p.scale.multiplyScalar(0.97);  // Shrink
                    break;
                    
                case 'shatter':
                    p.velocity.y -= 0.015;  // Heavier gravity
                    p.material.opacity = p.life / p.maxLife;
                    p.rotation.x += 0.2;
                    p.rotation.z += 0.15;
                    break;
                    
                case 'streak':
                    p.velocity.multiplyScalar(0.95);  // Drag
                    p.material.opacity = (p.life / p.maxLife) * 0.8;
                    break;
                    
                case 'flash':
                    p.material.opacity = p.life / p.maxLife;
                    p.scale.multiplyScalar(1.15);  // Expand quickly
                    break;
                    
                case 'puff':
                    p.velocity.y -= 0.003;  // Light gravity
                    p.material.opacity = p.life / p.maxLife;
                    p.scale.multiplyScalar(1.02);  // Slow expand
                    break;
                    
                case 'splash':
                    p.velocity.y -= 0.018;  // Water gravity
                    p.material.opacity = (p.life / p.maxLife) * 0.8;
                    break;
                    
                case 'mist':
                    p.material.opacity = (p.life / p.maxLife) * 0.4;
                    p.scale.multiplyScalar(1.01);  // Slow expand
                    break;
                    
                case 'glitch':
                    // Flicker effect
                    p.visible = Math.random() > 0.2;
                    p.material.opacity = p.life / p.maxLife;
                    // Random position jitter
                    if (Math.random() < 0.1) {
                        p.position.x += (Math.random() - 0.5) * 0.3;
                        p.position.z += (Math.random() - 0.5) * 0.3;
                    }
                    break;
                    
                default:
                    p.velocity.y -= 0.01;
                    p.material.opacity = p.life / p.maxLife;
            }
            
            if (p.life <= 0) {
                p.visible = false;
                p.scale.setScalar(1);  // Reset scale
            }
        }
    }
}

export function resetParticles() {
    for (const p of particlePool) {
        p.visible = false;
        p.life = 0;
    }
    poolIndex = 0;
}
