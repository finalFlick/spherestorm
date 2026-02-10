// Data-driven arena layouts. When a layout exists for an arena, generator builds from objects + prefabs instead of hard-coded code.
// Format: { playerSpawn?, objects[], prefabs?, enemySpawners? }

/**
 * Get layout for an arena number. Return null/undefined to use legacy feature-based generation.
 * @param {number} arenaNumber
 * @returns {Object|undefined} layout or undefined
 */
export function getArenaLayout(arenaNumber) {
    const arenaNum = Math.min(arenaNumber, 6);
    if (arenaNum === 1) return ARENA_1_LAYOUT;
    return undefined;
}

// Arena 1: The Training Grounds — underwater reef city street grid.
// Layout drives collision geometry (city blocks + alleys), plaza/district landmarks, and prefabs.
// Generator still adds Arena 1 city-themed decals + decorative landmarks and Pufferkeep Castle.
export const ARENA_1_LAYOUT = {
    playerSpawn: { x: 0, z: 0 },
    objects: [
        // ---------------- Reef city blocks (collision) ----------------
        // Keep boulevards clear: x in [-7, 7] and z in [-7, 7]
        // Keep central plaza clear: r ~= 12
        // NW district: Kelp Market
        { type: 'obstacle', x: -29, z: -31, sizeX: 8, height: 3.2, sizeZ: 10, materialKey: 'wall' },
        { type: 'obstacle', x: -17, z: -31, sizeX: 7, height: 2.9, sizeZ: 9, materialKey: 'wall' },
        { type: 'obstacle', x: -31, z: -17, sizeX: 10, height: 3.0, sizeZ: 7, materialKey: 'wall' },
        { type: 'obstacle', x: -18, z: -18, sizeX: 8, height: 2.7, sizeZ: 8, materialKey: 'wall' },
        // NE district: Coral Towers
        { type: 'obstacle', x: 17, z: -31, sizeX: 7, height: 2.9, sizeZ: 9, materialKey: 'wall' },
        { type: 'obstacle', x: 29, z: -31, sizeX: 8, height: 3.3, sizeZ: 10, materialKey: 'wall' },
        { type: 'obstacle', x: 18, z: -18, sizeX: 8, height: 2.8, sizeZ: 8, materialKey: 'wall' },
        { type: 'obstacle', x: 31, z: -17, sizeX: 10, height: 3.0, sizeZ: 7, materialKey: 'wall' },
        // SW district: Shell Archive
        { type: 'obstacle', x: -31, z: 17, sizeX: 10, height: 3.0, sizeZ: 7, materialKey: 'wall' },
        { type: 'obstacle', x: -18, z: 18, sizeX: 8, height: 2.8, sizeZ: 8, materialKey: 'wall' },
        { type: 'obstacle', x: -29, z: 31, sizeX: 8, height: 3.2, sizeZ: 10, materialKey: 'wall' },
        { type: 'obstacle', x: -16, z: 31, sizeX: 7, height: 2.8, sizeZ: 9, materialKey: 'wall' },
        // SE district: Anemone Gardens
        { type: 'obstacle', x: 18, z: 18, sizeX: 8, height: 2.8, sizeZ: 8, materialKey: 'wall' },
        { type: 'obstacle', x: 31, z: 17, sizeX: 10, height: 3.1, sizeZ: 7, materialKey: 'wall' },
        { type: 'obstacle', x: 16, z: 31, sizeX: 7, height: 2.9, sizeZ: 9, materialKey: 'wall' },
        { type: 'obstacle', x: 29, z: 31, sizeX: 8, height: 3.3, sizeZ: 10, materialKey: 'wall' },

        // ---------------- Landmarks + readable routing decals ----------------
        { type: 'landmark', typeId: 'resetPad', x: 0, z: 0, radius: 12 },
        // Boulevard edge guides (x ~= +/-7, z ~= +/-7)
        { type: 'landmark', typeId: 'decal', x: -7, z: 0, radius: 2.4, color: 0x2a5a6a, opacity: 0.14 },
        { type: 'landmark', typeId: 'decal', x: 7, z: 0, radius: 2.4, color: 0x2a5a6a, opacity: 0.14 },
        { type: 'landmark', typeId: 'decal', x: 0, z: -7, radius: 2.4, color: 0x2a5a6a, opacity: 0.14 },
        { type: 'landmark', typeId: 'decal', x: 0, z: 7, radius: 2.4, color: 0x2a5a6a, opacity: 0.14 },
        // District markers
        { type: 'landmark', typeId: 'decal', x: -35, z: -35, radius: 5, color: 0x2a5a4a, opacity: 0.2 },
        { type: 'landmark', typeId: 'decal', x: 35, z: -35, radius: 5, color: 0x2a4a6a, opacity: 0.2 },
        { type: 'landmark', typeId: 'decal', x: -35, z: 35, radius: 5, color: 0x4a4a6a, opacity: 0.2 },
        { type: 'landmark', typeId: 'decal', x: 35, z: 35, radius: 5, color: 0x6a4a2a, opacity: 0.2 },
        // Outer city domes (visual only)
        { type: 'landmark', typeId: 'dome', x: 88, z: 29, radius: 4 },
        { type: 'landmark', typeId: 'dome', x: 29, z: 88, radius: 4 },
        { type: 'landmark', typeId: 'dome', x: -88, z: -29, radius: 4 },
        { type: 'landmark', typeId: 'dome', x: -29, z: -88, radius: 4 }
    ],
    prefabs: [
        // Boulevard edge accents + district pocket flavor
        { type: 'coralCluster', x: -12, z: -24, scale: 0.8 },
        { type: 'coralCluster', x: 12, z: -24, scale: 0.8 },
        { type: 'coralCluster', x: -12, z: 24, scale: 0.8 },
        { type: 'coralCluster', x: 12, z: 24, scale: 0.8 },
        { type: 'rockCluster', x: -24, z: -12, scale: 0.65 },
        { type: 'rockCluster', x: 24, z: -12, scale: 0.65 },
        { type: 'rockCluster', x: -24, z: 12, scale: 0.65 },
        { type: 'rockCluster', x: 24, z: 12, scale: 0.65 }
    ],
    enemySpawners: [
        { x: 56, z: 0 },   // East boulevard endpoint
        { x: -56, z: 0 },  // West boulevard endpoint
        { x: 0, z: 56 },   // South boulevard endpoint
        { x: 0, z: -56 },  // North boulevard endpoint
        { x: 32, z: 24 },  // Alley exits (SE/NE side)
        { x: -32, z: 24 }, // Alley exits (SW/NW side)
        { x: 24, z: -32 },
        { x: -24, z: -32 }
    ]
};
