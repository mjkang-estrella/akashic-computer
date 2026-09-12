import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, STIX_Two_Text } from "next/font/google";
import { AtlasShell } from "@/components/atlas/AtlasShell";
import { CatalogProvider } from "@/components/atlas/CatalogProvider";
import "./globals.css";

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
  title: "Akashic — Open-weight models, made legible",
  description:
    "Discover open-weight AI for language, vision, audio, and beyond. Explore model families, downloadable weights, benchmarks, memory estimates, and runtime evidence.",
  openGraph: {
    title: "Akashic — Open-weight models, made legible",
    description:
      "Explore the open model landscape, from family to downloadable weights. Compare benchmarks, memory estimates, and runtime evidence.",
    siteName: "Akashic",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Akashic — Open-weight models, made legible",
    description:
      "Explore the open model landscape, from family to downloadable weights. Compare benchmarks, memory estimates, and runtime evidence.",
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
        <CatalogProvider>
          <AtlasShell>{children}</AtlasShell>
        </CatalogProvider>
      </body>
    </html>
  );
}
