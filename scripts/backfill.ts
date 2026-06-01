/**
 * RunBack Backfiller Script
 *
 * Fetches tournament data from start.gg GraphQL API and transforms it
 * into the RunBack data model.
 *
 * Usage: npx ts-node scripts/backfill.ts <tournament-slug>
 *
 * Rate limit: 80 req/60s — we throttle to 1 req/sec to stay safe.
 */

import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const STARTGG_API = "https://api.start.gg/gql/alpha";
const TOKEN = process.env.STARTGG_TOKEN;
const RATE_LIMIT_MS = 1000; // 1 request per second

// ---------------------------------------------------------------------------
// GraphQL Queries
// ---------------------------------------------------------------------------

const TOURNAMENT_EVENTS_QUERY = `
  query TournamentEvents($slug: String!) {
    tournament(slug: $slug) {
      id
      name
      startAt
      events {
        id
        name
        videogame {
          id
          name
        }
      }
    }
  }
`;

const EVENT_SETS_QUERY = `
  query EventSets($eventId: ID!, $page: Int!, $perPage: Int!) {
    event(id: $eventId) {
      sets(page: $page, perPage: $perPage, sortType: STANDARD) {
        pageInfo {
          total
          totalPages
        }
        nodes {
          id
          fullRoundText
          round
          winnerId
          state
          slots {
            entrant {
              id
              name
              participants {
                player {
                  gamerTag
                }
              }
            }
          }
          games {
            selections {
              entrant {
                id
              }
              character {
                id
                name
              }
            }
          }
        }
      }
    }
  }
`;

// ---------------------------------------------------------------------------
// API Helpers
// ---------------------------------------------------------------------------

async function startggFetch(query: string, variables: Record<string, unknown>) {
  if (!TOKEN) throw new Error("STARTGG_TOKEN not set. Check your .env file.");

  const res = await fetch(STARTGG_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`start.gg API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Data Fetching
// ---------------------------------------------------------------------------

async function fetchTournament(slug: string) {
  const { data } = await startggFetch(TOURNAMENT_EVENTS_QUERY, { slug });
  return data.tournament;
}

async function fetchAllSets(eventId: number) {
  const allSets: unknown[] = [];
  let page = 1;
  const perPage = 50;
  let totalPages = 1;

  while (page <= totalPages) {
    await sleep(RATE_LIMIT_MS);
    const { data } = await startggFetch(EVENT_SETS_QUERY, { eventId, page, perPage });

    const setsData = data.event.sets;
    totalPages = setsData.pageInfo.totalPages;
    allSets.push(...setsData.nodes);

    console.log(`  Fetched page ${page}/${totalPages} (${setsData.nodes.length} sets)`);
    page++;
  }

  return allSets;
}

// ---------------------------------------------------------------------------
// Transform (start.gg → RunBack data model)
// ---------------------------------------------------------------------------

function transformSet(rawSet: any): object {
  // TODO: Extract characters per entrant from rawSet.games[].selections
  // TODO: Compute score from game wins or displayScore
  // TODO: Map entrant IDs to consistent internal IDs

  return {
    id: String(rawSet.id),
    round: rawSet.round,
    fullRoundText: rawSet.fullRoundText,
    entrants: (rawSet.slots || []).map((slot: any) => ({
      id: String(slot.entrant?.id),
      name: slot.entrant?.name || "Unknown",
      gamerTag: slot.entrant?.participants?.[0]?.player?.gamerTag || null,
      characters: [], // TODO: populate from games[].selections
    })),
    winnerId: rawSet.winnerId ? String(rawSet.winnerId) : null,
    score: null, // TODO: parse from displayScore or game count
    vodUrl: null, // TODO: populate if VOD data available
    vodStartTime: null,
    vodEndTime: null,
  };
}

function transformTournament(tournament: any, sets: any[], slug: string) {
  const event = tournament.events[0]; // TODO: handle multi-event tournaments

  return {
    id: String(tournament.id),
    name: tournament.name,
    slug: slug,
    startggSlug: slug,
    game: event?.videogame?.name || "Unknown",
    date: new Date(tournament.startAt * 1000).toISOString().split("T")[0],
    sets: sets.map(transformSet),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("Usage: npx ts-node scripts/backfill.ts <tournament-slug>");
    process.exit(1);
  }

  console.log(`Fetching tournament: ${slug}`);
  const tournament = await fetchTournament(slug);
  console.log(`Found: ${tournament.name} (${tournament.events.length} events)`);

  // TODO: Let user pick event or iterate all events
  const eventId = tournament.events[0]?.id;
  if (!eventId) {
    console.error("No events found for this tournament.");
    process.exit(1);
  }

  console.log(`Fetching sets for event: ${tournament.events[0].name}`);
  const rawSets = await fetchAllSets(eventId);
  console.log(`Total sets fetched: ${rawSets.length}`);

  // Filter to completed sets only (state 3)
  const completedSets = rawSets.filter((s: any) => s.state === 3);
  console.log(`Completed sets: ${completedSets.length}`);

  const output = transformTournament(tournament, completedSets, slug);

  // Write output
  const outDir = path.join(__dirname, "..", "data", "tournaments");
  fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, `${slug.replace(/\//g, "_")}.json`);
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Written to: ${outPath}`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
