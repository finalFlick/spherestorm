import { gameState } from '../core/gameState.js';
import { getCurrentBoss } from '../core/entities.js';
import { ARENA_CONFIG, getArenaWaves } from '../config/arenas.js';
import { BOSS_CONFIG } from '../config/bosses.js';
import { ENEMY_TYPES } from '../config/enemies.js';
import { THREAT_BUDGET, WAVE_MODIFIERS, WAVE_STATE, STORAGE_PREFIX } from '../config/constants.js';
import { getHudBadges, getMasteryBadges, updateStatBadges } from '../systems/badges.js';
import { getRecentDamage, getDeathTip } from '../systems/damage.js';
import { MODULE_CONFIG } from '../config/modules.js';
import { safeLocalStorageGet, safeLocalStorageSet } from '../utils/storage.js';
import { keys } from '../core/input.js';
import { getDashStrikeCooldownProgress } from '../entities/player.js';

export let gameStartTime = 0;

// Module-local state (replaces window globals for cleaner namespace)
let boss6SequenceTooltipShown = false;
let bossHealthDimmed = false;
let bossHealthFlashTimer = 0;

// Controls overlay DOM cache (lazy init)
let controlsOverlayEl = null;
let controlsOverlayKeyEls = null;

export function setGameStartTime(time) {
    gameStartTime = time;
}

export function updateMusicStatusDisplay(enabled) {
    const statuses = ['music-status', 'pause-music-status'];
    statuses.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = enabled ? 'Music: ON' : 'Music: OFF';
    });
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
    
    // Lives display
    const livesEl = document.getElementById('lives-display');
    if (livesEl) {
        livesEl.textContent = 'Lives: ' + gameState.lives;
    }
    
    // Arena info with tiered waves
    const arenaConfig = ARENA_CONFIG.arenas[Math.min(gameState.currentArena, 6)];
    const maxWaves = getArenaWaves(gameState.currentArena);
    document.getElementById('arena-num').textContent = gameState.currentArena;
    document.getElementById('arena-name').textContent = arenaConfig.name;
    document.getElementById('wave-num').textContent = gameState.currentWave;
    document.getElementById('waves-total').textContent = maxWaves;
    
    // Timer
    const elapsed = Math.floor(gameState.time?.runSeconds ?? 0);
    document.getElementById('timer').textContent = 
        Math.floor(elapsed / 60) + ':' + (elapsed % 60).toString().padStart(2, '0');
    
    // Update badge display
    updateStatBadges();
    updateBadgeDisplay();
    
    // Dash hint (always visible, context-aware)
    updateDashHint();

    // Controls overlay (bottom-right keycaps)
    updateControlsOverlay();
}

function updateControlsOverlay() {
    if (!controlsOverlayEl) {
        controlsOverlayEl = document.getElementById('controls-overlay');
        controlsOverlayKeyEls = controlsOverlayEl ? controlsOverlayEl.querySelectorAll('.ctrl-key') : null;
    }

    if (!controlsOverlayEl || !controlsOverlayKeyEls) return;

    // Only show during active gameplay (hide during pause/menus)
    const shouldShow = !!(gameState.running && !gameState.paused);
    if (controlsOverlayEl.style.display !== (shouldShow ? 'block' : 'none')) {
        controlsOverlayEl.style.display = shouldShow ? 'block' : 'none';
    }

    if (!shouldShow) return;

    for (const el of controlsOverlayKeyEls) {
        const key = el.dataset.key;
        let isActive = false;

        if (key === 'Shift') {
            isActive = !!(keys['ShiftLeft'] || keys['ShiftRight']);
        } else {
            isActive = !!keys[key];
        }

        el.classList.toggle('active', isActive);
    }
}

function updateDashHint() {
    const el = document.getElementById('dash-hint');
    if (!el) return;
    
    const nextLocked = !gameState.dashStrikeEnabled;
    if (gameState._dbgDashHintLocked !== nextLocked) {
        gameState._dbgDashHintLocked = nextLocked;
    }
    
    // Dash is gated behind Boss 1 module; before unlock, show locked hint
    if (gameState.dashStrikeEnabled) {
        // Check cooldown status
        const cooldownProgress = getDashStrikeCooldownProgress();
        
        if (cooldownProgress < 1) {
            // On cooldown - show progress
            const cooldownPct = Math.floor(cooldownProgress * 100);
            el.textContent = `SHIFT: DASH (${cooldownPct}%)`;
            el.style.opacity = '0.6';
        } else {
            // Ready
            el.textContent = 'SHIFT: DASH STRIKE';
            el.style.opacity = '1';
        }
        el.classList.remove('locked');
    } else {
        // Keep this accurate for Arena 1: dash is not available yet
        el.textContent = 'SHIFT: DASH (LOCKED)';
        el.classList.add('locked');
        el.style.opacity = '0.5';
    }
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
    const el = document.getElementById('wave-announcement');
    if (el) el.classList.remove('visible');
}

export function showBossAnnouncement() {
    const el = document.getElementById('wave-announcement');
    if (!el) return;
    
    const waveText = el.querySelector('.wave-text');
    const arenaText = el.querySelector('.arena-text');
    if (waveText) waveText.textContent = 'BOSS INCOMING';
    if (arenaText) arenaText.textContent = BOSS_CONFIG[Math.min(gameState.currentArena, 6)].name;
    
    // Hide wave preview for boss announcement
    const preview = document.getElementById('wave-preview');
    if (preview) preview.style.display = 'none';
    el.classList.add('visible');
}

export function hideBossAnnouncement() {
    const el = document.getElementById('wave-announcement');
    if (el) el.classList.remove('visible');
}

export function showBossHealthBar(name) {
    const nameEl = document.getElementById('boss-name');
    const containerEl = document.getElementById('boss-health-container');
    const phaseEl = document.getElementById('boss-phase');
    const shieldEl = document.getElementById('boss-shield-container');
    const exposedEl = document.getElementById('boss-exposed');
    
    if (nameEl) nameEl.textContent = name;
    if (containerEl) containerEl.style.display = 'block';
    if (phaseEl) {
        phaseEl.textContent = 'PHASE I';
        phaseEl.className = '';
    }
    if (shieldEl) shieldEl.style.display = 'none';
    if (exposedEl) exposedEl.style.display = 'none';
    
    ensureBossHealthExtras();
}

function ensureBossHealthExtras() {
    const bg = document.getElementById('boss-health-bar-bg');
    if (bg && !document.getElementById('boss-phase-marker-66')) {
        const m66 = document.createElement('div');
        m66.id = 'boss-phase-marker-66';
        m66.className = 'boss-phase-marker';
        bg.appendChild(m66);
    }
    if (bg && !document.getElementById('boss-phase-marker-33')) {
        const m33 = document.createElement('div');
        m33.id = 'boss-phase-marker-33';
        m33.className = 'boss-phase-marker';
        bg.appendChild(m33);
    }
}

function setBossHealthDimmed(isDimmed) {
    const container = document.getElementById('boss-health-container');
    const text = document.getElementById('boss-health-text');
    if (!container) return;
    
    if (isDimmed !== bossHealthDimmed) {
        // Flash when returning to full visibility
        if (!isDimmed) {
            container.classList.add('flash');
            bossHealthFlashTimer = 25; // ~0.4s at 60fps (timed via update calls)
        }
        bossHealthDimmed = isDimmed;
    }
    
    if (bossHealthDimmed) container.classList.add('dimmed');
    else container.classList.remove('dimmed');
    
    if (text) {
        if (bossHealthDimmed) text.classList.add('dimmed');
        else text.classList.remove('dimmed');
    }
    
    // Clear flash class after a few update calls
    if (bossHealthFlashTimer > 0) {
        bossHealthFlashTimer--;
        if (bossHealthFlashTimer <= 0) {
            container.classList.remove('flash');
        }
    }
}

function setBossHealthNumbers(health, maxHealth) {
    const hpEl = document.getElementById('boss-health-hp');
    const maxEl = document.getElementById('boss-health-max');
    if (hpEl) hpEl.textContent = Math.max(0, Math.ceil(health)).toString();
    if (maxEl) maxEl.textContent = Math.max(1, Math.ceil(maxHealth)).toString();
}

function setArena1ChasePhaseMarkers(maxHealth) {
    const chase = gameState.arena1ChaseState;
    const m66 = document.getElementById('boss-phase-marker-66');
    const m33 = document.getElementById('boss-phase-marker-33');
    if (!chase || !m66 || !m33 || !maxHealth) return;
    
    const t1 = chase.phaseThresholds?.[1] ?? null;
    const t2 = chase.phaseThresholds?.[2] ?? null;
    if (typeof t1 !== 'number' || typeof t2 !== 'number') return;
    
    const p66 = Math.max(0, Math.min(100, (t1 / maxHealth) * 100));
    const p33 = Math.max(0, Math.min(100, (t2 / maxHealth) * 100));
    m66.style.left = `${p66}%`;
    m33.style.left = `${p33}%`;
    
    // Only show markers during Arena 1 chase mode
    m66.style.display = 'block';
    m33.style.display = 'block';
}

function hideArena1ChasePhaseMarkers() {
    const m66 = document.getElementById('boss-phase-marker-66');
    const m33 = document.getElementById('boss-phase-marker-33');
    if (m66) m66.style.display = 'none';
    if (m33) m33.style.display = 'none';
}

export function updateBossHealthBar() {
    const currentBoss = getCurrentBoss();
    const containerEl = document.getElementById('boss-health-container');
    if (!containerEl) return;
    
    ensureBossHealthExtras();
    
    // Arena 1 chase: if boss is currently offscreen (retreated), keep a dimmed persistent bar visible
    const chase = gameState.arena1ChaseState;
    const isArena1Chase = gameState.currentArena === 1 && chase?.enabled;
    const canShowPersistent =
        isArena1Chase &&
        !currentBoss &&
        chase.persistentBossHealth !== null &&
        chase.bossEncounterCount > 0 &&
        chase.bossEncounterCount < 3 &&
        (gameState.waveState === WAVE_STATE.WAVE_INTRO ||
         gameState.waveState === WAVE_STATE.WAVE_ACTIVE ||
         gameState.waveState === WAVE_STATE.WAVE_CLEAR);
    
    if (!currentBoss && !canShowPersistent) {
        return;
    }
    
    // Ensure visible when updating
    containerEl.style.display = 'block';
    
    // Health bar
    const healthBar = document.getElementById('boss-health-bar');
    
    let health = 0;
    let maxHealth = 1;
    let phase = 1;
    let shieldActive = false;
    let isExposed = false;
    let minionCount = 0;
    let maxMinions = 2;
    let shouldDim = false;
    
    if (currentBoss) {
        health = currentBoss.health;
        maxHealth = currentBoss.maxHealth;
        phase = currentBoss.phase || 1;
        shieldActive = !!(currentBoss.shieldConfig && currentBoss.shieldActive);
        isExposed = !!currentBoss.isExposed;
        minionCount = currentBoss.summonedMinions ? currentBoss.summonedMinions.length : 0;
        maxMinions = phase + 1;
        
        // Dim during retreat state for readability + persistence signaling
        shouldDim = (gameState.waveState === WAVE_STATE.BOSS_RETREAT) || !!currentBoss.isRetreating;
    } else {
        // Persistent chase UI (boss is currently absent)
        const bossCfg = BOSS_CONFIG[1];
        const nameEl = document.getElementById('boss-name');
        if (nameEl && bossCfg?.name) nameEl.textContent = bossCfg.name;
        
        maxHealth = bossCfg?.health || 1250;
        health = chase.persistentBossHealth;
        
        // Show the upcoming phase number (next encounter)
        phase = Math.min(3, (chase.bossEncounterCount || 1) + 1);
        shieldActive = false;
        isExposed = false;
        shouldDim = true;
    }
    
    if (healthBar) {
        const pct = Math.max(0, Math.min(100, (health / maxHealth) * 100));
        healthBar.style.width = pct + '%';
    }
    
    setBossHealthNumbers(health, maxHealth);
    setBossHealthDimmed(shouldDim);
    
    if (isArena1Chase) setArena1ChasePhaseMarkers(maxHealth);
    else hideArena1ChasePhaseMarkers();
    
    // Lock icon and blue tint when shielded
    const lockIcon = document.getElementById('boss-shield-lock-icon');
    if (shieldActive) {
        healthBar.classList.add('shielded');
        if (lockIcon) lockIcon.style.display = 'block';
    } else {
        healthBar.classList.remove('shielded');
        if (lockIcon) lockIcon.style.display = 'none';
    }
    
    // Phase indicator
    const phaseEl = document.getElementById('boss-phase');
    const phaseNames = ['PHASE I', 'PHASE II', 'PHASE III'];
    if (phaseEl) {
        phaseEl.textContent = phaseNames[phase - 1] || 'PHASE I';
        phaseEl.className = phase > 1 ? `phase-${phase}` : '';
    }
    
    // Shield status
    const shieldContainer = document.getElementById('boss-shield-container');
    const exposedEl = document.getElementById('boss-exposed');
    
    if (shieldActive) {
        shieldContainer.style.display = 'block';
        exposedEl.style.display = 'none';
        
        // Show minion count with max
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
        
    } else if (isExposed) {
        shieldContainer.style.display = 'none';
        exposedEl.style.display = 'block';
        
        // Show countdown
        const secondsLeft = currentBoss ? Math.ceil(currentBoss.exposedTimer / 60) : 0;
        exposedEl.textContent = `EXPOSED! (${secondsLeft}s)`;
        
    } else {
        shieldContainer.style.display = 'none';
        exposedEl.style.display = 'none';
    }
}

export function hideBossHealthBar() {
    const el = document.getElementById('boss-health-container');
    if (el) el.style.display = 'none';
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
    
    // First-time tooltip (uses module-local state instead of window global)
    if (!boss6SequenceTooltipShown) {
        boss6SequenceTooltipShown = true;
        const tooltip = document.createElement('div');
        tooltip.className = 'sequence-tooltip';
        tooltip.textContent = 'INCOMING ATTACKS →';
        container.insertBefore(tooltip, container.firstChild);
        // UI-only setTimeout is acceptable - doesn't affect game logic/timing
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

// ==================== MODULE UNLOCK BANNER ====================
// Shows when a module is unlocked or upgraded (mastery level up)

/**
 * Show module unlock/upgrade banner
 * @param {string} moduleId - The module ID (e.g., 'dashStrike', 'speedModule')
 * @param {number} level - The new mastery level (1-3)
 * @param {boolean} isUnlock - True if this is the first unlock (L1), false if upgrade
 */
export function showModuleUnlockBanner(moduleId, level, isUnlock = false) {
    const el = document.getElementById('unlock-notification');
    if (!el) return;
    
    // Get module config for display name
    const config = MODULE_CONFIG.unlockable[moduleId];
    const moduleName = config?.name || moduleId;
    const moduleIcon = config?.icon || '📦';
    
    // Build banner text
    let text;
    if (isUnlock) {
        text = `${moduleIcon} ${moduleName.toUpperCase()} UNLOCKED!`;
    } else {
        text = `${moduleIcon} ${moduleName.toUpperCase()} - MASTERY L${level}`;
    }
    
    document.getElementById('unlock-text').textContent = text;
    
    // Cyan/teal gradient for module unlocks
    el.style.background = isUnlock
        ? 'linear-gradient(135deg, rgba(0, 255, 255, 0.9), rgba(0, 180, 200, 0.9))'
        : 'linear-gradient(135deg, rgba(100, 255, 255, 0.9), rgba(0, 200, 220, 0.9))';
    el.style.color = '#000';
    
    el.classList.add('visible');
    
    // Longer display time for unlocks
    const duration = isUnlock ? 2500 : 2000;
    setTimeout(() => {
        el.classList.remove('visible');
        el.style.background = '';
        el.style.color = '';
    }, duration);
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
    const elapsed = Math.floor(gameState.time?.runSeconds ?? 0);
    document.getElementById('final-time').textContent = 
        Math.floor(elapsed / 60) + ':' + (elapsed % 60).toString().padStart(2, '0');
    document.getElementById('final-arena').textContent = gameState.currentArena;
    document.getElementById('final-level').textContent = gameState.level;
    document.getElementById('final-kills').textContent = gameState.kills;
    document.getElementById('final-score').textContent = gameState.score;
    
    // Show death recap
    showDeathRecap();
    maybeShowArena1DashTutorialOnFirstDeath();
    
    // Show combat recap
    showCombatRecap();
    
    document.getElementById('game-over').style.display = 'block';
}

function maybeShowArena1DashTutorialOnFirstDeath() {
    // One-time hint on first death in Arena 1 (persisted) to address dash discoverability
    if (gameState.currentArena !== 1) return;
    
    const key = STORAGE_PREFIX + 'tutorial_arena1_dash_first_death';
    if (safeLocalStorageGet(key, false)) return;
    safeLocalStorageSet(key, true);
    
    const tipEl = document.getElementById('death-tip');
    if (!tipEl) return;
    
    if (gameState.dashStrikeEnabled) {
        tipEl.textContent = 'Press SHIFT to dash through danger!';
    } else {
        tipEl.textContent = 'Defeat the King to unlock Dash Strike (SHIFT).';
    }
}

// Show dash tutorial on first game start (one-time)
export function showDashTutorialOnFirstStart() {
    const key = STORAGE_PREFIX + 'tutorial_dash_first_start';
    if (safeLocalStorageGet(key, false)) return;
    safeLocalStorageSet(key, true);
    
    // Show tutorial callout after a brief delay (let intro cinematic play)
    setTimeout(() => {
        if (gameState.dashStrikeEnabled) {
            showTutorialCallout('dash-first-start', 'Press SHIFT to dash through danger!', 3000);
        } else {
            showTutorialCallout('dash-first-start', 'Defeat Boss 1 to unlock Dash Strike (SHIFT)', 3000);
        }
    }, 2000);
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
    const el = document.getElementById('game-over');
    if (el) el.style.display = 'none';
}

export function showPauseIndicator() {
    const el = document.getElementById('pause-indicator');
    if (el) el.style.display = 'block';
}

export function hidePauseIndicator() {
    const el = document.getElementById('pause-indicator');
    if (el) el.style.display = 'none';
}

export function hideStartScreen() {
    const el = document.getElementById('start-screen');
    if (el) el.style.display = 'none';
}

export function showStartScreen() {
    const el = document.getElementById('start-screen');
    if (el) el.style.display = 'flex';
}

// Get elapsed time in seconds
export function getElapsedTime() {
    return Math.floor(gameState.time?.runSeconds ?? 0);
}

// Arena Select functions
export function showArenaSelect() {
    const screen = document.getElementById('arena-select-screen');
    if (!screen) return;
    
    // Populate arena grid
    const grid = document.getElementById('arena-grid');
    grid.innerHTML = '';
    
    const arenas = [
        { num: 1, name: 'The Training Grounds', level: 1, waves: 7, desc: 'Learn the basics' },
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
    const el = document.getElementById('arena-select-screen');
    if (el) el.style.display = 'none';
}

// Debug menu functions
export function showDebugMenu() {
    const el = document.getElementById('debug-screen');
    if (el) el.style.display = 'flex';
}

export function hideDebugMenu() {
    const el = document.getElementById('debug-screen');
    if (el) el.style.display = 'none';
}

// Play Again Prompt functions
export function showPlayAgainPrompt() {
    const el = document.getElementById('play-again-prompt');
    if (el) el.classList.add('visible');
}

export function hidePlayAgainPrompt() {
    const el = document.getElementById('play-again-prompt');
    if (el) el.classList.remove('visible');
}

// Feedback Overlay functions (re-exported from playtestFeedback.js for convenience)
export function showFeedbackOverlayFromHud() {
    const el = document.getElementById('feedback-overlay');
    if (el) el.classList.add('visible');
}

export function hideFeedbackOverlayFromHud() {
    const el = document.getElementById('feedback-overlay');
    if (el) el.classList.remove('visible');
}