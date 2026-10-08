import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { OpenNowBadge } from "@/components/OpenNowBadge";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getSettings } from "@/content/settings";
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
  title: {
    default: "Sabetha Golf Club",
    template: "%s | Sabetha Golf Club",
  },
  description: "Sabetha Golf Club, a 9-hole course near Sabetha, Kansas.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const { club, timeZone, clubhouseHours } = getSettings();

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
      </body>
    </html>
  );
}
