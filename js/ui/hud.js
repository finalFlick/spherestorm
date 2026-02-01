import { gameState } from '../core/gameState.js';
import { getCurrentBoss } from '../core/entities.js';
import { ARENA_CONFIG, getArenaWaves } from '../config/arenas.js';
import { BOSS_CONFIG } from '../config/bosses.js';
import { ENEMY_TYPES } from '../config/enemies.js';
import { THREAT_BUDGET, WAVE_MODIFIERS } from '../config/constants.js';
import { getHudBadges, getMasteryBadges, updateStatBadges } from '../systems/badges.js';
import { getRecentDamage, getDeathTip } from '../systems/damage.js';

export let gameStartTime = 0;

export function setGameStartTime(time) {
    gameStartTime = time;
}

export function updateUI() {
    // Health and XP
    document.getElementById('health-bar').style.width = 
        Math.min(100, gameState.health / gameState.maxHealth * 100) + '%';
    document.getElementById('xp-bar').style.width = 
        Math.min(100, gameState.xp / gameState.xpToLevel * 100) + '%';
    document.getElementById('level').textContent = gameState.level;
    document.getElementById('kills').textContent = gameState.kills;
    document.getElementById('score').textContent = gameState.score;
    
    // Arena info with tiered waves
    const arenaConfig = ARENA_CONFIG.arenas[Math.min(gameState.currentArena, 6)];
    const maxWaves = getArenaWaves(gameState.currentArena);
    document.getElementById('arena-num').textContent = gameState.currentArena;
    document.getElementById('arena-name').textContent = arenaConfig.name;
    document.getElementById('wave-num').textContent = gameState.currentWave;
    document.getElementById('waves-total').textContent = maxWaves;
    
    // Timer
    const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
    document.getElementById('timer').textContent = 
        Math.floor(elapsed / 60) + ':' + (elapsed % 60).toString().padStart(2, '0');
    
    // Update badge display
    updateStatBadges();
    updateBadgeDisplay();
}

// Update badge panel in HUD
export function updateBadgeDisplay() {
    const badgePanel = document.getElementById('badge-panel');
    if (!badgePanel) return;
    
    const hudBadges = getHudBadges();
    badgePanel.innerHTML = '';
    
    for (const badge of hudBadges) {
        const badgeEl = document.createElement('div');
        badgeEl.className = 'badge-icon' + (badge.active ? ' active' : '');
        badgeEl.textContent = badge.icon;
        badgeEl.title = badge.name + ': ' + badge.description;
        badgeEl.style.borderColor = badge.active ? badge.color : '#333';
        badgePanel.appendChild(badgeEl);
    }
}

// Update mastery badges (persistent arena badges)
export function updateMasteryDisplay() {
    const masteryPanel = document.getElementById('mastery-panel');
    if (!masteryPanel) return;
    
    const masteryBadges = getMasteryBadges();
    masteryPanel.innerHTML = '';
    
    for (const badge of masteryBadges) {
        const badgeEl = document.createElement('div');
        badgeEl.className = 'mastery-badge' + (badge.unlocked ? ' unlocked' : '');
        badgeEl.innerHTML = `
            <span class="mastery-icon">${badge.icon}</span>
            <span class="mastery-name">${badge.name}</span>
        `;
        badgeEl.title = badge.description;
        masteryPanel.appendChild(badgeEl);
    }
}

export function showWaveAnnouncement() {
    const el = document.getElementById('wave-announcement');
    const arenaConfig = ARENA_CONFIG.arenas[Math.min(gameState.currentArena, 6)];
    el.querySelector('.wave-text').textContent = 'WAVE ' + gameState.currentWave;
    el.querySelector('.arena-text').textContent = 'Arena ' + gameState.currentArena + ' - ' + arenaConfig.name;
    
    // Show wave preview (threat level and enemy types)
    showWavePreview();
    
    el.classList.add('visible');
}

// Skip announcement when player clicks
export function skipAnnouncement() {
    if (gameState.announcementPaused) {
        // Set timer high to trigger immediate transition
        gameState.waveTimer = 9999;
        gameState.announcementPaused = false;
        
        // Hide announcements immediately
        hideWaveAnnouncement();
        hideBossAnnouncement();
        const unlockEl = document.getElementById('unlock-notification');
        if (unlockEl) unlockEl.classList.remove('visible');
    }
}

// Initialize announcement click handlers
export function initAnnouncementSkip() {
    const waveAnnouncement = document.getElementById('wave-announcement');
    const unlockNotification = document.getElementById('unlock-notification');
    
    if (waveAnnouncement) {
        waveAnnouncement.addEventListener('click', skipAnnouncement);
    }
    if (unlockNotification) {
        unlockNotification.addEventListener('click', skipAnnouncement);
    }
}

// Show START banner after intro cinematic
export function showStartBanner() {
    const el = document.getElementById('start-banner');
    if (el) {
        el.classList.add('visible');
        setTimeout(() => el.classList.remove('visible'), 1500);
    }
}

// Show wave threat level, enemy types, and modifier
function showWavePreview() {
    // Get DOM elements with null checks
    const previewEl = document.getElementById('wave-preview');
    const threatEl = document.getElementById('wave-threat');
    const iconsEl = document.getElementById('wave-enemy-icons');
    const modifierEl = document.getElementById('wave-modifier');
    
    // Early return if critical elements missing
    if (!previewEl || !threatEl || !iconsEl) return;
    
    // Show the preview container
    previewEl.style.display = 'block';
    
    const maxWaves = getArenaWaves(gameState.currentArena);
    const isLessonWave = (gameState.currentWave === 1);
    const isExamWave = (gameState.currentWave === maxWaves);
    const arenaConfig = ARENA_CONFIG.arenas[gameState.currentArena];
    
    // Calculate threat level
    const threatLevel = calculateThreatLevel(isLessonWave, isExamWave);
    threatEl.textContent = threatLevel.toUpperCase() + ' THREAT';
    threatEl.className = `threat-${threatLevel}`;
    
    // Show enemy type icons
    const enemyPool = gameState.waveEnemyPool || [arenaConfig?.lessonEnemy || 'grunt'];
    
    let iconsHtml = '';
    const displayTypes = enemyPool.slice(0, 4); // Max 4 icons
    
    displayTypes.forEach(typeName => {
        const typeData = ENEMY_TYPES[typeName];
        if (typeData) {
            const color = typeData.color.toString(16).padStart(6, '0');
            iconsHtml += `<div class="enemy-icon" style="background-color: #${color};" title="${typeData.name}"></div>`;
        }
    });
    
    iconsEl.innerHTML = iconsHtml;
    
    // Show modifier if any
    if (modifierEl) {
        if (gameState.waveModifier && WAVE_MODIFIERS[gameState.waveModifier]) {
            modifierEl.textContent = WAVE_MODIFIERS[gameState.waveModifier].name;
            modifierEl.style.display = 'block';
        } else {
            modifierEl.style.display = 'none';
        }
    }
}

// Calculate threat level based on wave type and arena
function calculateThreatLevel(isLessonWave, isExamWave) {
    if (isLessonWave) return 'low';
    
    const arena = gameState.currentArena;
    const wave = gameState.currentWave;
    const maxWaves = getArenaWaves(arena);
    const waveProgress = wave / maxWaves;
    
    if (isExamWave) {
        return arena >= 5 ? 'extreme' : 'high';
    }
    
    if (waveProgress > 0.7 || arena >= 5) {
        return 'high';
    }
    
    if (waveProgress > 0.4 || arena >= 3) {
        return 'medium';
    }
    
    return 'low';
}

export function hideWaveAnnouncement() {
    document.getElementById('wave-announcement').classList.remove('visible');
}

export function showBossAnnouncement() {
    const el = document.getElementById('wave-announcement');
    el.querySelector('.wave-text').textContent = 'BOSS INCOMING';
    el.querySelector('.arena-text').textContent = BOSS_CONFIG[Math.min(gameState.currentArena, 6)].name;
    
    // Hide wave preview for boss announcement
    document.getElementById('wave-preview').style.display = 'none';
    el.classList.add('visible');
}

export function hideBossAnnouncement() {
    document.getElementById('wave-announcement').classList.remove('visible');
}

export function showBossHealthBar(name) {
    document.getElementById('boss-name').textContent = name;
    document.getElementById('boss-health-container').style.display = 'block';
    document.getElementById('boss-phase').textContent = 'PHASE I';
    document.getElementById('boss-phase').className = '';
    document.getElementById('boss-shield-container').style.display = 'none';
    document.getElementById('boss-exposed').style.display = 'none';
}

export function updateBossHealthBar() {
    const currentBoss = getCurrentBoss();
    if (!currentBoss) return;
    
    // Health bar
    const healthBar = document.getElementById('boss-health-bar');
    healthBar.style.width = (currentBoss.health / currentBoss.maxHealth * 100) + '%';
    
    // Lock icon and blue tint when shielded
    const lockIcon = document.getElementById('boss-shield-lock-icon');
    if (currentBoss.shieldConfig && currentBoss.shieldActive) {
        healthBar.classList.add('shielded');
        if (lockIcon) lockIcon.style.display = 'block';
    } else {
        healthBar.classList.remove('shielded');
        if (lockIcon) lockIcon.style.display = 'none';
    }
    
    // Phase indicator
    const phaseEl = document.getElementById('boss-phase');
    const phaseNames = ['PHASE I', 'PHASE II', 'PHASE III'];
    phaseEl.textContent = phaseNames[currentBoss.phase - 1] || 'PHASE I';
    phaseEl.className = currentBoss.phase > 1 ? `phase-${currentBoss.phase}` : '';
    
    // Shield status
    const shieldContainer = document.getElementById('boss-shield-container');
    const exposedEl = document.getElementById('boss-exposed');
    
    if (currentBoss.shieldConfig && currentBoss.shieldActive) {
        shieldContainer.style.display = 'block';
        exposedEl.style.display = 'none';
        
        // Show minion count with max
        const minionCount = currentBoss.summonedMinions ? currentBoss.summonedMinions.length : 0;
        const maxMinions = currentBoss.phase + 1;  // 2/3/4 based on phase
        document.getElementById('boss-minion-count').textContent = `${minionCount}/${maxMinions} minions`;
        
        // Shield bar visual (based on minion count)
        const shieldPercent = Math.min(100, (minionCount / maxMinions) * 100);
        document.getElementById('boss-shield-bar').style.width = shieldPercent + '%';
        
        // Pulsing border when 1 minion left
        if (minionCount === 1) {
            shieldContainer.style.animation = 'shield-pulse 0.5s infinite';
        } else {
            shieldContainer.style.animation = 'none';
        }
        
    } else if (currentBoss.isExposed) {
        shieldContainer.style.display = 'none';
        exposedEl.style.display = 'block';
        
        // Show countdown
        const secondsLeft = Math.ceil(currentBoss.exposedTimer / 60);
        exposedEl.textContent = `EXPOSED! (${secondsLeft}s)`;
        
    } else {
        shieldContainer.style.display = 'none';
        exposedEl.style.display = 'none';
    }
}

export function hideBossHealthBar() {
    document.getElementById('boss-health-container').style.display = 'none';
    // Also hide chain indicator
    const chainEl = document.getElementById('boss-combo-indicator');
    if (chainEl) chainEl.style.display = 'none';
    // Also hide sequence preview
    const seqEl = document.getElementById('boss6-sequence-preview');
    if (seqEl) seqEl.style.display = 'none';
}

export function showUnlockNotification(text) {
    const el = document.getElementById('unlock-notification');
    document.getElementById('unlock-text').textContent = text;
    el.classList.add('visible');
    setTimeout(() => el.classList.remove('visible'), 3000);
}

// Tutorial callouts (shown only once per mechanic)
const tutorialShown = {
    shield: false,
    bossShield: false,
    exposed: false,
    pillarPolice: false,
    teleporter: false,
    burrow: false
};

export function showTutorialCallout(type, text, duration = 2000) {
    if (tutorialShown[type]) return;
    tutorialShown[type] = true;
    
    const el = document.getElementById('unlock-notification');
    document.getElementById('unlock-text').textContent = text;
    el.classList.add('visible');
    setTimeout(() => el.classList.remove('visible'), duration);
}

export function showExposedBanner() {
    const el = document.getElementById('unlock-notification');
    document.getElementById('unlock-text').textContent = '⚡ EXPOSED ⚡';
    el.classList.add('visible');
    el.style.backgroundColor = 'rgba(255, 221, 68, 0.9)';
    el.style.color = '#000';
    setTimeout(() => {
        el.classList.remove('visible');
        el.style.backgroundColor = '';
        el.style.color = '';
    }, 1000);
}

// Show combo chain indicator
export function showChainIndicator() {
    const el = document.getElementById('boss-combo-indicator');
    if (el) {
        el.style.display = 'block';
    }
}

// Hide combo chain indicator
export function hideChainIndicator() {
    const el = document.getElementById('boss-combo-indicator');
    if (el) {
        el.style.display = 'none';
    }
}

// Boss 6 P3: Show sequence preview (upcoming abilities)
const ABILITY_ICONS = {
    charge: '⚡',
    teleport: '✨',
    burrow: '🕳️',
    jumpSlam: '💥',
    hazards: '☢️',
    growth: '🌿',
    summon: '👥',
    split: '✂️'
};

export function showBoss6SequencePreview(abilities) {
    const container = document.getElementById('boss6-sequence-preview');
    if (!container) return;
    
    container.style.display = 'flex';
    container.innerHTML = '';
    
    abilities.forEach((ability, index) => {
        const icon = document.createElement('div');
        icon.className = 'sequence-icon';
        icon.textContent = ABILITY_ICONS[ability] || '?';
        icon.title = ability.toUpperCase();
        
        // First ability is highlighted
        if (index === 0) {
            icon.classList.add('current');
        }
        
        container.appendChild(icon);
    });
    
    // First-time tooltip
    if (!window.boss6SequenceShown) {
        window.boss6SequenceShown = true;
        const tooltip = document.createElement('div');
        tooltip.className = 'sequence-tooltip';
        tooltip.textContent = 'INCOMING ATTACKS →';
        container.insertBefore(tooltip, container.firstChild);
        setTimeout(() => tooltip.remove(), 3000);
    }
}

export function hideBoss6SequencePreview() {
    const container = document.getElementById('boss6-sequence-preview');
    if (container) {
        container.style.display = 'none';
    }
}

// Show wave modifier announcement
export function showModifierAnnouncement(modifierName) {
    const el = document.getElementById('unlock-notification');
    document.getElementById('unlock-text').textContent = modifierName;
    el.style.background = 'linear-gradient(135deg, rgba(255, 136, 68, 0.9), rgba(255, 68, 68, 0.9))';
    el.classList.add('visible');
    setTimeout(() => {
        el.classList.remove('visible');
        el.style.background = '';
    }, 6000);  // 3x longer (was 2000ms)
}

// Show boss phase transition announcement
export function showPhaseAnnouncement(phase, bossName) {
    const el = document.getElementById('unlock-notification');
    const phaseText = phase === 2 ? 'PHASE II' : 'PHASE III';
    document.getElementById('unlock-text').textContent = `${bossName} - ${phaseText}`;
    el.style.background = phase === 3 
        ? 'linear-gradient(135deg, rgba(255, 68, 68, 0.9), rgba(180, 0, 0, 0.9))'
        : 'linear-gradient(135deg, rgba(255, 170, 68, 0.9), rgba(255, 100, 0, 0.9))';
    el.classList.add('visible');
    setTimeout(() => {
        el.classList.remove('visible');
        el.style.background = '';
    }, 1500);
}

// ==================== BOSS 6 CYCLE INDICATOR ====================

// Cycle colors for UI (RGB hex values)
const CYCLE_COLORS = {
    'MOVEMENT': '#ff4444',     // Red
    'AREA CONTROL': '#44ff44', // Green
    'SUMMONS': '#4444ff'       // Blue
};

// Show Boss 6 ability cycle announcement (brief flash when cycle changes)
export function showBoss6CycleAnnouncement(cycleName) {
    const el = document.getElementById('cycle-announcement');
    if (!el) return;
    
    const color = CYCLE_COLORS[cycleName] || '#ffffff';
    el.textContent = `CYCLE: ${cycleName}`;
    el.style.color = color;
    el.style.textShadow = `0 0 10px ${color}, 0 0 20px ${color}`;
    el.classList.add('visible');
    
    setTimeout(() => {
        el.classList.remove('visible');
    }, 1500);
}

// Update Boss 6 persistent cycle indicator
export function updateBoss6CycleIndicator(cycleName, cycleColor) {
    const el = document.getElementById('boss-cycle-indicator');
    if (!el) return;
    
    const color = CYCLE_COLORS[cycleName] || '#ffffff';
    el.textContent = cycleName;
    el.style.color = color;
    el.style.borderColor = color;
    el.style.display = 'block';
}

// Hide Boss 6 cycle indicator (call on boss death or arena change)
export function hideBoss6CycleIndicator() {
    const el = document.getElementById('boss-cycle-indicator');
    if (el) {
        el.style.display = 'none';
    }
    const announcement = document.getElementById('cycle-announcement');
    if (announcement) {
        announcement.classList.remove('visible');
    }
}

// Show badge unlock notification
export function showBadgeUnlock(badge) {
    const el = document.getElementById('badge-unlock');
    if (!el) return;
    
    document.getElementById('badge-unlock-icon').textContent = badge.icon;
    document.getElementById('badge-unlock-name').textContent = badge.name;
    document.getElementById('badge-unlock-desc').textContent = badge.description;
    el.classList.add('visible');
    setTimeout(() => el.classList.remove('visible'), 4000);
}

export function showGameOver() {
    const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
    document.getElementById('final-time').textContent = 
        Math.floor(elapsed / 60) + ':' + (elapsed % 60).toString().padStart(2, '0');
    document.getElementById('final-arena').textContent = gameState.currentArena;
    document.getElementById('final-level').textContent = gameState.level;
    document.getElementById('final-kills').textContent = gameState.kills;
    document.getElementById('final-score').textContent = gameState.score;
    
    // Show death recap
    showDeathRecap();
    
    // Show combat recap
    showCombatRecap();
    
    document.getElementById('game-over').style.display = 'block';
}

// Display death recap with recent damage and tips
function showDeathRecap() {
    const recentDamage = getRecentDamage(5);
    const listEl = document.getElementById('death-recap-list');
    const tipEl = document.getElementById('death-tip');
    
    if (!listEl || !tipEl) return;
    
    // Clear existing content
    listEl.innerHTML = '';
    
    if (!recentDamage || recentDamage.length === 0) {
        const emptyEntry = document.createElement('div');
        emptyEntry.className = 'death-entry';
        const sourceSpan = document.createElement('span');
        sourceSpan.className = 'source';
        sourceSpan.textContent = 'No damage recorded';
        emptyEntry.appendChild(sourceSpan);
        listEl.appendChild(emptyEntry);
        tipEl.textContent = 'Keep moving and stay alert!';
        return;
    }
    
    // Build damage list using safe DOM manipulation
    const killingBlowIndex = recentDamage.length - 1;
    
    recentDamage.forEach((entry, i) => {
        const isKillingBlow = (i === killingBlowIndex);
        
        const entryDiv = document.createElement('div');
        entryDiv.className = 'death-entry' + (isKillingBlow ? ' killing-blow' : '');
        
        // Source span - use textContent to prevent XSS
        const sourceSpan = document.createElement('span');
        sourceSpan.className = 'source';
        sourceSpan.textContent = entry.source;
        entryDiv.appendChild(sourceSpan);
        
        // Damage info container
        const infoSpan = document.createElement('span');
        
        const amountSpan = document.createElement('span');
        amountSpan.className = 'amount';
        amountSpan.textContent = `-${entry.amount} HP`;
        infoSpan.appendChild(amountSpan);
        
        if (isKillingBlow) {
            const fatalSpan = document.createElement('span');
            fatalSpan.className = 'fatal';
            fatalSpan.textContent = 'FATAL';
            infoSpan.appendChild(fatalSpan);
        }
        
        entryDiv.appendChild(infoSpan);
        listEl.appendChild(entryDiv);
    });
    
    // Show contextual tip based on killing blow
    const killingBlow = recentDamage[killingBlowIndex];
    const tip = getDeathTip(killingBlow.source);
    tipEl.textContent = tip;
}

// Display combat statistics and performance grade
function showCombatRecap() {
    const stats = gameState.combatStats || {};
    const gridEl = document.getElementById('combat-stats-grid');
    const gradeEl = document.getElementById('performance-grade');
    
    // Calculate stats
    const damageDealt = Math.round(stats.damageDealt || 0);
    const damageTaken = Math.round(stats.damageTaken || 0);
    const perfectWaves = stats.perfectWaves || 0;
    const bossesDefeated = stats.bossesDefeated || 0;
    const totalKills = Object.values(stats.kills || {}).reduce((a, b) => a + b, 0);
    
    // Calculate efficiency (damage dealt / damage taken)
    const efficiency = damageTaken > 0 ? (damageDealt / damageTaken).toFixed(1) : 'Perfect';
    
    // Build stats grid
    gridEl.innerHTML = `
        <div class="stat-item"><span class="label">Damage Dealt</span><span class="value">${damageDealt.toLocaleString()}</span></div>
        <div class="stat-item"><span class="label">Damage Taken</span><span class="value">${damageTaken.toLocaleString()}</span></div>
        <div class="stat-item"><span class="label">Kills</span><span class="value">${totalKills}</span></div>
        <div class="stat-item"><span class="label">Efficiency</span><span class="value">${efficiency}x</span></div>
        <div class="stat-item"><span class="label">Perfect Waves</span><span class="value">${perfectWaves}</span></div>
        <div class="stat-item"><span class="label">Bosses Defeated</span><span class="value">${bossesDefeated}</span></div>
    `;
    
    // Calculate performance grade
    const grade = calculatePerformanceGrade(stats);
    gradeEl.textContent = `Grade: ${grade}`;
    gradeEl.className = `grade-${grade}`;
}

// Calculate performance grade based on combat stats
function calculatePerformanceGrade(stats) {
    let score = 0;
    
    // Points for arena progress
    score += gameState.currentArena * 15;
    
    // Points for bosses defeated
    score += (stats.bossesDefeated || 0) * 20;
    
    // Points for perfect waves
    score += (stats.perfectWaves || 0) * 5;
    
    // Points for efficiency (damage dealt vs taken)
    const efficiency = (stats.damageTaken || 1) > 0 
        ? (stats.damageDealt || 0) / (stats.damageTaken || 1) 
        : 10;
    score += Math.min(30, efficiency * 3);
    
    // Points for kills
    const totalKills = Object.values(stats.kills || {}).reduce((a, b) => a + b, 0);
    score += Math.min(20, totalKills * 0.2);
    
    // Determine grade
    if (score >= 100) return 'S';
    if (score >= 75) return 'A';
    if (score >= 50) return 'B';
    if (score >= 25) return 'C';
    return 'D';
}

export function hideGameOver() {
    document.getElementById('game-over').style.display = 'none';
}

export function showPauseIndicator() {
    document.getElementById('pause-indicator').style.display = 'block';
}

export function hidePauseIndicator() {
    document.getElementById('pause-indicator').style.display = 'none';
}

export function hideStartScreen() {
    document.getElementById('start-screen').style.display = 'none';
}

export function showStartScreen() {
    document.getElementById('start-screen').style.display = 'flex';
}

// Get elapsed time in seconds
export function getElapsedTime() {
    return Math.floor((Date.now() - gameStartTime) / 1000);
}

// Arena Select functions
export function showArenaSelect() {
    const screen = document.getElementById('arena-select-screen');
    if (!screen) return;
    
    // Populate arena grid
    const grid = document.getElementById('arena-grid');
    grid.innerHTML = '';
    
    const arenas = [
        { num: 1, name: 'The Training Grounds', level: 1, waves: 3, desc: 'Learn the basics' },
        { num: 2, name: 'Shields & Cover', level: 4, waves: 5, desc: 'Master shield mechanics' },
        { num: 3, name: 'Vertical Loop', level: 7, waves: 6, desc: 'Conquer verticality' },
        { num: 4, name: 'Platform Gardens', level: 10, waves: 8, desc: 'Multi-level combat' },
        { num: 5, name: 'The Labyrinth', level: 13, waves: 8, desc: 'Survive the corridors' },
        { num: 6, name: 'Chaos Realm', level: 17, waves: 10, desc: 'Ultimate challenge' }
    ];
    
    arenas.forEach(arena => {
        const card = document.createElement('div');
        card.className = 'arena-card';
        card.innerHTML = `
            <div class="arena-number">Arena ${arena.num}</div>
            <div class="arena-card-name">${arena.name}</div>
            <div class="arena-card-level">Suggested Level: ${arena.level}</div>
            <div class="arena-card-waves">${arena.waves} Waves</div>
            <div class="arena-card-desc">${arena.desc}</div>
        `;
        card.addEventListener('click', () => {
            hideArenaSelect();
            // Dispatch custom event to avoid global namespace pollution
            document.dispatchEvent(new CustomEvent('arenaSelect', { detail: { arena: arena.num } }));
        });
        grid.appendChild(card);
    });
    
    screen.style.display = 'flex';
}

export function hideArenaSelect() {
    document.getElementById('arena-select-screen').style.display = 'none';
}

// Debug menu functions
export function showDebugMenu() {
    document.getElementById('debug-screen').style.display = 'flex';
}

export function hideDebugMenu() {
    document.getElementById('debug-screen').style.display = 'none';
}
