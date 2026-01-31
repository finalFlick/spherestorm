// Leaderboard UI Management
import { 
    getLeaderboard, 
    isHighScore, 
    addScore, 
    formatTime, 
    formatDate,
    getScoreRank 
} from '../systems/leaderboard.js';
import { getMasteryBadges } from '../systems/badges.js';
import { BADGES } from '../config/badges.js';

// Show leaderboard screen
export function showLeaderboard() {
    const leaderboard = getLeaderboard();
    const container = document.getElementById('leaderboard-entries');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (leaderboard.length === 0) {
        container.innerHTML = '<div class="leaderboard-empty">No scores yet. Be the first!</div>';
    } else {
        leaderboard.forEach((entry, index) => {
            const row = document.createElement('div');
            row.className = 'leaderboard-row' + (index < 3 ? ' top-three' : '');
            
            // Get badge icons for this entry
            const badgeIcons = (entry.badges || [])
                .map(id => BADGES[id]?.icon || '')
                .join('');
            
            row.innerHTML = `
                <span class="lb-rank">#${index + 1}</span>
                <span class="lb-name">${entry.name}</span>
                <span class="lb-score">${entry.score.toLocaleString()}</span>
                <span class="lb-arena">A${entry.arena}-W${entry.wave}</span>
                <span class="lb-badges">${badgeIcons}</span>
                <span class="lb-time">${formatTime(entry.time)}</span>
            `;
            container.appendChild(row);
        });
    }
    
    document.getElementById('leaderboard-screen').style.display = 'flex';
}

// Hide leaderboard screen
export function hideLeaderboard() {
    document.getElementById('leaderboard-screen').style.display = 'none';
}

// Show high score entry form
export function showHighScoreEntry(score, arena, wave, level, time, onSubmit) {
    const rank = getScoreRank(score);
    
    document.getElementById('hs-rank').textContent = '#' + rank;
    document.getElementById('hs-score').textContent = score.toLocaleString();
    
    const input = document.getElementById('hs-name-input');
    input.value = '';
    input.focus();
    
    // Handle submit
    const submitBtn = document.getElementById('hs-submit');
    const newSubmitBtn = submitBtn.cloneNode(true);
    submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
    
    newSubmitBtn.addEventListener('click', () => {
        const name = input.value.trim() || 'AAA';
        const position = addScore(name, score, arena, wave, level, time);
        hideHighScoreEntry();
        if (onSubmit) onSubmit(position);
    });
    
    // Handle enter key
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            newSubmitBtn.click();
        }
    });
    
    document.getElementById('high-score-entry').style.display = 'flex';
}

// Hide high score entry
export function hideHighScoreEntry() {
    document.getElementById('high-score-entry').style.display = 'none';
}

// Check if current score is a high score
export function checkHighScore(score) {
    return isHighScore(score);
}

// Show mastery badges collection
export function showBadgeCollection() {
    const container = document.getElementById('badge-collection-grid');
    if (!container) return;
    
    const masteryBadges = getMasteryBadges();
    container.innerHTML = '';
    
    masteryBadges.forEach(badge => {
        const badgeEl = document.createElement('div');
        badgeEl.className = 'collection-badge' + (badge.unlocked ? ' unlocked' : ' locked');
        badgeEl.innerHTML = `
            <div class="collection-badge-icon">${badge.unlocked ? badge.icon : '?'}</div>
            <div class="collection-badge-name">${badge.unlocked ? badge.name : '???'}</div>
            <div class="collection-badge-desc">${badge.unlocked ? badge.description : 'Defeat the boss to unlock'}</div>
        `;
        container.appendChild(badgeEl);
    });
    
    document.getElementById('badge-collection').style.display = 'flex';
}

// Hide badge collection
export function hideBadgeCollection() {
    document.getElementById('badge-collection').style.display = 'none';
}
