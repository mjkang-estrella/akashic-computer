"use client";
export default function ComparisonError({ reset }: { reset: () => void }) {
  return <section className="comparison-page"><h1>Comparison unavailable</h1>
    <p className="my-4">This comparison could not be loaded. Check your account access or try again.</p>
    <button className="comparison-button" onClick={reset}>Try again</button></section>;
}
