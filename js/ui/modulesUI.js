// Modules UI - Display upgrades and modules progression screen
import { CORE_UPGRADES } from '../config/upgrades.js';
import { MODULE_CONFIG } from '../config/modules.js';
import { getModuleLevel, getModuleCounter, loadModuleProgress } from '../systems/moduleProgress.js';

// Show modules screen
export function showModulesScreen() {
    loadModuleProgress(); // Ensure latest data
    
    renderCoreUpgrades();
    renderUnlockableModules();
    
    document.getElementById('modules-screen').style.display = 'flex';
}

// Hide modules screen
export function hideModulesScreen() {
    document.getElementById('modules-screen').style.display = 'none';
}

// Render core upgrades section
function renderCoreUpgrades() {
    const container = document.getElementById('core-upgrades-grid');
    if (!container) return;
    
    container.innerHTML = '';
    
    CORE_UPGRADES.forEach(upgrade => {
        const card = createCoreUpgradeCard(upgrade);
        container.appendChild(card);
    });
}

// Render unlockable modules section
function renderUnlockableModules() {
    const container = document.getElementById('unlockable-modules-grid');
    if (!container) return;
    
    container.innerHTML = '';
    
    for (const [moduleId, config] of Object.entries(MODULE_CONFIG.unlockable)) {
        const card = createModuleCard(moduleId, config);
        container.appendChild(card);
    }
}

// Create card for core upgrade
function createCoreUpgradeCard(upgrade) {
    const card = document.createElement('div');
    card.className = 'module-card core-upgrade';
    
    card.innerHTML = `
        <div class="module-icon">${upgrade.icon}</div>
        <div class="module-name">${upgrade.name}</div>
        <div class="module-status">AVAILABLE</div>
        <div class="module-tooltip">
            <div>${upgrade.desc}</div>
            <div class="tooltip-progress">Always available in level-up choices</div>
        </div>
    `;
    
    return card;
}

// Create card for unlockable module
function createModuleCard(moduleId, config) {
    const card = document.createElement('div');
    const level = getModuleLevel(moduleId);
    const isLocked = level === 0;
    
    card.className = `module-card${isLocked ? ' locked' : ''}`;
    
    if (isLocked) {
        // Locked module - show ??? with unlock hint
        const unlockHint = getUnlockHint(config);
        
        card.innerHTML = `
            <div class="module-icon">🔒</div>
            <div class="module-name">???</div>
            <div class="module-status">LOCKED</div>
            <div class="module-tooltip">
                <div class="tooltip-unlock-req">Unlock: ${unlockHint}</div>
            </div>
        `;
    } else {
        // Unlocked module - show full details
        const maxLevel = 3;
        const counterKey = getCounterKeyForSource(config.unlockSource);
        const counter = getModuleCounter(moduleId, counterKey);
        const nextLevelReq = getNextLevelRequirement(config, level);
        
        card.innerHTML = `
            <div class="module-icon">${config.icon}</div>
            <div class="module-name">${config.name}</div>
            <div class="mastery-indicator">L${level} / L${maxLevel}</div>
            <div class="module-progress">${counter} ${counterKey === 'bossKills' ? 'Boss Kills' : 'Finds'}</div>
            <div class="module-tooltip">
                ${buildUnlockedTooltip(config, level, counter, nextLevelReq)}
            </div>
        `;
    }
    
    return card;
}

// Get unlock hint text
function getUnlockHint(config) {
    if (config.unlockSource === 'boss1') {
        return 'Defeat Boss 1';
    } else if (config.unlockSource === 'exploration') {
        return 'Find hidden pickup in Arena 1';
    }
    return 'Unknown';
}

// Get next level requirement
function getNextLevelRequirement(config, currentLevel) {
    if (currentLevel >= 3) return null;
    
    const nextLevel = currentLevel + 1;
    const levelKey = `L${nextLevel}`;
    return config.masteryThresholds[levelKey];
}

// Build tooltip for unlocked module
function buildUnlockedTooltip(config, level, counter, nextLevelReq) {
    const counterType = config.unlockSource === 'boss1' ? 'boss kills' : 'finds';
    let tooltip = `<div>Current: ${config.desc[level]}</div>`;
    
    if (nextLevelReq) {
        tooltip += `
            <div class="tooltip-next-level">
                Next level: ${nextLevelReq} ${counterType} (${counter}/${nextLevelReq})
            </div>
        `;
    } else {
        tooltip += `<div class="tooltip-next-level">MAX LEVEL</div>`;
    }
    
    return tooltip;
}
