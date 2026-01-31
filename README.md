# Megabonk 3D POC

A browser-based 3D roguelike survival game inspired by Megabonk. No installation required - just open and play!

## Play the Game

### Option 1: Open Locally
1. Download `index.html`
2. Open it in any modern browser (Chrome, Firefox, Edge, Safari)
3. Play!

### Option 2: GitHub Pages
Visit: `https://finalflick.github.io/cursor/` (after enabling GitHub Pages in repo settings)

## Controls

| Key | Action |
|-----|--------|
| **W/A/S/D** | Move |
| **SPACE** | Jump |
| **SHIFT** | Dash |
| **Mouse** | Look around |
| **Click** | Lock mouse (for camera control) |
| **ESC** | Release mouse (pauses game) |

## Gameplay

- **Survive** waves of enemies that get progressively harder
- **Auto-attack** - Your weapon fires automatically at nearby enemies
- **Collect XP gems** dropped by defeated enemies
- **Level up** and choose from random upgrades
- **Build synergies** - Stack upgrades for exponential power

## Features

- 3D third-person movement with jumping and dashing
- Automatic projectile weapon system
- Enemy spawning with progressive difficulty
- XP collection and leveling system
- Random upgrade selection on level up
- Health and damage system
- Score tracking and survival timer

## Tech Stack

- **Three.js** - 3D rendering (via CDN)
- **Vanilla JavaScript** - Game logic
- **Single HTML file** - No build step, no dependencies to install

## Game Reference

See [MEGABONK.md](./MEGABONK.md) for complete game design documentation and mechanics reference.

## Browser Compatibility

Works in all modern browsers with WebGL support:
- Chrome 80+
- Firefox 75+
- Edge 80+
- Safari 14+

## Known Limitations

- **Desktop only** - No touch/mobile controls
- **Requires internet on first load** - Three.js loaded via CDN (cached after)

---

*A simple POC demonstrating Megabonk-style gameplay mechanics in the browser.*
