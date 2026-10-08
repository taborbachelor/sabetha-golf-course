import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { OpenNowBadge } from "@/components/OpenNowBadge";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
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

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <SiteHeader
          clubName={club.name}
          badge={
            <OpenNowBadge timeZone={timeZone} clubhouseHours={clubhouseHours} />
          }
        />
        <main className="flex flex-1 flex-col">{children}</main>
        <SiteFooter club={club} />
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
