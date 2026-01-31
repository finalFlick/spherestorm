// Leaderboard Configuration

export const LEADERBOARD_CONFIG = {
    maxEntries: 10,
    storageKey: 'spherestorm_leaderboard',
    persistentBadgesKey: 'spherestorm_badges'
};

// Leaderboard entry structure
export function createLeaderboardEntry(name, score, arena, wave, level, badges, time) {
    return {
        name: name.substring(0, 3).toUpperCase(),  // 3 char max
        score: score,
        arena: arena,
        wave: wave,
        level: level,
        badges: badges || [],
        time: time,
        date: new Date().toISOString()
    };
}
