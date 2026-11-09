export default function CheckLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl animate-pulse px-4 py-10 sm:px-6">
      <div className="h-4 w-40 rounded bg-white/10" />
      <div className="mt-6 h-40 rounded-3xl bg-white/5" />
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-24 rounded-2xl bg-white/5" />
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="h-72 rounded-2xl bg-white/5 lg:col-span-2" />
        <div className="h-72 rounded-2xl bg-white/5" />
      </div>
    </main>
  );
}
