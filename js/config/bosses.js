// Enhanced Boss Configuration with Modular Ability System
// Each boss inherits ALL previous boss abilities plus their signature move
// Lore: Bosses are "Pulse Wardens" that absorb what the recruit has survived

export const BOSS_CONFIG = {
    1: { 
        name: 'RED PUFFER KING', 
        health: 1250,  // Reduced for better pacing
        damage: 25, 
        size: 2.0,  // Reduced for better player/boss scale ratio
        color: 0xff2222, 
        speed: 0.06,
        
        // Shield configuration (75% DR with loud ricochet feedback)
        shieldConfig: {
            enabled: true,
            activateOnSummon: false,     // Manual activation in Phase 2+
            damageReduction: 0.75,       // Changed from 0.95 - chip damage feels less wasted
            color: 0x4488ff,
            failsafeTimeout: 12.0        // Auto-break after 12 seconds (prevents softlock)
        },
        
        // NEW: Exposed state configuration (phase-scaled rewards)
        exposedConfig: {
            duration: 600,           // Base: 10 seconds for Phase 1
            durationByPhase: {
                1: 600,  // 10 seconds (teaching phase - generous window)
                2: 420,  // 7 seconds
                3: 300,  // 5 seconds (intense)
            },
            damageMultiplier: 1.25,
            flashRate: 15,
            // Nerfed rewards if shield breaks via failsafe timeout (prevents "wait out" strats)
            failsafeDuration: 180,   // Only 3 seconds
            failsafeMultiplier: 1.0, // No damage bonus
        },
        
        // Phase-specific behavior configuration
        phaseBehavior: {
            1: { chase: true, canCharge: true, canSummon: false, canShield: false },
            2: { chase: false, canCharge: false, canSummon: true, canShield: true, autoShield: true, staticMode: true },
            3: { chase: true, canCharge: true, canSummon: true, canShield: true, summonCap: 4 }
        },
        
        // Recovery windows after charge (in frames)
        chargeRecovery: {
            phase1: 90,   // 1.5 seconds - long punish window
            phase2: 0,    // No charge in Phase 2
            phase3: 45    // 0.75 seconds - shorter window under pressure
        },
        
        // Roster display fields
        tagline: 'Monarch of the First Gate',
        description: 'The massive progenitor of the Red Puffer swarm. This bloated sovereign embodies pressure itself - relentless charges and summoned offspring force you to prove you\'ve learned the basics of movement and timing.',
        behaviorText: 'Phase 1: Chases and charges. Phase 2: Static shield puzzle. Phase 3: Chases while shielded',
        // Signature: Progressive pressure teaching - "Can you survive pressure?"
        abilities: {
            charge: true,
            summon: true,
            jumpSlam: false,
            hazards: false,
            teleport: false,
            growth: false,
            split: false,
            burrow: false
        },
        // Ability weights per phase (higher = more likely to use)
        abilityWeights: {
            charge: [1.0, 0.0, 1.5],   // Phase 1: active, Phase 2: disabled, Phase 3: high
            summon: [0.0, 1.0, 0.6]    // Phase 1: disabled, Phase 2: primary, Phase 3: secondary
        },
        // Phase-specific combos: [ability1, ability2, ...]
        phaseCombos: {
            2: [],  // No combos in Phase 2 (static mode)
            3: [['charge', 'summon']]  // Phase 3: Can combo while chasing
        }
    },
    2: { 
        name: 'THE MONOLITH', 
        health: 2750,  // 5x for longer boss fights 
        damage: 24, 
        size: 2.8, 
        color: 0x44ff88, 
        speed: 0.035,
        
        // NEW: Pillar perch configuration
        // Extended timing: marker at 20, tracks until 65, locks 65-105 (40 frames = 0.67s warning)
        pillarPerchConfig: {
            enabled: true,
            perchDuration: 105,     // 1.75 seconds total on pillar (extended for accessibility)
            slamChargeTime: 45,     // 0.75 seconds charge
            slamRadius: 6,
            slamDamage: 30,
            cooldown: 360           // 6 seconds between perches
        },
        // Roster display fields
        tagline: 'Master of Terrain',
        description: 'Cover isn\'t safety - it\'s geometry. The Monolith teaches that obstacles are not just shields but potential traps. Its devastating jump slams create hazard zones that punish static positioning.',
        behaviorText: 'Jump slams create hazard zones; inherits charge and summon abilities',
        // Inherits: Charge + Summon | Signature: Jump Slam + Hazards
        // "Cover isn't safety. It's geometry."
        abilities: {
            charge: true,      // inherited
            summon: true,      // inherited
            jumpSlam: true,    // NEW
            hazards: true,     // NEW
            teleport: false,
            growth: false,
            split: false,
            burrow: false
        },
        abilityWeights: {
            charge: [0.6, 0.8, 1.0],
            summon: [0.3, 0.4, 0.5],
            jumpSlam: [1.0, 1.3, 1.5],
            hazards: [0.8, 1.0, 1.2]
        },
        phaseCombos: {
            2: [['jumpSlam', 'hazards']],
            3: [['jumpSlam', 'hazards'], ['charge', 'jumpSlam']]
        }
    },
    3: { 
        name: 'THE ASCENDANT', 
        health: 3500,  // 5x for longer boss fights 
        damage: 28, 
        size: 3.0, 
        color: 0xaa44ff, 
        speed: 0.04,
        
        // ENHANCED: Teleport to platforms
        teleportConfig: {
            preferElevated: true,
            elevatedChance: 0.7,
            vulnerabilityWindow: 60  // Extended from 45 (1 second for player to react)
        },
        // Roster display fields
        tagline: 'Beyond Space and Time',
        description: 'Distance is a lie. The Ascendant warps reality itself, appearing anywhere in the arena without warning. This boss demands constant spatial awareness - you can never predict where the next attack originates.',
        behaviorText: 'Teleports around the arena; spawns Teleporter minions',
        // Inherits: All above | Signature: Teleport + Spawn teleporters
        // "Distance is a lie. Z-axis matters."
        abilities: {
            charge: true,
            summon: true,
            jumpSlam: true,
            hazards: true,
            teleport: true,    // NEW
            growth: false,
            split: false,
            burrow: false
        },
        abilityWeights: {
            charge: [0.5, 0.6, 0.8],
            summon: [0.4, 0.5, 0.6],
            jumpSlam: [0.6, 0.8, 1.0],
            hazards: [0.5, 0.6, 0.8],
            teleport: [1.0, 1.3, 1.6]
        },
        phaseCombos: {
            2: [['teleport', 'charge']],
            3: [['teleport', 'charge'], ['teleport', 'jumpSlam']]
        },
        // Combo delays for fair reaction time after teleport
        comboDelays: {
            'teleport_charge': 25,     // 0.4s gap after teleport before charge tell
            'teleport_jumpSlam': 20    // 0.33s gap after teleport before jump slam tell
        }
    },
    4: { 
        name: 'THE OVERGROWTH', 
        health: 4250,  // 5x for longer boss fights 
        damage: 26, 
        size: 3.2, 
        color: 0x44ffff, 
        speed: 0.03,
        
        // NEW: Temporary lane walls (tunnel foreshadow)
        laneWallsConfig: {
            enabled: true,
            wallCount: 2,
            wallDuration: 180,
            wallHeight: 4,
            wallLength: 20,
            warningTime: 45,
            cooldown: 300
        },
        // Roster display fields
        tagline: 'Endless Multiplication',
        description: 'Space control through multiplicity. The Overgrowth swells larger with each passing moment and spawns Water Balloon minions. At critical health, it fractures into three dangerous mini-bosses - retreat often means survival.',
        behaviorText: 'Grows over time; spawns Water Balloons; splits into 3 mini-bosses at 25% HP',
        // Inherits: All above | Signature: Growth + Split
        // "Space control. Multiplicity."
        abilities: {
            charge: true,
            summon: true,
            jumpSlam: true,
            hazards: true,
            teleport: true,
            growth: true,      // NEW
            split: true,       // NEW
            burrow: false
        },
        abilityWeights: {
            charge: [0.4, 0.5, 0.6],
            summon: [0.3, 0.4, 0.5],
            jumpSlam: [0.5, 0.6, 0.7],
            hazards: [0.4, 0.5, 0.6],
            teleport: [0.6, 0.7, 0.8],
            growth: [1.0, 1.2, 1.4],
            split: [0.0, 0.5, 1.0]  // Only in phase 2+
        },
        phaseCombos: {
            2: [['growth', 'summon']],
            3: [['growth', 'split'], ['teleport', 'growth']]
        }
    },
    5: { 
        name: 'THE BURROWER', 
        health: 5000,  // 5x for longer boss fights 
        damage: 32, 
        size: 3.5, 
        color: 0xff44ff, 
        speed: 0.035,
        
        // ENHANCED: Burrow telegraphs and hazard preview
        burrowConfig: {
            emergeWarningTime: 45,
            emergeDamageRadius: 5,
            emergeHazard: {
                enabled: true,
                radius: 3,
                duration: 180
            }
        },
        // Roster display fields
        tagline: 'Terror From Below',
        description: 'You don\'t see the threat until it\'s behind you. The Burrower disappears into the ground and erupts beneath your feet, dealing massive damage to those caught off guard. Corridor navigation becomes a deadly guessing game.',
        behaviorText: 'Burrows underground; emerges near player for surprise damage',
        // Inherits: All above | Signature: Burrow/Emerge
        // "You don't see the threat until it's behind you."
        abilities: {
            charge: true,
            summon: true,
            jumpSlam: true,
            hazards: true,
            teleport: true,
            growth: true,
            split: true,
            burrow: true       // NEW
        },
        abilityWeights: {
            charge: [0.4, 0.5, 0.6],
            summon: [0.3, 0.4, 0.5],
            jumpSlam: [0.4, 0.5, 0.6],
            hazards: [0.4, 0.5, 0.6],
            teleport: [0.5, 0.6, 0.7],
            growth: [0.5, 0.6, 0.7],
            split: [0.0, 0.3, 0.5],
            burrow: [1.0, 1.3, 1.6]
        },
        phaseCombos: {
            2: [['burrow', 'charge']],
            3: [['burrow', 'charge'], ['burrow', 'jumpSlam'], ['teleport', 'burrow']]
        },
        // Combo delays for fair reaction time after burrow emerge
        comboDelays: {
            'burrow_charge': 40,      // 0.67s gap after emerge before charge tell
            'burrow_jumpSlam': 35,    // 0.58s gap after emerge before jump slam tell
            'teleport_burrow': 20     // Teleport into burrow is fine (short gap)
        }
    },
    6: { 
        name: 'CHAOS INCARNATE', 
        health: 7500,  // 5x for longer boss fights 
        damage: 40, 
        size: 4.0, 
        color: 0xffffff, 
        speed: 0.05,
        // Roster display fields
        tagline: 'The Final Examination',
        description: 'The program stops teaching. It measures. Chaos Incarnate wields every ability you\'ve faced, cycling through predictable phases: Movement, Area Control, and Summons. Learn the rhythm or perish.',
        behaviorText: 'Cycles through ALL boss abilities in learnable patterns',
        // Has ALL abilities - "The program stops teaching. It measures."
        abilities: {
            charge: true,
            summon: true,
            jumpSlam: true,
            hazards: true,
            teleport: true,
            growth: true,
            split: true,
            burrow: true
        },
        abilityWeights: {
            charge: [1.0, 1.2, 1.5],
            summon: [0.8, 1.0, 1.2],
            jumpSlam: [1.0, 1.2, 1.5],
            hazards: [0.8, 1.0, 1.2],
            teleport: [1.0, 1.2, 1.5],
            growth: [0.6, 0.8, 1.0],
            split: [0.3, 0.5, 0.8],
            burrow: [1.0, 1.2, 1.5]
        },
        // Reduced Phase 3 combos to 2 abilities for fair reaction windows
        phaseCombos: {
            2: [['teleport', 'charge'], ['burrow', 'jumpSlam']],
            3: [['teleport', 'charge'], ['burrow', 'jumpSlam'], 
                ['growth', 'summon'], ['jumpSlam', 'hazards']]
        },
        // Combo delays for fair reaction time between chained abilities
        comboDelays: {
            'teleport_charge': 30,      // 0.5s gap after teleport before charge
            'burrow_jumpSlam': 35,      // 0.58s gap after burrow before jump slam
            'growth_summon': 25,        // 0.42s gap after growth before summon
            'jumpSlam_hazards': 20      // 0.33s gap after jump slam before hazards
        },
        // Cycle colors for dynamic boss color shifting
        cycleColors: {
            movement: 0xff4444,     // Red
            areaControl: 0x44ff44,  // Green
            summons: 0x4444ff       // Blue
        }
    }
};

// Ability cooldowns (in frames)
export const ABILITY_COOLDOWNS = {
    charge: 90,
    summon: 150,
    jumpSlam: 120,
    hazards: 100,
    teleport: 80,
    growth: 200,
    split: 300,
    burrow: 150
};

// Ability tell durations (wind-up time in frames)
export const ABILITY_TELLS = {
    charge: { phase1: 45, phase2: 45, phase3: 15 },  // Boss 1: longer P1 (learning), shorter P3 (pressure)
    summon: { phase1: 25, phase2: 20, phase3: 15 },
    jumpSlam: { phase1: 40, phase2: 30, phase3: 22 },
    hazards: { phase1: 20, phase2: 15, phase3: 10 },
    teleport: { phase1: 25, phase2: 20, phase3: 12 },
    growth: { phase1: 30, phase2: 25, phase3: 18 },
    split: { phase1: 40, phase2: 30, phase3: 20 },
    burrow: { phase1: 35, phase2: 28, phase3: 20 }
};
