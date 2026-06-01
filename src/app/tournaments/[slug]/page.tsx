export function generateStaticParams() {
  return [{ slug: "example" }];
}

export default function TournamentPage({ params }: { params: { slug: string } }) {
  return <h1>Tournament: {params.slug}</h1>;
}
