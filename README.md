# SPHERESTORM

A 3D arcade-style arena survival game built with Three.js. Survive waves of enemies, defeat bosses that test your skills, earn badges, and compete on the local leaderboard.

## Quick Start

1. Start a local server (ES modules require HTTP):
```bash
python -m http.server 8000
# or: npx serve .
```
2. Open `http://localhost:8000`
3. Click "START GAME"
4. Click to lock cursor, then survive!

## Controls

| Input | Action |
|-------|--------|
| WASD | Move |
| SPACE | Jump |
| SHIFT | Dash (1s cooldown) |
| MOUSE | Look around |
| CLICK | Lock cursor |
| ESC | Pause |

## Game Design

### Arena Progression

Arenas teach mechanics progressively with **tiered wave counts** for faster early loops:

| Arena | Waves | New Mechanic | What You Learn |
|-------|-------|--------------|----------------|
| 1 - Training Grounds | 3 | Flat ground | Move, shoot, dodge |
| 2 - Obstacle Field | 5 | Pillars & cover | Cover management |
| 3 - Vertical Loop | 6 | Platforms & ramps | Z-axis awareness |
| 4 - Platform Gardens | 8 | Multi-level terrain | Height advantage |
| 5 - The Labyrinth | 8 | Tunnel walls | Corridor pressure |
| 6 - Chaos Realm | 10 | Hazard zones | Everything combined |

### Boss Fights

Bosses are **puzzle tests** of learned mechanics, not just damage sponges:

- **The Pillar Guardian** - Charges and summons; tests dodging
- **The Slime Queen** - Creates hazard pools; tests positioning
- **The Teleporting Tyrant** - Warps around; tests prediction
- **The Balloon King** - Grows and splits; tests priority management
- **The Tunnel Wyrm** - Burrows underground; tests awareness
- **Chaos Incarnate** - Uses all abilities; tests adaptation

### Badge System

**Stat Badges** (earned during run):
- ⚡ Rapid Fire - Fast attack speed
- 🎯 Multi-Shot - Multiple projectiles
- ⚔️ Power Shot - High damage
- 👟 Speedster - Fast movement
- ❤️ Tank - High health
- And more...

**Arena Mastery Badges** (persistent):
- 🏆 Initiate - Beat Arena 1 boss
- 🛡️ Bulwark Breaker - Beat Arena 2 boss
- ⬆️ Ascension Adept - Beat Arena 3 boss
- 👑 Platform Knight - Beat Arena 4 boss
- 🌀 Maze Runner - Beat Arena 5 boss
- 💀 Chaos Conqueror - Beat Arena 6 boss

### Local Leaderboard

- Top 10 scores saved locally
- Tracks score, arena reached, badges earned, time
- High score entry with 3-character name
- Viewable from main menu

## Project Structure

```
/
├── index.html              # Game HTML/CSS
└── js/
    ├── main.js             # Entry point
    ├── config/             # Game configuration
    │   ├── arenas.js       # Arena definitions with lore
    │   ├── badges.js       # Badge definitions
    │   ├── bosses.js       # Boss configurations
    │   ├── constants.js    # Physics, timing
    │   ├── enemies.js      # Enemy types
    │   ├── leaderboard.js  # Leaderboard config
    │   └── upgrades.js     # Upgrade definitions
    ├── core/               # Core systems
    │   ├── entities.js     # Shared entity arrays
    │   ├── gameState.js    # Central state
    │   ├── input.js        # Input handling
    │   └── scene.js        # Three.js scene
    ├── entities/           # Game entities
    │   ├── boss.js         # Boss spawning/AI
    │   ├── enemies.js      # Enemy spawning/AI
    │   └── player.js       # Player logic
    ├── systems/            # Game systems
    │   ├── badges.js       # Badge tracking
    │   ├── damage.js       # Damage system
    │   ├── leaderboard.js  # Score persistence
    │   ├── pickups.js      # XP gems, hearts
    │   ├── projectiles.js  # Projectile handling
    │   └── waveSystem.js   # Wave progression
    ├── arena/              # Arena generation
    │   └── generator.js    # Procedural building
    ├── effects/            # Visual effects
    │   ├── particles.js    # Particle effects
    │   └── trail.js        # Player trail
    └── ui/                 # User interface
        ├── hud.js          # HUD elements
        ├── leaderboardUI.js # Leaderboard display
        └── menus.js        # Menus
```

## Development

### Adding New Content

See `.cursorrules` for detailed guidance on:
- Adding new enemy types
- Creating new bosses
- Designing new arenas
- Adding badges

### Key Balance Values

In `js/config/`:
- `arenas.js` - Wave counts per arena
- `enemies.js` - Enemy stats and spawn weights
- `bosses.js` - Boss health and damage
- `badges.js` - Badge unlock thresholds

### Design Principles

1. **Progressive Complexity** - Each arena teaches one new thing
2. **Boss Puzzles** - Bosses test skills, not patience
3. **Fast Loops** - Short early arenas reduce friction
4. **Visual Progression** - Badges show growth
5. **Local Competition** - Leaderboards drive replay

## Tech Stack

- **Three.js r134** - 3D rendering (CDN)
- **ES Modules** - Native JavaScript modules
- **LocalStorage** - Score/badge persistence
- **No build step** - Runs directly in browser

## Browser Support

- Chrome 61+
- Firefox 60+
- Safari 11+
- Edge 79+

## License

MIT
