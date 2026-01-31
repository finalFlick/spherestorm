import { WAVES_PER_ARENA } from './constants.js';

// Progressive Arena Configuration
export const ARENA_CONFIG = {
    wavesPerArena: WAVES_PER_ARENA,
    arenas: {
        1: { name: 'The Proving Grounds', features: ['flat'], color: 0x2a2a4a },
        2: { name: 'Pillar Sanctum', features: ['flat', 'pillars'], color: 0x2a3a4a },
        3: { name: 'Sky Rise', features: ['flat', 'pillars', 'vertical'], color: 0x3a2a4a },
        4: { name: 'Platform Gardens', features: ['flat', 'pillars', 'vertical', 'platforms'], color: 0x2a4a3a },
        5: { name: 'The Labyrinth', features: ['flat', 'pillars', 'vertical', 'platforms', 'tunnels'], color: 0x4a2a3a },
        6: { name: 'Chaos Realm', features: ['flat', 'pillars', 'vertical', 'platforms', 'tunnels', 'hazards'], color: 0x3a3a3a }
    }
};
