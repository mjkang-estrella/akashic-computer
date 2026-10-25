import type { Metadata } from "next";
import Script from "next/script";
import { IBM_Plex_Mono, IBM_Plex_Sans, STIX_Two_Text } from "next/font/google";
import { AppProviders } from "@/components/AppProviders";
import "@/components/workspace/workspace.css";
import "./globals.css";
import "@/components/comparison/comparison.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const stixTwo = STIX_Two_Text({
  variable: "--font-stix",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://akashic.computer"),
  title: { default: "Akashic Computer", template: "%s · Akashic Computer" },
  description:
    "Navigate open-weight model families, artifacts, quantizations, and benchmarks.",
  openGraph: {
    title: "Akashic Computer",
    description:
      "Navigate open-weight model families, artifacts, quantizations, and benchmarks.",
    siteName: "Akashic Computer",
    type: "website",
  },
  alternates: {
    types: {
      "application/rss+xml": [{ url: "/feed.xml", title: "Akashic Computer material changes" }],
    },
  },
  twitter: {
    card: "summary_large_image",
    title: "Akashic Computer",
    description:
      "Navigate open-weight model families, artifacts, quantizations, and benchmarks.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable} ${stixTwo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AppProviders>
          {children}
        </AppProviders>
        {process.env.NODE_ENV === "production" && (
          <Script id="cloudflare-web-analytics" strategy="afterInteractive">
            {`
              if (window.location.hostname === "akashic.computer" &&
                  !document.querySelector('script[src="https://static.cloudflareinsights.com/beacon.min.js"]')) {
                const beacon = document.createElement("script");
                beacon.type = "module";
                beacon.src = "https://static.cloudflareinsights.com/beacon.min.js";
                beacon.setAttribute("data-cf-beacon", '{"token":"03f2cdba095846aaae1ff02db2550f38"}');
                document.body.appendChild(beacon);
              }
            `}
          </Script>
        )}
      </body>
    </html>
  );
}
