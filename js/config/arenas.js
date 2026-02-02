// Progressive Arena Configuration with Lore and Tiered Waves

// Arena 1 uses a special "Boss Chase" system:
// - Segment 1: Waves 1-3 → Boss Phase 1 (retreats)
// - Segment 2: Waves 4-5 → Boss Phase 2 (retreats)
// - Segment 3: Waves 6-7 → Boss Phase 3 (final)
// Total: 7 wave encounters before boss completion

export const ARENA_CONFIG = {
    arenas: {
        1: {
            name: 'The Training Grounds',
            waves: 7,  // 3 segments: (3 waves + Boss P1) + (2 waves + Boss P2) + (2 waves + Boss P3)
            features: ['flat', 'landmarks'],
            color: 0x2a2a4a,
            lore: 'You are a new recruit learning the basics.',
            teaches: 'Move, shoot, dodge - fundamentals under pressure',
            bossLesson: 'Simple patterns teach timing and spacing',
            // Arena-specific spawn config to discourage edge-kiting
            spawnConfig: {
                antiEdgeBias: true,
                minDistFromCorner: 15
            }
        },
    2: {
        name: 'Shields & Cover',
        waves: 5,
        features: ['flat', 'pillars'],
        color: 0x2a3a4a,
        lore: 'Shield-focused combat with tactical cover.',
        teaches: 'Target priority, shield break mechanics, repositioning',
        bossLesson: 'Cover is temporary advantage - keep moving',
        lessonEnemy: 'shielded',
        shieldedRatio: 0.7,  // 70% of enemies should be shielded
        // Geometry configuration for anti-camping asymmetric layout
        geometryConfig: {
            pillarSymmetry: 'asymmetric',  // Breaks "solved loop" kiting
            coverBlockOffset: true,         // Staggered cover prevents camping
            innerPillarCount: 3             // Odd count breaks rotational symmetry
        }
    },
    3: {
        name: 'Vertical Loop',
        waves: 6,
        features: ['flat', 'pillars', 'vertical', 'ramps'],
        color: 0x3a2a4a,
        lore: 'Elevation test - climb to engage enemies.',
        teaches: 'Vertical awareness, climbing, repositioning under threat',
        bossLesson: 'Teleportation and platform pressure',
        lessonEnemy: 'pillarPolice',
        // Vertical-specific config for Pillar Police behavior
        pillarConfig: {
            gracePeriod: 1500,           // 1.5s grace before PP hunts after landing
            cornerAccessRamps: true       // CP4 has stepping stone access
        }
    },
    4: {
        name: 'Platform Gardens',
        waves: 8,
        features: ['flat', 'pillars', 'vertical', 'platforms', 'multiLevel'],
        color: 0x2a4a3a,
        lore: 'Multi-level combat arena with strategic vantage points.',
        teaches: 'Movement planning, platform control, bouncer tracking',
        bossLesson: 'Lane control foreshadowing tunnels',
        lessonEnemy: 'fastBouncer',
        // Platform and bouncer configuration
        platformConfig: {
            bridgeMinWidth: 5,
            resetPadCount: 4,
            heightIndicators: true
        }
    },
    5: {
        name: 'The Labyrinth',
        waves: 8,
        features: ['flat', 'pillars', 'vertical', 'platforms', 'tunnels'],
        color: 0x4a2a3a,
        lore: 'Narrow corridors and chokepoints test your nerve.',
        teaches: 'Priority targeting, corridor control, crowd management',
        bossLesson: 'Burrow mechanics and hazard introduction',
        lessonEnemy: 'splitter'
    },
    6: {
        name: 'Chaos Realm',
        waves: 10,
        features: ['flat', 'pillars', 'vertical', 'platforms', 'tunnels', 'hazards'],
        color: 0x3a3a3a,
        lore: 'Everything you learned converges here.',
        teaches: 'Reaction, threat reading, adapting under layered pressure',
        bossLesson: 'Pattern mastery, multi-mechanic synthesis',
        lessonEnemy: 'teleporter',
        breatherWaves: [3, 6, 9]  // Waves with reduced pressure
    }
    }
};

// Helper to get waves for an arena
export function getArenaWaves(arenaNumber) {
    const arena = ARENA_CONFIG.arenas[Math.min(arenaNumber, 6)];
    return arena ? arena.waves : 10;
}
