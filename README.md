# RunBack

Spoiler-free fighting game VOD navigator — browse tournament sets without knowing who won.

## Features

- Browse VODs by game and tournament
- Search by player or character
- Spoiler-free bracket viewer (hides results until you choose to reveal)
- YouTube VOD embedding with hidden video duration
- Backfiller script to pull tournament data from start.gg

## Getting Started

**Prerequisites:** Node.js 18+

```bash
git clone https://github.com/your-username/runback.git
cd runback
npm install
cp .env.example .env  # Add your STARTGG_TOKEN
npm run dev
```

To build a static export:

```bash
npm run build  # Outputs to /out
```

## Project Structure

```
src/app/        → Next.js app router pages and layouts
data/           → JSON tournament data and pre-built indexes
scripts/        → Backfiller and data processing scripts
docs/           → Architecture and design documentation
```

## Backfiller Usage

Pull tournament data from start.gg:

```bash
npx ts-node scripts/backfill.ts <tournament-slug>
```

The slug is the URL segment from `start.gg/tournament/<slug>` — for example, `genesis-9` from `start.gg/tournament/genesis-9`.

Rate limiting is handled automatically.

## Deployment

Static export to GitHub Pages:

```bash
npm run build
npx gh-pages -d out
```

Or push the `out/` directory to your repo's `gh-pages` branch manually. Upgradeable to Vercel deployment later.

## Contributing

PRs welcome. See `docs/DESIGN.md` for architecture decisions and project conventions.

## License

MIT
