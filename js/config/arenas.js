// Progressive Arena Configuration with Lore and Tiered Waves

export const ARENA_CONFIG = {
    arenas: {
        1: {
            name: 'The Training Grounds',
            waves: 3,  // Short intro
            features: ['flat'],
            color: 0x2a2a4a,
            lore: 'You are a new recruit learning the basics.',
            teaches: 'Move, shoot, dodge - fundamentals under pressure',
            bossLesson: 'Simple patterns teach timing and spacing'
        },
        2: {
            name: 'Obstacle Field',
            waves: 5,
            features: ['flat', 'pillars'],
            color: 0x2a3a4a,
            lore: 'Combat test course with scattered cover objects.',
            teaches: 'Cover & movement synergy - use obstacles defensively',
            bossLesson: 'Cover is both shield and trap - timing cycles matter'
        },
        3: {
            name: 'Vertical Loop',
            waves: 6,
            features: ['flat', 'pillars', 'vertical'],
            color: 0x3a2a4a,
            lore: 'Elevation test - gravity is not your enemy.',
            teaches: 'Jumping, positioning, Z-axis awareness',
            bossLesson: 'Controlled spacing beats brute force'
        },
        4: {
            name: 'Platform Gardens',
            waves: 8,
            features: ['flat', 'pillars', 'vertical', 'platforms'],
            color: 0x2a4a3a,
            lore: 'Multi-level combat arena with strategic vantage points.',
            teaches: 'Height advantage, platform control, gap management',
            bossLesson: 'Positioning is power - control the high ground'
        },
        5: {
            name: 'The Labyrinth',
            waves: 8,
            features: ['flat', 'pillars', 'vertical', 'platforms', 'tunnels'],
            color: 0x4a2a3a,
            lore: 'Narrow corridors and chokepoints test your nerve.',
            teaches: 'Line control, corridor pressure, risk assessment',
            bossLesson: 'Sometimes retreat opens the path forward'
        },
        6: {
            name: 'Chaos Realm',
            waves: 10,
            features: ['flat', 'pillars', 'vertical', 'platforms', 'tunnels', 'hazards'],
            color: 0x3a3a3a,
            lore: 'Everything you learned converges here.',
            teaches: 'Combines all mechanics - mastery through synthesis',
            bossLesson: 'Adapt or perish - the final test of all skills'
        }
    }
};

// Helper to get waves for an arena
export function getArenaWaves(arenaNumber) {
    const arena = ARENA_CONFIG.arenas[Math.min(arenaNumber, 6)];
    return arena ? arena.waves : 10;
}
