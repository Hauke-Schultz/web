# Hawk-Fruit

A browser-based physics puzzle game inspired by Suika Game. Fruits fall into a box, matching fruits merge into the next larger fruit. Goal: reach the highest score before the box fills up.

---

## Game Concept

- Fruits are dropped from the top into a box (320×480px)
- Two identical fruits that touch → merge into the next larger fruit → score points
- Chain reactions build combos with animated floating texts
- Game Over: fruits stack above the danger line (y=60) and stay there
- Highscore saved in LocalStorage (`hawk3_game_data` → `games.hawkFruit`)

---

## Merge Chain (small → large)

| Index | Fruit | Radius | Score |
|-------|-------|--------|-------|
| 1 | Blueberry 🫐 | 20 | 10 |
| 2 | Strawberry 🍓 | 24 | 25 |
| 3 | Lemon 🍋 | 30 | 50 |
| 4 | Orange 🍊 | 36 | 80 |
| 5 | Apple 🍎 | 44 | 120 |
| 6 | Grapefruit | 52 | 180 |
| 7 | Pineapple 🍍 | 60 | 260 |
| 8 | Coconut 🥥 | 70 | 350 |
| 9 | Melon 🍈 | 82 | 500 |
| 10 | Dragon Fruit | 96 | 700 |
| 11 | Watermelon 🍉 | 112 | 1000 |
| 12 | Pumpkin 🎃 | 128 | 1500 |

Droppable: Index 1–5 only (Blueberry through Apple)

---

## Special Fruits

> **TODO:** All special fruits need balancing & mechanic optimization.

### Bomb Fruit 💣
- 10% spawn chance, max. 1 at a time, min. 45s cooldown
- 10s fuse timer with countdown display + explosion radius ring
- Explodes: destroys all fruits within radius (70px) → +100 bonus per fruit
- Screen shake on explosion

### Mold Fruit 🟤
- 5% spawn chance, 1 minute lifespan
- Shrinks per frame and on collision (shrink on hit)
- Never merges, disappears when minimum size is reached
- Flashes as warning in the last 20 seconds

### Rainbow Fruit 🌈
- 3% spawn chance, max. 1 at a time, min. 90s cooldown
- Can merge with any fruit type (universal merger)
- 2.5x score bonus when used in a merge
- Spawn & merge particle effects

---

## Combo System

Every merge increments the combo counter (resets after 2.5s pause).
Tiers: 1x / 3x / 5x / 8x / 12x / 15x / 20x / 30x — with random floating texts (DE + EN).

---

## Architecture

| File | Content |
|------|---------|
| `pages/games/hawkFruit/index.vue` | Full game logic + template (single file) |
| `utils/hawkFruitConfig.js` | `FRUIT_TYPES`, `PHYSICS_CONFIG`, `BOMB_FRUIT_CONFIG`, `MOLD_FRUIT_CONFIG`, `RAINBOW_FRUIT_CONFIG` |
| `utils/localStores.js` | `loadHawk3Data()`, `saveHawk3Data()` — liest/schreibt `hawk3_game_data` |

**Physics:** Matter.js (lazy-loaded via dynamic import on mount)
**Rendering:** Vue 3 + SVG data-URLs (no canvas)
**State:** All local in `index.vue` (no composable, no store)

---

## Status

## Rewards

Am Spielende werden Coins und Diamonds basierend auf dem erzielten Score gutgeschrieben:

| Währung | Formel |
|---------|--------|
| Coins | `floor(score / 20)` |
| Diamonds | `floor(score / 1000)` |

Beispiele: Score 2000 → 100 Coins, 2 Diamonds. Score 500 → 25 Coins, 0 Diamonds.
Anzeige im Game-Over-Overlay. Werden direkt in `hawk3_game_data.player` gespeichert.

---

### Done ✅
- Physics engine (Matter.js) with correct sleep/wake handling
- All 12 regular fruits with animated SVG faces (blink every 10s)
- Merge logic with combo system and particle effects (burst + ring)
- Drop preview (ghost fruit + vertical guide line)
- Next + next-next fruit display
- Bomb Fruit: fuse timer, explosion radius, screen shake
- Mold Fruit: shrinking, shrink on hit, lifespan
- Rainbow Fruit: spawn in rotation, universal merge
- Game over detection (fruits above danger line)
- Restart without page reload
- LocalStorage highscore + Stats via `hawk3_game_data` (Level 6 = Endless Mode)
- Board-Zustand wird nach jedem Drop + beim Verlassen gespeichert (Resume beim nächsten Besuch)
- Responsive touch support (mobile)
- i18n combo texts (DE/EN)
- Merge chain guide below the board

### Planned / Ideas 🔲
- Special fruit mechanic optimization (Bomb, Mold, Rainbow — balancing & visuals)
- Online leaderboard / global highscores
- Power-ups (e.g. remove a fruit from the board)
- Improved game over overlay animation
- PWA / app icon for mobile use
