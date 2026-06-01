# RunBack — Fighting Game VOD Navigator

> Spoiler-free fighting game VOD browsing and viewing.

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Data Model](#data-model)
- [Features (Current)](#features-current)
- [Spoiler-Free Design](#spoiler-free-design)
- [Views](#views)
- [Development Workflow](#development-workflow)
- [Future Features](#future-features)

---

## Overview

RunBack is a spoiler-free website for browsing and watching fighting game tournament VODs. Users can explore tournaments, search by player or character, and watch sets without having results or match length spoiled.

Primary game: **Super Smash Bros Melee** — extensible to any fighting game.

**Key principles:**

- Spoiler-free by default, with opt-in reveals
- Fast static site — no server required for browsing
- Community-driven data via start.gg backfilling
- Simple, extensible data format (JSON files)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js (static export) |
| UI | Shadcn/ui + Tailwind CSS |
| Hosting | GitHub Pages (now), Vercel (future) |
| Data | JSON files in repo, pre-built indexes |
| Tournament Data | start.gg GraphQL API (backfiller) |
| Video | YouTube embed (iframe API) |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Build Time                         │
│                                                     │
│  /data/source/*.json ──► Build Script ──► /public/  │
│                              │              ├── tournaments/        │
│                              │              ├── players/            │
│                              └──────────────├── characters/         │
│                                             └── games.json         │
│                                                     │
│  /scripts/backfill.js                               │
│       │                                             │
│       ▼                                             │
│  start.gg GraphQL API ──► /data/source/*.json       │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│                   Runtime (Static)                   │
│                                                     │
│  Next.js Static Export                              │
│  ├── /                    Game selection            │
│  ├── /[game]              Tournament list           │
│  ├── /[game]/[tournament] Bracket / set view        │
│  └── /search              Player & character search │
│                                                     │
│  Client fetches JSON from /public at runtime        │
│  YouTube iframe API for spoiler-free playback       │
└─────────────────────────────────────────────────────┘
```

### Directory Structure

```
runback/
├── data/
│   └── source/          # Raw tournament JSON (committed)
├── scripts/
│   └── backfill.js      # start.gg → JSON generator
├── src/
│   ├── app/             # Next.js app router pages
│   ├── components/      # React components (Shadcn/ui)
│   ├── lib/             # Utilities, types, constants
│   └── hooks/           # Custom React hooks
├── public/              # Built indexes (gitignored, generated)
└── docs/
    └── DESIGN.md
```

---

## Data Model

### Games

```json
{
  "id": "melee",
  "name": "Super Smash Bros. Melee",
  "slug": "melee",
  "characters": ["fox", "falco", "marth", "sheik", ...]
}
```

### Tournaments

```json
{
  "id": "genesis-x",
  "name": "Genesis X",
  "slug": "genesis-x",
  "game": "melee",
  "date": "2025-02-15",
  "location": "San Jose, CA",
  "startggSlug": "tournament/genesis-x/event/melee-singles",
  "phases": [
    { "id": "pools", "name": "Pools", "format": "round-robin" },
    { "id": "top8", "name": "Top 8", "format": "double-elimination", "size": 8 }
  ]
}
```

### Sets

```json
{
  "id": "set-001",
  "phaseId": "top8",
  "round": 1,
  "fullRoundText": "Winners Quarterfinal",
  "players": [
    { "entrantId": "p1", "gamerTag": "Zain", "characters": ["marth"] },
    { "entrantId": "p2", "gamerTag": "Cody", "characters": ["fox", "falco"] }
  ],
  "winnerId": "p1",
  "score": "3-1",
  "vodUrl": "https://youtube.com/watch?v=abc123",
  "vodStartTime": 145,
  "vodEndTime": 892
}
```

### Players

```json
{
  "id": "zain",
  "gamerTag": "Zain",
  "aliases": ["zainnaghmi"]
}
```

### Characters

```json
{
  "id": "marth",
  "name": "Marth",
  "game": "melee"
}
```

### Pre-built Indexes

Generated at build time for fast client-side search:

- `players/{tag}.json` — all sets for a player across tournaments
- `characters/{game}/{char}.json` — all sets featuring a character
- `tournaments/{game}.json` — tournament list per game

---

## Features (Current)

### 1. Browse by Game & Tournament

Homepage lists supported games. Each game page lists tournaments sorted by date (newest first).

### 2. Advanced Search

Filter sets by:
- Player name (fuzzy match against gamerTag + aliases)
- Character (select from game's roster)
- Both (player + character combination)

Results link directly to the relevant set within its tournament bracket.

### 3. Tournament Bracket View

Double-elimination bracket visualization for top 6/8/12/16. Sets displayed left-to-right (early rounds → grand finals). Spoiler-free progressive reveal (see [Spoiler-Free Design](#spoiler-free-design)).

### 4. List View

For non-bracket formats (round robin, swiss, pools): a flat list of sets grouped by round/pool.

### 5. VOD Player

Embedded YouTube with custom overlay controls:
- Play/pause
- Hidden progress bar (no scrubbing)
- Hidden duration and remaining time
- Skip forward/back buttons (±10s)
- Set-boundary awareness (auto-stop at `vodEndTime`)

### 6. Placeholder Sets

Sets without VODs show "VOD not yet available" with player/round info preserved.

### 7. Backfiller Script

```bash
node scripts/backfill.js --slug "tournament/genesis-x/event/melee-singles"
```

Queries start.gg GraphQL API → generates tournament JSON in `/data/source/`.

---

## Spoiler-Free Design

### Default Behavior (Spoiler Mode: OFF)

| Element | Behavior |
|---------|----------|
| Set winners | Hidden |
| Scores | Hidden |
| Bracket rounds beyond R1 | Player names hidden ("Winner of WQF1") |
| VOD duration | Hidden |
| VOD progress bar | Hidden |

### Progressive Bracket Reveal

1. Initial state: only Round 1 (leftmost) shows player names
2. User watches/completes a set → next round's participants revealed for that branch
3. "Mark as watched" button for sets the user has already seen elsewhere
4. Revelation cascades: watching WQF1 reveals the WSF participant from that match

### Reveal Toggle

A global toggle to show all results for users who don't care about spoilers. Persisted in localStorage.

### VOD Player Spoiler Prevention

- YouTube iframe configured with `controls=0`
- Custom overlay provides play/pause and skip only
- `vodEndTime` used to stop playback before next-set content
- No indication of total video length

---

## Views

### Game Selection (`/`)

Grid of supported games with icons/logos.

### Tournament List (`/[game]`)

Reverse-chronological list of tournaments. Each card shows: name, date, location, number of entrants.

### Tournament Detail (`/[game]/[tournament]`)

- Phase selector tabs (Pools, Top 8, etc.)
- Bracket view (double-elim phases) or list view (pools/RR/swiss)
- Spoiler toggle
- Progressive reveal state tracked per-session

### Search (`/search`)

- Game selector
- Player name input (autocomplete from index)
- Character multiselect
- Results as set cards with tournament context

### VOD Player (modal/overlay)

- Launched from a set card
- Full-width embedded YouTube
- Custom controls overlay
- "Next set" navigation within bracket context

---

## Development Workflow

### Adding a Tournament

```bash
# 1. Backfill from start.gg
node scripts/backfill.js --slug "tournament/slug/event/game-singles"

# 2. Manually add VOD URLs to generated JSON
# (vodUrl, vodStartTime, vodEndTime per set)

# 3. Rebuild indexes
npm run build:indexes

# 4. Preview
npm run dev
```

### Build & Deploy

```bash
npm run build          # Generates indexes + Next.js static export
# Output: /out (deployable to GitHub Pages)
```

### Data Validation

Build script validates all JSON against schemas before generating indexes. Missing required fields produce warnings; invalid structures fail the build.

---

## Future Features

### Community VOD Submission

Web form where users submit VOD URLs for sets missing VODs. Submissions auto-create a GitHub PR with the updated JSON. Requires GitHub OAuth for attribution.

### Bulk VOD Submission

Queue multiple VOD timestamps across sets, submit as a single PR. Useful for uploaders processing full tournament playlists.

### Tournament Submission Form

Form to add new tournaments to the database. Accepts a start.gg slug, runs backfiller server-side (Vercel API route), creates PR with generated data.

### User Accounts

- Favorites (players, tournaments)
- Watch history (tracks progressive reveals across sessions)
- Personalized homepage

### Live Tournament Support

Real-time bracket updates for in-progress tournaments via start.gg websocket/polling. Live sets highlighted; VODs added as they become available.

---

## Constraints & Decisions

| Decision | Rationale |
|----------|-----------|
| Static export first | Zero hosting cost, GitHub Pages is free |
| JSON in repo | No database needed, version-controlled data |
| Pre-built indexes | Fast search without a server |
| YouTube only (initially) | Vast majority of FGC VODs are on YouTube |
| start.gg as data source | De facto tournament platform for FGC |
| Spoiler-free by default | Core value prop — casual "reveal all" is opt-in |
