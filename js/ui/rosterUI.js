// Character Roster UI - Dynamically displays enemies and bosses from config
import { ENEMY_TYPES } from '../config/enemies.js';
import { BOSS_CONFIG } from '../config/bosses.js';
import { STORAGE_PREFIX } from '../config/constants.js';

// LocalStorage keys
const ENCOUNTERED_ENEMIES_KEY = STORAGE_PREFIX + 'encountered_enemies';
const ENCOUNTERED_BOSSES_KEY = STORAGE_PREFIX + 'encountered_bosses';

// Encountered tracking (loaded from localStorage)
let encounteredEnemies = new Set();
let encounteredBosses = new Set();

// Current tab state
let currentTab = 'enemies';

// Convert hex color to CSS color string
function hexToColor(hex) {
    return '#' + hex.toString(16).padStart(6, '0');
}

// Load encountered characters from localStorage
export function loadEncounteredCharacters() {
    try {
        const enemiesData = localStorage.getItem(ENCOUNTERED_ENEMIES_KEY);
        const bossesData = localStorage.getItem(ENCOUNTERED_BOSSES_KEY);
        
        if (enemiesData) {
            encounteredEnemies = new Set(JSON.parse(enemiesData));
        }
        if (bossesData) {
            encounteredBosses = new Set(JSON.parse(bossesData));
        }
    } catch (e) {
        console.warn('Failed to load encountered characters:', e);
    }
}

// Save encountered characters to localStorage
export function saveEncounteredCharacters() {
    try {
        localStorage.setItem(ENCOUNTERED_ENEMIES_KEY, JSON.stringify([...encounteredEnemies]));
        localStorage.setItem(ENCOUNTERED_BOSSES_KEY, JSON.stringify([...encounteredBosses]));
    } catch (e) {
        console.warn('Failed to save encountered characters:', e);
    }
}

// Mark an enemy as encountered
export function markEnemyEncountered(enemyType) {
    if (!encounteredEnemies.has(enemyType)) {
        encounteredEnemies.add(enemyType);
        saveEncounteredCharacters();
    }
}

// Mark a boss as encountered (by arena number)
export function markBossEncountered(arenaNumber) {
    const key = String(arenaNumber);
    if (!encounteredBosses.has(key)) {
        encounteredBosses.add(key);
        saveEncounteredCharacters();
    }
}

// Get encounter status
export function isEnemyEncountered(enemyType) {
    return encounteredEnemies.has(enemyType);
}

export function isBossEncountered(arenaNumber) {
    return encounteredBosses.has(String(arenaNumber));
}

// Create a roster card for an enemy
function createEnemyCard(enemyId, enemyData) {
    const isUnlocked = encounteredEnemies.has(enemyId);
    const card = document.createElement('div');
    card.className = `roster-card ${isUnlocked ? '' : 'locked'}`;
    
    if (isUnlocked) {
        card.innerHTML = `
            <div class="roster-card-header">
                <div class="roster-sphere" style="background: ${hexToColor(enemyData.color)};"></div>
                <div class="roster-card-title">
                    <div class="roster-name">${enemyData.name}</div>
                    <div class="roster-tagline">${enemyData.tagline || ''}</div>
                </div>
                ${enemyData.minArena ? `<span class="roster-arena-badge">Arena ${enemyData.minArena}+</span>` : '<span class="roster-arena-badge">Arena 1</span>'}
            </div>
            <div class="roster-description">${enemyData.description || 'No description available.'}</div>
            <div class="roster-behavior">${enemyData.behaviorText || 'Standard enemy behavior.'}</div>
        `;
    } else {
        card.innerHTML = `
            <div class="roster-card-header">
                <div class="roster-sphere locked"></div>
                <div class="roster-card-title">
                    <div class="roster-name">???</div>
                    <div class="roster-tagline">Unknown Enemy</div>
                </div>
                ${enemyData.minArena ? `<span class="roster-arena-badge">Arena ${enemyData.minArena}+</span>` : '<span class="roster-arena-badge">Arena 1</span>'}
            </div>
            <div class="roster-locked-text">Encounter this enemy to reveal its secrets.</div>
        `;
    }
    
    return card;
}

// Create a roster card for a boss
function createBossCard(arenaNumber, bossData) {
    const isUnlocked = encounteredBosses.has(String(arenaNumber));
    const card = document.createElement('div');
    card.className = `roster-card boss ${isUnlocked ? '' : 'locked'}`;
    
    if (isUnlocked) {
        card.innerHTML = `
            <div class="roster-card-header">
                <div class="roster-sphere" style="background: ${hexToColor(bossData.color)};"></div>
                <div class="roster-card-title">
                    <div class="roster-name">${bossData.name}</div>
                    <div class="roster-tagline">${bossData.tagline || ''}</div>
                </div>
                <span class="roster-arena-badge">Arena ${arenaNumber} Boss</span>
            </div>
            <div class="roster-description">${bossData.description || 'No description available.'}</div>
            <div class="roster-behavior">${bossData.behaviorText || 'Boss-level threat.'}</div>
        `;
    } else {
        card.innerHTML = `
            <div class="roster-card-header">
                <div class="roster-sphere locked"></div>
                <div class="roster-card-title">
                    <div class="roster-name">???</div>
                    <div class="roster-tagline">Unknown Boss</div>
                </div>
                <span class="roster-arena-badge">Arena ${arenaNumber} Boss</span>
            </div>
            <div class="roster-locked-text">Defeat this boss to reveal its secrets.</div>
        `;
    }
    
    return card;
}

// Populate the roster grid based on current tab
function populateRosterGrid() {
    const grid = document.getElementById('roster-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    if (currentTab === 'enemies') {
        // Sort enemies by minArena (or 1 if not specified)
        const sortedEnemies = Object.entries(ENEMY_TYPES).sort((a, b) => {
            const arenaA = a[1].minArena || 1;
            const arenaB = b[1].minArena || 1;
            return arenaA - arenaB;
        });
        
        for (const [enemyId, enemyData] of sortedEnemies) {
            grid.appendChild(createEnemyCard(enemyId, enemyData));
        }
    } else if (currentTab === 'bosses') {
        // Bosses are already numbered by arena
        for (const [arenaNum, bossData] of Object.entries(BOSS_CONFIG)) {
            grid.appendChild(createBossCard(arenaNum, bossData));
        }
    }
    
    // Update stats display
    updateRosterStats();
}

// Update the roster stats display
function updateRosterStats() {
    const enemiesDiscovered = document.getElementById('roster-enemies-discovered');
    const enemiesTotal = document.getElementById('roster-enemies-total');
    const bossesDiscovered = document.getElementById('roster-bosses-discovered');
    const bossesTotal = document.getElementById('roster-bosses-total');
    
    if (enemiesDiscovered) enemiesDiscovered.textContent = encounteredEnemies.size;
    if (enemiesTotal) enemiesTotal.textContent = Object.keys(ENEMY_TYPES).length;
    if (bossesDiscovered) bossesDiscovered.textContent = encounteredBosses.size;
    if (bossesTotal) bossesTotal.textContent = Object.keys(BOSS_CONFIG).length;
}

// Initialize roster UI (call on page load)
export function initRosterUI() {
    // Load encountered characters from storage
    loadEncounteredCharacters();
    
    // Set up tab click handlers
    const tabs = document.querySelectorAll('.roster-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Switch content
            currentTab = tab.dataset.tab;
            populateRosterGrid();
        });
    });
    
    // Set up close button
    const closeBtn = document.getElementById('close-roster');
    if (closeBtn) {
        closeBtn.addEventListener('click', hideRosterScreen);
    }
    
    // Set up main menu roster button
    const rosterBtn = document.getElementById('roster-btn');
    if (rosterBtn) {
        rosterBtn.addEventListener('click', showRosterScreen);
    }
    
    // Set up pause menu roster button
    const pauseRosterBtn = document.getElementById('pause-roster-btn');
    if (pauseRosterBtn) {
        pauseRosterBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent click from bubbling to pause indicator
            showRosterScreen();
        });
    }
}

// Show the roster screen
export function showRosterScreen() {
    const screen = document.getElementById('roster-screen');
    if (screen) {
        screen.style.display = 'flex';
        populateRosterGrid();
    }
}

// Hide the roster screen
export function hideRosterScreen() {
    const screen = document.getElementById('roster-screen');
    if (screen) {
        screen.style.display = 'none';
    }
}

// Refresh roster (call after new encounters)
export function refreshRoster() {
    if (document.getElementById('roster-screen').style.display !== 'none') {
        populateRosterGrid();
    }
}
