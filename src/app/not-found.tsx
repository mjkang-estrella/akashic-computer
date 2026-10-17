import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[760px] items-center px-5 py-16">
      <section className="w-full border-y border-line py-8">
        <h1 className="font-display text-[28px] font-semibold">Page not found</h1>
        <p className="mt-2 text-[13px] text-muted">This address is not part of Akashic Computer.</p>
        <Link href="/" className="mt-5 inline-flex min-h-10 items-center border border-line bg-panel px-4 text-[12.5px] font-semibold hover:border-ink">
          Go to the catalog
        </Link>
      </section>
    </main>
  );
}
