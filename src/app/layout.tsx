import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { OpenNowBadge } from "@/components/OpenNowBadge";
import { Suspense } from "react";
import { PublicOnly } from "@/components/PublicOnly";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader, SiteHeaderFallback } from "@/components/SiteHeader";
import { getSettings } from "@/lib/settings";
import { allowIndexing, siteUrl } from "@/lib/site";
import { golfCourseJsonLd } from "@/lib/structuredData";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Sabetha Golf Club",
    template: "%s | Sabetha Golf Club",
  },
  description:
    "Sabetha Golf Club, a 9-hole course about a mile north of Sabetha, Kansas. Green fees, memberships, pool, menu and clubhouse hours.",
  openGraph: {
    siteName: "Sabetha Golf Club",
    locale: "en_US",
    type: "website",
  },
  robots: allowIndexing()
    ? { index: true, follow: true }
    : { index: false, follow: false },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const settings = await getSettings();
  const { club, timeZone, clubhouseHours } = settings;
  const jsonLd = golfCourseJsonLd(settings, siteUrl());
  const badge = (
    <OpenNowBadge timeZone={timeZone} clubhouseHours={clubhouseHours} />
  );

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* The header and footer read the URL (hidden on the staff board);
            pages with an unknown dynamic segment show the fallback while
            prerendering. */}
        <Suspense
          fallback={<SiteHeaderFallback clubName={club.name} badge={badge} />}
        >
          <SiteHeader clubName={club.name} badge={badge} />
        </Suspense>
        <main className="flex flex-1 flex-col">{children}</main>
        <Suspense fallback={<SiteFooter club={club} />}>
          <PublicOnly>
            <SiteFooter club={club} />
          </PublicOnly>
        </Suspense>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
      </body>
    </html>
  );
}
