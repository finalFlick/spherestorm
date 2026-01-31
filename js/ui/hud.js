import { gameState } from '../core/gameState.js';
import { getCurrentBoss } from '../core/entities.js';
import { ARENA_CONFIG } from '../config/arenas.js';
import { BOSS_CONFIG } from '../config/bosses.js';
import { WAVES_PER_ARENA } from '../config/constants.js';

export let gameStartTime = 0;

export function setGameStartTime(time) {
    gameStartTime = time;
}

export function updateUI() {
    document.getElementById('health-bar').style.width = 
        Math.min(100, gameState.health / gameState.maxHealth * 100) + '%';
    document.getElementById('xp-bar').style.width = 
        Math.min(100, gameState.xp / gameState.xpToLevel * 100) + '%';
    document.getElementById('level').textContent = gameState.level;
    document.getElementById('kills').textContent = gameState.kills;
    document.getElementById('score').textContent = gameState.score;
    
    const arenaConfig = ARENA_CONFIG.arenas[Math.min(gameState.currentArena, 6)];
    document.getElementById('arena-num').textContent = gameState.currentArena;
    document.getElementById('arena-name').textContent = arenaConfig.name;
    document.getElementById('wave-num').textContent = gameState.currentWave;
    document.getElementById('waves-total').textContent = WAVES_PER_ARENA;
    
    const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
    document.getElementById('timer').textContent = 
        Math.floor(elapsed / 60) + ':' + (elapsed % 60).toString().padStart(2, '0');
}

export function showWaveAnnouncement() {
    const el = document.getElementById('wave-announcement');
    const arenaConfig = ARENA_CONFIG.arenas[Math.min(gameState.currentArena, 6)];
    el.querySelector('.wave-text').textContent = 'WAVE ' + gameState.currentWave;
    el.querySelector('.arena-text').textContent = 'Arena ' + gameState.currentArena + ' - ' + arenaConfig.name;
    el.classList.add('visible');
}

export function hideWaveAnnouncement() {
    document.getElementById('wave-announcement').classList.remove('visible');
}

export function showBossAnnouncement() {
    const el = document.getElementById('wave-announcement');
    el.querySelector('.wave-text').textContent = 'BOSS INCOMING';
    el.querySelector('.arena-text').textContent = BOSS_CONFIG[Math.min(gameState.currentArena, 6)].name;
    el.classList.add('visible');
}

export function hideBossAnnouncement() {
    document.getElementById('wave-announcement').classList.remove('visible');
}

export function showBossHealthBar(name) {
    document.getElementById('boss-name').textContent = name;
    document.getElementById('boss-health-container').style.display = 'block';
}

export function updateBossHealthBar() {
    const currentBoss = getCurrentBoss();
    if (currentBoss) {
        document.getElementById('boss-health-bar').style.width = 
            (currentBoss.health / currentBoss.maxHealth * 100) + '%';
    }
}

export function hideBossHealthBar() {
    document.getElementById('boss-health-container').style.display = 'none';
}

export function showUnlockNotification(text) {
    const el = document.getElementById('unlock-notification');
    document.getElementById('unlock-text').textContent = text;
    el.classList.add('visible');
    setTimeout(() => el.classList.remove('visible'), 3000);
}

export function showGameOver() {
    const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
    document.getElementById('final-time').textContent = 
        Math.floor(elapsed / 60) + ':' + (elapsed % 60).toString().padStart(2, '0');
    document.getElementById('final-arena').textContent = gameState.currentArena;
    document.getElementById('final-level').textContent = gameState.level;
    document.getElementById('final-kills').textContent = gameState.kills;
    document.getElementById('final-score').textContent = gameState.score;
    document.getElementById('game-over').style.display = 'block';
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
