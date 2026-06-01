export function generateStaticParams() {
  return [{ id: "example" }];
}

export default function SetPage({ params }: { params: { id: string } }) {
  return <h1>Set: {params.id}</h1>;
}
