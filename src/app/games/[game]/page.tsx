export function generateStaticParams() {
  return [{ game: "melee" }];
}

export default function GamePage({ params }: { params: { game: string } }) {
  return <h1>Game: {params.game}</h1>;
}
