import { gameState } from '../core/gameState.js';
import { CORE_UPGRADES } from '../config/upgrades.js';
import { MODULE_CONFIG } from '../config/modules.js';
import { getModuleLevel, isModuleUnlocked } from '../systems/moduleProgress.js';
import { PulseMusic } from '../systems/pulseMusic.js';

// Build the eligible upgrade pool based on core upgrades + unlocked modules
function getEligibleUpgrades() {
    const pool = [...CORE_UPGRADES];
    
    // Add unlocked modules at their current mastery level
    for (const [moduleId, config] of Object.entries(MODULE_CONFIG.unlockable)) {
        const level = getModuleLevel(moduleId);
        if (level >= 1) {
            const effects = config.effectsByLevel[level];
            pool.push({
                id: moduleId,
                name: `${config.name} L${level}`,
                icon: config.icon,
                desc: config.desc[level],
                ...effects,
                isModule: true,
                moduleLevel: level,
                isActiveAbility: config.isActiveAbility || false
            });
        }
    }
    
    return pool;
}

export function levelUp() {
    gameState.level++;
    gameState.score += 50;
    gameState.pendingLevelUps = Math.max(0, gameState.pendingLevelUps - 1);
    gameState.health = Math.min(gameState.health + 10, gameState.maxHealth);
    
    // Play level up stinger
    PulseMusic.onLevelUp();
    
    showUpgradeMenu();
}

export function showUpgradeMenu() {
    gameState.paused = true;
    document.exitPointerLock();
    
    const options = document.getElementById('upgrade-options');
    options.innerHTML = '';
    
    // Get eligible upgrades (core + unlocked modules)
    const eligiblePool = getEligibleUpgrades();
    const shuffled = [...eligiblePool].sort(() => Math.random() - 0.5).slice(0, 3);
    
    shuffled.forEach(upgrade => {
        const card = document.createElement('div');
        card.className = 'upgrade-card';
        
        // Add module indicator if it's an unlocked module
        const moduleTag = upgrade.isModule ? `<div class="upgrade-module-tag">MODULE</div>` : '';
        
        card.innerHTML = `
            ${moduleTag}
            <div class="upgrade-icon">${upgrade.icon}</div>
            <div class="upgrade-name">${upgrade.name}</div>
            <div class="upgrade-desc">${upgrade.desc}</div>
        `;
        card.addEventListener('click', () => selectUpgrade(upgrade));
        options.appendChild(card);
    });
    
    document.getElementById('upgrade-menu').style.display = 'block';
}

export function selectUpgrade(upgrade) {
    // Handle active abilities (like Dash Strike) specially
    if (upgrade.isActiveAbility) {
        // Enable the ability on the player
        if (upgrade.id === 'dashStrike') {
            gameState.dashStrikeEnabled = true;
            gameState.dashStrikeLevel = upgrade.moduleLevel;
            gameState.dashStrikeConfig = {
                distance: upgrade.dashDistance,
                cooldown: upgrade.cooldown,
                damage: upgrade.damage
            };
        }
    } else {
        // Standard stat upgrade
        if (upgrade.mult) {
            gameState.stats[upgrade.stat] *= upgrade.mult;
        } else if (upgrade.add) {
            gameState.stats[upgrade.stat] += upgrade.add;
        }
        
        if (upgrade.stat === 'maxHealth') {
            gameState.maxHealth = gameState.stats.maxHealth;
            gameState.health = Math.min(gameState.health + upgrade.add, gameState.maxHealth);
        }
    }
    
    document.getElementById('upgrade-menu').style.display = 'none';
    
    if (gameState.pendingLevelUps > 0) {
        levelUp();
    } else {
        gameState.paused = false;
    }
}

export function hideUpgradeMenu() {
    document.getElementById('upgrade-menu').style.display = 'none';
}
