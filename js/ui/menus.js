import { gameState } from '../core/gameState.js';
import { UPGRADES } from '../config/upgrades.js';
import { PulseMusic } from '../systems/pulseMusic.js';

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
    
    const shuffled = [...UPGRADES].sort(() => Math.random() - 0.5).slice(0, 3);
    
    shuffled.forEach(upgrade => {
        const card = document.createElement('div');
        card.className = 'upgrade-card';
        card.innerHTML = `
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
    if (upgrade.mult) {
        gameState.stats[upgrade.stat] *= upgrade.mult;
    } else if (upgrade.add) {
        gameState.stats[upgrade.stat] += upgrade.add;
    }
    
    if (upgrade.stat === 'maxHealth') {
        gameState.maxHealth = gameState.stats.maxHealth;
        gameState.health = Math.min(gameState.health + upgrade.add, gameState.maxHealth);
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
