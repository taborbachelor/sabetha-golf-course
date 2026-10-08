export function StubPage({ title }: { title: string }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="mt-4 text-stone-600">Coming soon.</p>
    </div>
  );
}
