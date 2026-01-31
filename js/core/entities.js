// Central entity arrays (shared across modules)
// All arrays are exported directly - modules push/splice to modify

export const enemies = [];
export const projectiles = [];
export const enemyProjectiles = [];
export const xpGems = [];
export const hearts = [];
export const particles = [];
export const obstacles = [];
export const hazardZones = [];
export const arenaWalls = [];

// Boss is wrapped in an object so it can be reassigned
const bossHolder = { current: null };

export function getCurrentBoss() {
    return bossHolder.current;
}

export function setCurrentBoss(boss) {
    bossHolder.current = boss;
}

// For backwards compatibility - returns the boss holder for direct access
export const currentBoss = bossHolder;

// Reusable vectors for performance
export const tempVec3 = new THREE.Vector3();
export const tempVec3_2 = new THREE.Vector3();
export const tempVec3_3 = new THREE.Vector3();

export function resetAllEntities(scene) {
    enemies.forEach(e => {
        if (e.geometry) e.geometry.dispose();
        if (e.material) e.material.dispose();
        scene.remove(e);
    });
    projectiles.forEach(p => {
        p.geometry.dispose();
        p.material.dispose();
        scene.remove(p);
    });
    enemyProjectiles.forEach(p => {
        p.geometry.dispose();
        p.material.dispose();
        scene.remove(p);
    });
    xpGems.forEach(g => {
        g.geometry.dispose();
        g.material.dispose();
        scene.remove(g);
    });
    particles.forEach(p => {
        p.geometry.dispose();
        p.material.dispose();
        scene.remove(p);
    });
    hearts.forEach(h => {
        h.children.forEach(c => {
            if (c.geometry) c.geometry.dispose();
            if (c.material) c.material.dispose();
        });
        scene.remove(h);
    });
    if (bossHolder.current) {
        bossHolder.current.traverse(c => {
            if (c.geometry) c.geometry.dispose();
            if (c.material) c.material.dispose();
        });
        scene.remove(bossHolder.current);
        bossHolder.current = null;
    }
    
    enemies.length = 0;
    projectiles.length = 0;
    enemyProjectiles.length = 0;
    xpGems.length = 0;
    particles.length = 0;
    hearts.length = 0;
}
