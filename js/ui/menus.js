import { gameState } from '../core/gameState.js';
import { CORE_UPGRADES } from '../config/upgrades.js';
import { MODULE_CONFIG } from '../config/modules.js';
import { TUNING } from '../config/tuning.js';
import { ARENA_UPGRADE_CAPS, STAT_MAXIMUMS } from '../config/constants.js';
import { PROJECTILE_ITEMS, getActiveCombination } from '../config/items.js';
import { getModuleLevel, isModuleUnlocked } from '../systems/moduleProgress.js';
import { PulseMusic } from '../systems/pulseMusic.js';
import { updateItemHUD } from '../systems/pickups.js';

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
    
    // Add pending blueprint unlocks (chest items that need level-up to activate)
    if (gameState.blueprints && gameState.blueprints.pending && gameState.blueprints.pending.size > 0) {
        for (const blueprintId of gameState.blueprints.pending) {
            const item = PROJECTILE_ITEMS[blueprintId];
            if (item) {
                pool.push({
                    id: `unlock_${blueprintId}`,
                    name: `Activate: ${item.name.toUpperCase()}`,
                    icon: '📜',
                    desc: item.description,
                    type: 'blueprint',
                    blueprintId: blueprintId,
                    isBlueprint: true
                });
            }
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

export function showUpgradeMenuSequence() {
    if (gameState.pendingLevelUps > 0) {
        levelUp();
    }
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
    // Handle blueprint unlocks (chest items that require level-up to activate)
    if (upgrade.isBlueprint && upgrade.blueprintId) {
        const blueprintId = upgrade.blueprintId;
        
        // Initialize blueprints if needed
        if (!gameState.blueprints) {
            gameState.blueprints = {
                pending: new Set(),
                unlocked: new Set()
            };
        }
        
        // Move from pending to unlocked
        gameState.blueprints.pending.delete(blueprintId);
        gameState.blueprints.unlocked.add(blueprintId);
        
        // Add to heldItems so existing projectile code works (minimal churn)
        if (!gameState.heldItems.includes(blueprintId)) {
            gameState.heldItems.push(blueprintId);
        }
        
        // Check for combo unlock
        const combo = getActiveCombination(gameState.heldItems);
        if (combo) {
            // Show combo notification will be handled by updateItemHUD
        }
        
        // Update HUD to show active item
        updateItemHUD();
        
        document.getElementById('upgrade-menu').style.display = 'none';
        
        if (gameState.pendingLevelUps > 0) {
            levelUp();
        } else {
            gameState.paused = false;
        }
        return;
    }
    
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
        // Initialize upgrade tracking for current arena if needed
        const arena = gameState.currentArena;
        if (!gameState.upgradeCountsByArena[arena]) {
            gameState.upgradeCountsByArena[arena] = {
                damage: 0,
                attackSpeed: 0,
                moveSpeed: 0,
                maxHealth: 0,
                pickupRange: 0,
                projectileCount: 0
            };
        }
        const counts = gameState.upgradeCountsByArena[arena];
        const caps = ARENA_UPGRADE_CAPS[arena] || ARENA_UPGRADE_CAPS[6];
        
        // Check if upgrade is capped (skip modules and special abilities)
        const statName = upgrade.stat;
        if (statName && caps[statName] !== undefined) {
            if (counts[statName] >= caps[statName]) {
                // Soft-cap: reduce effect to 50% instead of blocking
                if (upgrade.mult) {
                    upgrade = { ...upgrade, mult: 1 + (upgrade.mult - 1) * 0.5 };
                } else if (upgrade.add) {
                    upgrade = { ...upgrade, add: Math.floor(upgrade.add * 0.5) };
                }
            } else {
                counts[statName]++;
            }
        }
        
        // Standard stat upgrade
        if (upgrade.mult) {
            let mult = upgrade.mult;

            // Tuning lever: scale attack speed upgrade strength without changing baseline fire rate
            if (upgrade.id === 'attackSpeed') {
                const effRaw = Number(TUNING.fireRateEffectiveness ?? 1.0);
                const eff = Math.max(0.5, Math.min(2.0, effRaw || 1.0));
                mult = 1 + (mult - 1) * eff;
            }

            gameState.stats[upgrade.stat] *= mult;
            
            // Apply hard cap (stat maximums)
            if (upgrade.stat === 'attackSpeed' && gameState.stats.attackSpeed > STAT_MAXIMUMS.attackSpeed) {
                gameState.stats.attackSpeed = STAT_MAXIMUMS.attackSpeed;
            } else if (upgrade.stat === 'moveSpeed' && gameState.stats.moveSpeed > STAT_MAXIMUMS.moveSpeed) {
                gameState.stats.moveSpeed = STAT_MAXIMUMS.moveSpeed;
            }
        } else if (upgrade.add) {
            gameState.stats[upgrade.stat] += upgrade.add;
            
            // Apply hard cap (stat maximums)
            if (upgrade.stat === 'damage' && gameState.stats.damage > STAT_MAXIMUMS.damage) {
                gameState.stats.damage = STAT_MAXIMUMS.damage;
            } else if (upgrade.stat === 'projectileCount' && gameState.stats.projectileCount > STAT_MAXIMUMS.projectileCount) {
                gameState.stats.projectileCount = STAT_MAXIMUMS.projectileCount;
            }
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
