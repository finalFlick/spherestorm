# SPHERESTORM

A 3D arena survival game built with Three.js. Survive waves of enemies, defeat bosses, unlock new arena mechanics, and build your character through roguelike upgrades.

## Quick Start

1. Open `index.html` in a modern browser (Chrome, Firefox, Edge)
2. Click "START GAME"
3. Click the game window to lock your cursor
4. Survive!

**Note:** Must be served via HTTP for ES modules to work. Use a local server:
```bash
# Python 3
python -m http.server 8000

# Node.js
npx serve .

# VS Code
# Use "Live Server" extension
```

Then open `http://localhost:8000`

## Controls

| Input | Action |
|-------|--------|
| WASD | Move |
| SPACE | Jump |
| SHIFT | Dash (1s cooldown) |
| MOUSE | Look around |
| CLICK | Lock cursor |
| ESC | Pause |

## Game Structure

### Arenas
The game progresses through increasingly complex arenas:

1. **The Proving Grounds** - Flat, open arena for learning basics
2. **Pillar Sanctum** - Introduces pillars and cover
3. **Sky Rise** - Adds verticality (platforms, ledges)
4. **Platform Gardens** - Multi-platform combat
5. **The Labyrinth** - Tunnels and chokepoints
6. **Chaos Realm** - All mechanics combined + hazard zones

### Waves
- Each arena has 10 waves of enemies
- Enemy count and variety increase per wave
- After wave 10, a boss appears

### Bosses
Each arena boss unlocks new mechanics:
- **The Pillar Guardian** - Charges and summons minions
- **The Slime Queen** - Creates hazard zones, spawns slimes
- **The Teleporting Tyrant** - Teleports and spawns teleporters
- **The Balloon King** - Grows, spawns water balloons, splits
- **The Tunnel Wyrm** - Burrows and emerges
- **Chaos Incarnate** - Uses all boss abilities

### Enemy Types
| Type | Behavior | Min Arena |
|------|----------|-----------|
| Grunt | Chases player | 1 |
| Shooter | Ranged attacks | 1 |
| Shielded | Damage reduction | 1 |
| Fast Bouncer | Bounces off walls | 2 |
| Splitter | Splits into 3 on death | 2 |
| Shield Breaker | Rushes at player | 3 |
| Water Balloon | Grows and explodes | 3 |
| Teleporter | Teleports near player | 4 |

### Upgrades
On level up, choose from 3 random upgrades:
- Damage Up (+25%)
- Attack Speed (+20%)
- Multi Shot (+1 projectile)
- Speed Boost (+15%)
- Max Health (+25 HP)
- XP Magnet (+30% pickup range)
- XP Boost (+20% XP gain)
- Bullet Speed (+25%)

## Project Structure

```
/
├── index.html              # Game HTML/CSS
└── js/
    ├── main.js             # Entry point
    ├── config/             # Game configuration
    │   ├── constants.js    # Physics, timing, balance
    │   ├── enemies.js      # Enemy type definitions
    │   ├── arenas.js       # Arena configurations
    │   ├── bosses.js       # Boss configurations
    │   └── upgrades.js     # Upgrade definitions
    ├── core/               # Core systems
    │   ├── gameState.js    # Central state management
    │   ├── scene.js        # Three.js scene setup
    │   ├── input.js        # Input handling
    │   └── entities.js     # Shared entity arrays
    ├── entities/           # Game entities
    │   ├── player.js       # Player logic
    │   ├── enemies.js      # Enemy spawning/AI
    │   └── boss.js         # Boss spawning/AI
    ├── systems/            # Game systems
    │   ├── waveSystem.js   # Wave progression
    │   ├── projectiles.js  # Projectile handling
    │   ├── pickups.js      # XP gems, hearts
    │   └── damage.js       # Damage system
    ├── arena/              # Arena generation
    │   └── generator.js    # Procedural arena building
    ├── effects/            # Visual effects
    │   ├── trail.js        # Player trail
    │   └── particles.js    # Particle effects
    └── ui/                 # User interface
        ├── hud.js          # HUD elements
        └── menus.js        # Menus
```

## Development

### Adding New Enemy Types

Edit `js/config/enemies.js`:
```javascript
newEnemy: {
    name: 'New Enemy',
    size: 0.5,
    health: 15,
    speed: 0.03,
    damage: 10,
    color: 0xff0000,
    xpValue: 2,
    behavior: 'chase', // or custom
    spawnWeight: 20,
    minArena: 1
}
```

Then add behavior in `js/entities/enemies.js` if using custom behavior.

### Adding New Bosses

Edit `js/config/bosses.js` and add AI in `js/entities/boss.js`.

### Adjusting Balance

Key balance values in `js/config/constants.js`:
- `PLAYER_JUMP_VELOCITY` - Jump height
- `PLAYER_GRAVITY` - Fall speed
- `BOUNCE_FACTORS` - Landing bounce amounts
- `WAVES_PER_ARENA` - Waves before boss
- `HEART_DROP_CHANCE` - Healing item drop rates

## Tech Stack

- **Three.js r134** - 3D rendering (loaded via CDN)
- **ES Modules** - Native JavaScript modules
- **No build step** - Runs directly in browser

## Browser Support

- Chrome 61+
- Firefox 60+
- Safari 11+
- Edge 79+

Requires ES Modules support and Pointer Lock API.

## License

MIT
