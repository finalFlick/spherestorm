# Contributing to MantaSphere

Guidelines for contributing to the MantaSphere project.

## Sources of Truth (Read First!)

| What | Where | NOT Here |
|------|-------|----------|
| Work to do | [GitHub Issues](https://github.com/finalFlick/mantasphere/issues) | No local task files |
| Game overview | README.md | - |
| System details | docs/*.md (BOSS.md, ENEMIES.md, etc.) | - |
| Quick ideas | todo.txt → triage to Issues | Don't accumulate |

**Golden Rule:** If it's work to be done, it's a GitHub Issue. Period.

---

## Quick Start

```bash
# Clone the repo
git clone https://github.com/finalFlick/mantasphere.git
cd mantasphere

# Start local server (pick one)
python -m http.server 8000
# or
npx serve .
# or use VS Code "Live Server" extension

# Open http://localhost:8000
```

See [README.md](README.md) for full setup instructions.

---

## Branching Strategy

### The Rule

**ALL work goes to the current version branch** (e.g., `0.3.x`). No exceptions.

| Work Type | Target |
|-----------|--------|
| Features | Version branch |
| Bug fixes | Version branch |
| Doc updates | Version branch |
| Direct to main | **Never** |

### Branch Types

| Type | Pattern | Purpose |
|------|---------|---------|
| **main** | `main` | Production releases only |
| **Version** | `0.3.x`, `0.4.x` | All active development |
| **Feature/Fix** | `feat/name`, `fix/name` | Individual work items → version branch |
| **Archive** | `archive/0.3.x` | Released version branches (read-only) |

### Workflow

```bash
# 1. Find current version branch
git fetch origin
git branch -r | grep -E 'origin/[0-9]+\.[0-9]+\.x$'
# Example output: origin/0.3.x

# 2. Branch from it (not from main!)
git checkout 0.3.x && git pull
git checkout -b feat/my-feature

# 3. Work, commit, push
git push -u origin feat/my-feature

# 4. Open PR targeting the VERSION BRANCH (not main!)
```

### Releases

The AI will suggest when it's time to release. When approved:

1. Version branch merges to main
2. Version gets tagged (e.g., `v0.3.0`)
3. Old branch archived (e.g., `archive/0.3.x`)
4. New version branch created (e.g., `0.4.x`)

### One-Time Setup

Enable the pre-push hook to catch accidental pushes to main:

```bash
git config core.hooksPath .githooks
```

### Common Errors

#### "Push declined due to repository rule violations"

You tried to push to main. ALL work goes through the version branch:

```bash
# Find current version branch
git branch -r | grep -E 'origin/[0-9]+\.[0-9]+\.x$'

# Create feature branch from it
git checkout 0.3.x
git checkout -b feat/your-feature
git push origin feat/your-feature
# Open PR targeting 0.3.x (not main!)
```

---

## Tech Stack Rules

**Critical constraints** — violating these will break the game:

| Rule | Why |
|------|-----|
| **NO npm Three.js** | Three.js is loaded via CDN (`r134`). `THREE` is a global. |
| **NO build system** | Game runs directly in browser with ES Modules. |
| **NO TypeScript** | Vanilla JavaScript only. |
| **NO circular imports** | Use getter functions for cross-module state. |

See `.cursorrules` for complete development guidelines.

---

## Issue Guidelines

### Label Taxonomy

Every issue must have labels from these categories:

#### Priority (Required — pick one)
| Label | Color | When to Use |
|-------|-------|-------------|
| `priority:P0` | 🔴 `#d73a49` | Ship blocker — must fix before release |
| `priority:P1` | 🟠 `#f9826c` | High priority — next sprint |
| `priority:P2` | 🟡 `#ffd33d` | Medium — schedule when time allows |
| `priority:P3` | ⚪ `#d4d4d4` | Future/experimental — backlog |

#### Type (Required — pick one)
| Label | Color | When to Use |
|-------|-------|-------------|
| `type:feature` | 🔵 `#0366d6` | New functionality |
| `type:bug` | 🔴 `#b60205` | Something broken |
| `type:tuning` | 🟢 `#28a745` | Balance/numbers adjustment |
| `type:ux` | 🟣 `#6f42c1` | Usability/readability improvement |

#### Area (Required — at least one)
| Label | Color | System |
|-------|-------|--------|
| `area:player` | `#c5def5` | Player movement, combat, stats |
| `area:enemy` | `#c5def5` | Enemy types, AI, spawning |
| `area:boss` | `#c5def5` | Boss fights, phases, abilities |
| `area:arena` | `#c5def5` | Level geometry, hazards, transitions |
| `area:ui` | `#c5def5` | HUD, menus, screens |
| `area:meta` | `#c5def5` | Progression, leaderboards, badges |

#### Effort (Recommended)
| Label | Color | Meaning |
|-------|-------|---------|
| `effort:S` | `#bfdadc` | ~1-2 hours |
| `effort:M` | `#bfdadc` | ~1 day |
| `effort:L` | `#bfdadc` | ~2-3 days |
| `effort:XL` | `#bfdadc` | ~1 week+ |

### Issue Template

When creating issues, use this structure:

```markdown
## Summary
One sentence explaining what this is.

## Context
Why this matters. Link to playtest feedback, design docs, or related issues.

## Requirements
- [ ] Concrete task 1
- [ ] Concrete task 2
- [ ] Concrete task 3

## Acceptance Criteria
- [ ] How do we know it's done?
- [ ] What should work?
- [ ] What edge cases to test?

## Scope Boundaries
**In scope:** What we ARE doing
**Out of scope:** What we are NOT doing (prevents scope creep)

## How to Test
1. Step-by-step verification
2. Expected behavior

## Files to Touch
- `path/to/file.js` - What changes here
```

### RICE Scoring

We prioritize using RICE scoring:

| Factor | Question | Scale |
|--------|----------|-------|
| **R**each | How many players affected? | % of players |
| **I**mpact | How much does it improve experience? | 1-5 |
| **C**onfidence | How sure are we this is right? | High/Med/Low |
| **E**ffort | How long to implement? | S/M/L/XL |

**Score = (Reach × Impact × Confidence) / Effort**

Higher score = higher priority.

---

## Pull Request Process

### Branch Naming

```
type/issue#-short-description
```

Examples:
- `feat/1-lives-system`
- `fix/23-boss-stuck-corner`
- `docs/15-update-enemy-docs`

### Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | When to Use |
|--------|-------------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | Documentation only |
| `chore:` | Maintenance (deps, config) |
| `refactor:` | Code change that neither fixes nor adds |
| `perf:` | Performance improvement |

Examples:
```
feat: add lives system with 3 default lives
fix: correct boss stuck in corner after teleport
docs: update ENEMIES.md with telegraph timings
chore: bump version to 0.3.0
```

### PR Requirements

1. **Reference the issue:** Include `Closes #X` in PR description
2. **One logical change:** Don't mix unrelated changes
3. **Pass tests:** Game must start without errors
4. **Update docs:** If behavior changed, update relevant docs

### PR Checklist

Before requesting review:

- [ ] Game starts without console errors
- [ ] Player can move, shoot, and dash
- [ ] Enemies spawn and behave correctly
- [ ] No new linter warnings
- [ ] Relevant documentation updated
- [ ] No `TODO`, `FIXME`, or stub functions committed
- [ ] Tested in browser (not just code review)

---

## Project Board Workflow

Issues move through these columns:

```
Backlog → Ready → In Progress → In Review → Done
```

| Status | Meaning |
|--------|---------|
| **Backlog** | All new issues start here |
| **Ready** | Spec complete, ready to work on |
| **In Progress** | Actively being worked (limit 1-2) |
| **In Review** | PR open, awaiting review |
| **Done** | Merged and deployed |

**Rules:**
- Only have 1-2 items "In Progress" at a time
- Move to "In Review" when PR is opened
- PRs that close issues auto-move to "Done" on merge

---

## Code Style

Follow the conventions in `.cursorrules`:

- **Functions:** `camelCase`
- **Constants:** `UPPER_SNAKE_CASE`
- **Config objects:** `UPPER_SNAKE_CASE`

### Performance Rules

- Reuse `THREE.Vector3` instances (use `tempVec3`)
- Pool frequently spawned objects (projectiles, particles)
- Cache shared geometries — don't create new geometry per spawn
- Use delta time for all movement (never assume 60fps)
- Use `Date.now()` only for display — use frame counters for game logic

### Debug Logging

```javascript
import { DEBUG } from '../config/constants.js';
if (DEBUG) console.log('[System] Message');
```

- Gate all `console.log` behind `DEBUG` flag
- Keep `console.warn` for actual error conditions
- Rate-limit warnings that could spam

---

## Documentation Policy

**When changing code, update docs:**

| Code Files | Documentation |
|------------|---------------|
| `js/entities/player.js`, `js/systems/damage.js` | `docs/PLAYER.md` |
| `js/config/bosses.js`, `js/entities/boss.js` | `docs/BOSS.md` |
| `js/config/enemies.js`, `js/entities/enemies.js` | `docs/ENEMIES.md` |
| `js/config/arenas.js`, `js/arena/generator.js` | `docs/ARENA.md` |
| `js/systems/pulseMusic.js` | `docs/PULSE_MUSIC_SYSTEM.md` |

**Before committing:**
1. Search for `TODO`, `FIXME`, `STUB` — implement or remove
2. Check if your changes require doc updates

---

## Release Checklist

When shipping a new version:

1. **Close all issues** in the milestone
2. **Create a release branch:** `git checkout -b chore/release-X.Y.Z`
3. **Update CHANGELOG.md** with changes under the new version
4. **Bump version** using `node scripts/bump-version.js X.Y.Z`
5. **Commit** with `chore: bump version to X.Y.Z`
6. **Push branch and open PR**
7. **Merge after approval**
8. **Close the milestone** on GitHub
9. **Create GitHub Release** with notes from CHANGELOG.md

See [CHANGELOG.md](CHANGELOG.md) for version history.

---

## Cursor Bugbot (Optional)

PRs may receive automated reviews from [Cursor Bugbot](https://cursor.com/dashboard?tab=bugbot).

**What it does:** Auto-generates a risk assessment and change summary on PRs.

**Configuration:** https://cursor.com/dashboard?tab=bugbot

| Option | Recommended For |
|--------|-----------------|
| **Disabled** | Solo devs (you're already using Cursor for review) |
| **On-demand** | Trigger manually with `/bugbot review` comment |
| **On PR open only** | Reduce noise, only review initial submission |
| **Always on** | Teams wanting automated first-pass review |

**Note:** Bugbot runs on every push by default, which can be slow for work-in-progress PRs. Consider on-demand mode for faster iteration.

---

## Getting Help

- **Design questions:** Read `PROMPTS.md` for design personas
- **System docs:** Read `docs/*.md` for system details
- **Balance questions:** Check config files in `js/config/`
- **Task tracking:** View [GitHub Issues](https://github.com/finalFlick/mantasphere/issues)

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
