import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mt-6 border-y border-line py-16 text-center">
      <h2 className="font-display text-[24px] font-semibold">Page not found</h2>
      <p className="mt-2 text-[13px] text-muted">This address is not part of the catalog.</p>
      <Link href="/models" className="mt-5 inline-flex min-h-10 items-center border border-line bg-panel px-4 text-[12.5px] font-semibold hover:border-ink">
        Browse models
      </Link>
    </section>
  );
}
