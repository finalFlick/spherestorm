// Enemy type definitions with weighted spawning
// Colors are distinct and saturated for easy identification
// Visual profiles: glow/pulse/orbit effects only (smooth spheres, no geometry attachments)
// Size bands: Swarm (0.25-0.35), Standard (0.45-0.55), Heavy (0.90-1.20)

export const ENEMY_TYPES = {
    grunt: {
        name: 'Red Puffer',
        size: 0.65,          // Standard - noticeably bigger than tiny
        health: 12,
        speed: 0.055,        // Faster (+57%)
        damage: 10,
        color: 0xff4444,     // Mid-red - between pink tiny and dark big
        xpValue: 3,          // Tripled from 1
        behavior: 'chase',
        spawnWeight: 40,
        arenaIntro: 1,       // Introduced in Arena 1
        minWave: 2,          // Only spawns Wave 2+ (Wave 1 is Tiny only)
        usePorcupinefishMesh: true,  // Uses mini porcupinefish visual (like Boss 1)
        // Roster display fields
        tagline: 'Spawn of the King',
        description: 'Tiny offspring of the Red Puffer King. These aggressive puffers swarm in numbers, overwhelming through sheer persistence. What they lack in size, they make up for in relentless pursuit.',
        behaviorText: 'Chases the player directly without stopping',
        // Visual profile: not used (porcupinefish mesh overrides)
        visualProfile: {
            type: 'glow',
            glowIntensity: 0.4,
            pulseSpeed: 0
        },
        movementSignature: 'sway',
        telegraph: null,
        deathVfx: { color: 0xff2222, count: 12, type: 'burst' }
    },
    gruntTiny: {
        name: 'Tiny Puffer',
        size: 0.35,          // Small but visible - baseline reference size
        health: 4,           // 1-shot at base damage (10)
        speed: 0.07,         // Faster than standard grunt
        damage: 5,           // Less threatening individually
        color: 0xffaaaa,     // Pink - clearly different from standard
        xpValue: 1.5,        // Tripled from 0.5
        behavior: 'chase',
        spawnWeight: 35,     // Higher weight - dominant in early waves
        arenaIntro: 1,       // Available in Arena 1
        usePorcupinefishMesh: true,  // Same visual style, just smaller
        // Roster display fields
        tagline: 'Spawn of the Spawn',
        description: 'The smallest of the Red Puffer brood. These hyperactive fry dart around in swarms, individually weak but overwhelming in numbers. One shot dispatches them, but can you hit them all?',
        behaviorText: 'Chases rapidly; dies in one shot',
        // Visual profile: slightly brighter glow for visibility at small size
        visualProfile: {
            type: 'glow',
            glowIntensity: 0.5,
            pulseSpeed: 0.1
        },
        movementSignature: 'sway',
        telegraph: null,
        deathVfx: { color: 0xffaaaa, count: 6, type: 'burst' }
    },
    gruntBig: {
        name: 'Big Puffer',
        size: 1.1,           // Heavy - VERY large and intimidating
        health: 30,          // 3-shot at base damage (10)
        speed: 0.04,         // Slower than standard (0.055)
        damage: 15,          // More threatening
        color: 0x991111,     // Dark red - intimidating, clearly different
        xpValue: 9,          // Tripled from 3
        behavior: 'chase',
        spawnWeight: 15,     // Less common - pressure element
        arenaIntro: 1,       // Available in Arena 1
        minWave: 3,          // Only spawns Wave 3+ (pressure test)
        usePorcupinefishMesh: true,  // Same visual style, larger
        // Roster display fields
        tagline: 'The Elder Spawn',
        description: 'A mature Red Puffer that has grown larger and more resilient. Slower but more dangerous, these elders anchor the swarm with their bulk.',
        behaviorText: 'Chases steadily; takes 3 hits to kill',
        // Visual profile: deeper glow for ominous presence
        visualProfile: {
            type: 'glow',
            glowIntensity: 0.6,
            pulseSpeed: 0.05
        },
        movementSignature: 'sway',
        telegraph: null,
        deathVfx: { color: 0xcc0000, count: 16, type: 'burst' }
    },
    shooter: {
        name: 'Shooter',
        size: 0.45,          // Standard (smaller)
        health: 8,
        speed: 0.035,        // Faster (+40%)
        damage: 8,
        color: 0x22ff22,     // Bright green - ranged
        xpValue: 6,          // Tripled from 2
        behavior: 'shooter',
        shootRange: 15,
        shootCooldown: 2000,
        spawnWeight: 0,      // DEMOTED: Boss minion only
        arenaIntro: null,    // No longer introduced via arena progression
        isBossMinion: true,  // NEW: Boss summon only
        isEliteOnly: true,   // NEW: Elite variant only
        // Roster display fields
        tagline: 'Death From a Distance',
        description: 'Cowardly but deadly. Shooters prefer to engage from range, retreating when threatened. Their projectiles are slow but punishing if you ignore them.',
        behaviorText: 'Maintains distance and fires projectiles every 2 seconds',
        // Visual profile: pulsing glow when ready to fire
        visualProfile: {
            type: 'glow',
            glowIntensity: 0.5,
            pulseSpeed: 0.05
        },
        movementSignature: 'strafe',
        telegraph: { type: 'flash', duration: 300, color: 0x88ff88 },
        deathVfx: { color: 0x22ff22, count: 10, type: 'sparkRing' }
    },
    shielded: {
        name: 'Guardian Crab',
        size: 1.00,          // Heavy (bigger!)
        health: 25,          // Reduced from 30 (support, not main threat)
        speed: 0.035,        // Reduced from 0.045 (hangs with pack, doesn't rush)
        damage: 10,          // Reduced from 12 (contact damage is secondary)
        color: 0x4466ff,     // Slightly brighter blue
        xpValue: 12,         // Increased from 9 (priority kill reward)
        behavior: 'wardenSupport',  // NEW behavior type
        damageReduction: 0,
        useGuardianCrabMesh: true,  // Uses crab mesh instead of default sphere
        // Aura configuration (projects shields onto nearby allies)
        auraRadius: 7,       // ~14m diameter coverage
        auraShieldHP: 12,    // ~1 extra shot at base damage
        maxShielded: 5,      // Performance + readability cap
        anemoneCoreHP: 12,   // Breakable core disables aura and shatters granted shields
        // NO self-shield (Warden is always vulnerable)
        spawnWeight: 30,     // Arena 2 signature enemy
        arenaIntro: 2,       // Introduced in Arena 2
        // Roster display fields
        tagline: 'Anemone-Bearer',
        description: 'A hulking crab that projects shields onto nearby allies. Its anemone core is the true shield source — break it to collapse the aura and shatter all granted shields.',
        behaviorText: 'Projects 12 HP shields within 7 units; break the anemone core to disable the aura',
        // Visual profile: NEW pulsing ring instead of orbit
        visualProfile: {
            type: 'wardenAura',
            ringPulseSpeed: 0.03,
            ringColor: 0x4466ff,
            glowIntensity: 0.5
        },
        movementSignature: 'scuttle',
        telegraph: null,
        deathVfx: { color: 0x4466ff, count: 20, type: 'cascade' }
    },
    fastBouncer: {
        name: 'Fast Bouncer',
        size: 0.28,          // Swarm (tiny!)
        health: 6,
        speed: 0.12,
        damage: 8,
        color: 0xffff00,     // Pure yellow - fast
        xpValue: 9,          // Tripled from 3
        behavior: 'bouncer',
        spawnWeight: 20,     // Increased from 10 (Arena 4 signature)
        arenaIntro: 4,       // UPDATED: Now Arena 4 (was minArena: 2)
        homingStrength: 0.0015, // Slightly increased from 0.001
        // Roster display fields
        tagline: 'Chaos in Motion',
        description: 'Hyperactive and unpredictable. Fast Bouncers ricochet off walls and obstacles like living pinballs, gradually homing toward their target. Their erratic paths make them hard to track.',
        behaviorText: 'Bounces off walls with slight homing toward player',
        // Visual profile: enhanced bright glow trail for visibility
        visualProfile: {
            type: 'glow',
            glowIntensity: 0.9,   // Increased from 0.7
            pulseSpeed: 0.2,      // Increased from 0.15
            trailEnabled: true    // NEW: add trail effect
        },
        movementSignature: 'squash',
        telegraph: null,
        deathVfx: { color: 0xffff00, count: 8, type: 'streak' }
    },
    splitter: {
        name: 'Splitter',
        size: 1.10,          // Heavy (very big!)
        health: 20,
        speed: 0.045,        // Faster (+50%)
        damage: 10,
        color: 0xff00ff,     // Bright magenta - splits
        xpValue: 12,         // Tripled from 4
        behavior: 'chase',
        onDeath: 'split',
        splitCount: 3,
        spawnWeight: 8,
        arenaIntro: 5,       // Introduced in Arena 5
        // Roster display fields
        tagline: 'Death Breeds More Death',
        description: 'A ticking time bomb of multiplication. When destroyed, Splitters fragment into three smaller, faster versions of themselves. Killing one is never the end.',
        behaviorText: 'Chases player; splits into 3 smaller enemies on death',
        // Visual profile: unstable pulsing (about to split)
        visualProfile: {
            type: 'pulse',
            glowIntensity: 0.5,
            pulseSpeed: 0.08,
            pulseRange: 0.3
        },
        movementSignature: 'inertia',
        telegraph: { type: 'crackGlow', duration: 400, color: 0xff88ff },
        deathVfx: { color: 0xff00ff, count: 15, type: 'crackSplit' }
    },
    shieldBreaker: {
        name: 'Shield Breaker',
        size: 0.55,          // Standard
        health: 15,
        speed: 0.055,        // Faster (+37%)
        damage: 18,
        color: 0xff8800,     // Orange - aggressive
        xpValue: 12,         // Tripled from 4
        behavior: 'shieldBreaker',
        rushRange: 8,
        rushSpeed: 0.15,
        spawnWeight: 0,      // DEMOTED: Elite variant only
        arenaIntro: null,    // No longer introduced via arena progression
        isEliteOnly: true,   // NEW: Elite variant only
        // Roster display fields
        tagline: 'The Charging Menace',
        description: 'Aggressive and deceptively patient. Shield Breakers approach calmly until you enter their rush range, then explode forward at devastating speed. Their high damage punishes careless positioning.',
        behaviorText: 'Charges at 4x speed when player is within 8 units',
        // Visual profile: intensifying glow before charge
        visualProfile: {
            type: 'glow',
            glowIntensity: 0.5,
            pulseSpeed: 0
        },
        movementSignature: 'jitter',
        telegraph: { type: 'compress', duration: 350, color: 0xffaa44 },
        deathVfx: { color: 0xff8800, count: 14, type: 'shockCone' }
    },
    waterBalloon: {
        name: 'Water Balloon',
        size: 0.40,          // Standard (grows to 1.2)
        health: 25,
        speed: 0.015,
        damage: 5,
        color: 0x00ffff,     // Cyan - grows/explodes
        xpValue: 18,         // Tripled from 6
        behavior: 'waterBalloon',
        growRate: 0.002,
        maxSize: 1.2,
        explosionRadius: 4,
        spawnWeight: 0,      // DEMOTED: Boss minion only
        arenaIntro: null,    // No longer introduced via arena progression
        isBossMinion: true,  // NEW: Boss summon only (hazard spawner)
        // Roster display fields
        tagline: 'The Ticking Time Bomb',
        description: 'Slow but insidious. Water Balloons swell larger with each passing moment, eventually bursting into a damaging hazard zone. Kill them before they reach critical mass - or suffer the splash.',
        behaviorText: 'Grows over time; explodes into hazard zone at max size or on death',
        // Visual profile: transparent + inner glow
        visualProfile: {
            type: 'transparent',
            opacity: 0.6,
            glowIntensity: 0.4,
            pulseSpeed: 0.06
        },
        movementSignature: 'wobble',
        telegraph: { type: 'pulse', duration: 500, color: 0x88ffff },
        deathVfx: { color: 0x00ffff, count: 20, type: 'splash' }
    },
    teleporter: {
        name: 'Teleporter',
        size: 0.42,          // Standard (smaller)
        health: 12,
        speed: 0.03,
        damage: 15,
        color: 0x8800ff,     // Purple - warps
        xpValue: 15,         // Tripled from 5
        behavior: 'teleporter',
        teleportCooldown: 3000,
        teleportRange: 8,
        spawnWeight: 4,
        arenaIntro: 6,       // Introduced in Arena 6
        // Roster display fields
        tagline: 'Now You See Me...',
        description: 'Masters of spatial manipulation. Teleporters blink to random positions near you every few seconds, making them frustratingly hard to pin down. Their unpredictable movement demands constant vigilance.',
        behaviorText: 'Teleports to random position near player every 3 seconds',
        // Visual profile: flickering/phasing glow
        visualProfile: {
            type: 'flicker',
            glowIntensity: 0.6,
            flickerSpeed: 0.2
        },
        movementSignature: 'stutter',
        telegraph: { type: 'flicker', duration: 250, color: 0xaa66ff },
        deathVfx: { color: 0x8800ff, count: 12, type: 'glitch' }
    },
    pillarPolice: {
        name: 'Pillar Police',
        size: 0.38,          // Small-medium, agile
        health: 10,
        speed: 0.06,         // Fast ground movement
        damage: 12,
        color: 0xffffff,     // White - stands out against dark pillars
        xpValue: 12,         // Tripled from 4
        behavior: 'pillarHopper',
        hopSpeed: 0.4,       // Fast hop between pillars
        pauseDuration: 30,   // 0.5 second pause after landing (faster response)
        detectionRange: 6,   // Range to detect player on same pillar
        spawnWeight: 25,     // UPDATED: Now spawns normally (Arena 3 signature)
        arenaIntro: 3,       // UPDATED: Arena 3 signature enemy
        maxArena: 4,         // Only spawns in Arena 3-4
        // Roster display fields
        tagline: 'No Safe Haven',
        description: 'Vigilant enforcers of the arena. Pillar Police patrol the high ground, leaping between pillar tops with alarming speed. Think you can camp on a pillar? Think again.',
        behaviorText: 'Hops between pillar tops; aggressively pursues players who try to camp',
        // Visual profile: flying orbiter (two spheres orbiting each other)
        visualProfile: {
            type: 'orbiter',
            glowIntensity: 0.8,
            orbitSpeed: 0.15,
            orbitRadius: 0.5
        },
        movementSignature: 'orbiter',
        telegraph: { type: 'crouch', duration: 200, color: 0xcccccc },
        deathVfx: { color: 0xffffff, count: 10, type: 'burst' }
    },
    treasureRunner: {
        name: 'Treasure Runner',
        size: 0.50,          // Standard size
        health: 8,           // Low health - easy to kill if caught
        speed: 0.08,         // Fast - challenging to catch
        damage: 5,           // Low damage (not a threat, just runs)
        color: 0xffd700,     // Gold - distinct and eye-catching
        xpValue: 0,          // No base XP (reward comes from drop)
        behavior: 'flee',
        spawnWeight: 0,      // Special spawn only
        arenaIntro: 2,       // Introduced in Arena 2+
        isSpecialSpawn: true, // Flag for special spawn system
        // Roster display fields
        tagline: 'Fleeing Fortune',
        description: 'A rare treasure carrier that spawns mid-wave and attempts to escape to the arena edge. Kill it before it escapes to claim bonus rewards!',
        behaviorText: 'Flees toward arena edge; drops reward if killed before escaping',
        // Visual profile: bright glow with trail effect
        visualProfile: {
            type: 'glow',
            glowIntensity: 0.9,  // Very bright
            pulseSpeed: 0.15      // Fast pulse
        },
        movementSignature: 'dash',
        telegraph: null,  // No telegraph needed (non-threatening)
        deathVfx: { color: 0xffd700, count: 20, type: 'burst' }
    }
};

// Arena progression reference:
// Arena 1: Red Puffer only (learn basics)
// Arena 2: + Guardian Crab (learn target priority - break the anemone core to disable shields)
// Arena 3: + Pillar Police (learn verticality)
// Arena 4: + Fast Bouncer (learn evasion)
// Arena 5: + Splitter (learn space control)
// Arena 6: + Teleporter (learn prediction)

// Color discipline reference
// Warm (red/orange/yellow): Touch/collision/burst threats
// Cool (blue/cyan/purple): Durability/space manipulation
// Green: Ranged/utility
