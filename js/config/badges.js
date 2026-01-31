// Badge System Configuration

// Badge categories and definitions
export const BADGE_CATEGORIES = {
    WEAPON: 'weapon',
    MOVEMENT: 'movement',
    DEFENSE: 'defense',
    SPECIAL: 'special',
    ARENA: 'arena'  // Persistent badges from boss defeats
};

// All available badges
export const BADGES = {
    // Weapon Badges (from upgrades)
    rapidFire: {
        id: 'rapidFire',
        name: 'Rapid Fire',
        icon: '⚡',
        category: BADGE_CATEGORIES.WEAPON,
        color: '#ffdd44',
        description: 'Increased attack speed',
        stat: 'attackSpeed',
        threshold: 1.2  // Unlocks when stat >= threshold
    },
    multiShot: {
        id: 'multiShot',
        name: 'Multi-Shot',
        icon: '🎯',
        category: BADGE_CATEGORIES.WEAPON,
        color: '#44ffff',
        description: 'Multiple projectiles',
        stat: 'projectileCount',
        threshold: 2
    },
    powerShot: {
        id: 'powerShot',
        name: 'Power Shot',
        icon: '⚔️',
        category: BADGE_CATEGORIES.WEAPON,
        color: '#ff4444',
        description: 'High damage output',
        stat: 'damage',
        threshold: 15
    },
    sniper: {
        id: 'sniper',
        name: 'Sniper',
        icon: '💨',
        category: BADGE_CATEGORIES.WEAPON,
        color: '#88ff88',
        description: 'Fast projectiles',
        stat: 'projectileSpeed',
        threshold: 1.2
    },

    // Movement Badges
    speedster: {
        id: 'speedster',
        name: 'Speedster',
        icon: '👟',
        category: BADGE_CATEGORIES.MOVEMENT,
        color: '#44ff44',
        description: 'Enhanced movement speed',
        stat: 'moveSpeed',
        threshold: 0.2
    },

    // Defense Badges
    tank: {
        id: 'tank',
        name: 'Tank',
        icon: '❤️',
        category: BADGE_CATEGORIES.DEFENSE,
        color: '#ff6666',
        description: 'High max health',
        stat: 'maxHealth',
        threshold: 150
    },

    // Special Badges
    collector: {
        id: 'collector',
        name: 'Collector',
        icon: '🧲',
        category: BADGE_CATEGORIES.SPECIAL,
        color: '#ff88ff',
        description: 'Extended pickup range',
        stat: 'pickupRange',
        threshold: 5
    },
    scholar: {
        id: 'scholar',
        name: 'Scholar',
        icon: '✨',
        category: BADGE_CATEGORIES.SPECIAL,
        color: '#ffff44',
        description: 'XP bonus active',
        stat: 'xpMultiplier',
        threshold: 1.4
    },

    // Arena Mastery Badges (persistent - unlocked by beating bosses)
    arenaTraining: {
        id: 'arenaTraining',
        name: 'Initiate',
        icon: '🏆',
        category: BADGE_CATEGORIES.ARENA,
        color: '#bronze',
        description: 'Defeated The Pillar Guardian',
        arena: 1,
        persistent: true
    },
    arenaObstacle: {
        id: 'arenaObstacle',
        name: 'Bulwark Breaker',
        icon: '🛡️',
        category: BADGE_CATEGORIES.ARENA,
        color: '#silver',
        description: 'Defeated The Slime Queen',
        arena: 2,
        persistent: true
    },
    arenaVertical: {
        id: 'arenaVertical',
        name: 'Ascension Adept',
        icon: '⬆️',
        category: BADGE_CATEGORIES.ARENA,
        color: '#gold',
        description: 'Defeated The Teleporting Tyrant',
        arena: 3,
        persistent: true
    },
    arenaPlatform: {
        id: 'arenaPlatform',
        name: 'Platform Knight',
        icon: '👑',
        category: BADGE_CATEGORIES.ARENA,
        color: '#44ffff',
        description: 'Defeated The Balloon King',
        arena: 4,
        persistent: true
    },
    arenaLabyrinth: {
        id: 'arenaLabyrinth',
        name: 'Maze Runner',
        icon: '🌀',
        category: BADGE_CATEGORIES.ARENA,
        color: '#ff44ff',
        description: 'Defeated The Tunnel Wyrm',
        arena: 5,
        persistent: true
    },
    arenaChaos: {
        id: 'arenaChaos',
        name: 'Chaos Conqueror',
        icon: '💀',
        category: BADGE_CATEGORIES.ARENA,
        color: '#ffffff',
        description: 'Defeated Chaos Incarnate',
        arena: 6,
        persistent: true
    }
};

// Get badge by arena number
export function getArenaBadge(arenaNumber) {
    const badgeMap = {
        1: BADGES.arenaTraining,
        2: BADGES.arenaObstacle,
        3: BADGES.arenaVertical,
        4: BADGES.arenaPlatform,
        5: BADGES.arenaLabyrinth,
        6: BADGES.arenaChaos
    };
    return badgeMap[arenaNumber] || null;
}

// Get all stat-based badges
export function getStatBadges() {
    return Object.values(BADGES).filter(b => b.stat && !b.persistent);
}

// Get all arena badges
export function getArenaBadges() {
    return Object.values(BADGES).filter(b => b.persistent);
}
