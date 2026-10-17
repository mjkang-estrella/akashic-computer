import Link from "next/link";

export function ModelNotFound() {
  return (
    <section className="mt-6 border-y border-line py-16 text-center">
      <h2 className="font-display text-[24px] font-semibold">Model not found</h2>
      <p className="mt-2 text-[13px] text-muted">The catalog has no published model with this slug.</p>
      <Link href="/models" className="mt-5 inline-flex min-h-10 items-center border border-line bg-panel px-4 text-[12.5px] font-semibold hover:border-ink">
        Browse models
      </Link>
    </section>
  );
}
