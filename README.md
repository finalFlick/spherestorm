# SPHERESTORM

A 3D arcade-style arena survival game built with Three.js. Survive waves of enemies, defeat bosses that test your skills, earn badges, and compete on the local leaderboard.

## Quick Start

### Option 1: Docker (Recommended)

```bash
docker-compose up
```
Then open http://localhost:8080

Or manually:
```bash
docker build -t spherestorm .
docker run -p 8080:80 spherestorm
```

### Option 2: Local Development

ES modules require an HTTP server. Choose one:

```bash
# Python
python -m http.server 8000

# Node.js
npx serve .

# Or use VS Code "Live Server" extension
```
Then open http://localhost:8000

### Play

1. Click "START GAME"
2. Click to lock cursor
3. Survive!

## Controls

| Input | Action |
|-------|--------|
| WASD | Move |
| SPACE | Jump |
| SHIFT | Dash (1s cooldown) |
| MOUSE | Look around |
| CLICK | Lock cursor |
| ESC | Pause |
| M | Toggle Music |

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

- **The Gatekeeper** - Charges and summons; tests dodging
- **The Monolith** - Creates hazard pools; tests positioning
- **The Ascendant** - Warps around; tests prediction
- **The Overgrowth** - Grows and splits; tests priority management
- **The Burrower** - Burrows underground; tests awareness
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

### PULSE Adaptive Music System

Procedural music that adapts to gameplay in real-time:

- **Arena Profiles** - Each arena has unique key, scale, and tempo derived from config
- **Intensity Layers** - Music layers (kick → bass → chords → melody → arpeggio) activate based on enemy count and wave progress
- **Boss Music** - Sub-bass drones, tension stabs, and chaotic fills during boss fights
- **Phase Transitions** - Music intensifies as boss health drops through phases
- **Game Events** - Wave start, wave clear, boss intro, victory, damage, and level-up stingers
- **Toggle** - Press M to enable/disable music

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
    │   ├── pulseMusic.js   # Adaptive music system
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
- **Docker** - Optional containerized deployment

## Deployment

### Docker
```bash
docker-compose up -d
```

### Static Hosting
No backend required. Deploy to any static host:
- **GitHub Pages** - Push to `gh-pages` branch
- **Netlify** - Connect repo, deploy automatically
- **Vercel** - Import project, zero config

### Notes
- Game data (scores, badges) uses LocalStorage (client-side only)
- No server-side persistence required

## Browser Support

- Chrome 61+
- Firefox 60+
- Safari 11+
- Edge 79+

## License

MIT
