import type { Metadata } from "next";
import { IBM_Plex_Mono, Playfair_Display, Geist } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { cn } from "@/lib/utils";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import SessionTimeout from '@/components/SessionTimeout';

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "EaziWage | Dashboard",
  description:
    "A system designed to enable employees to get access to an advance before payday.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <body
        suppressHydrationWarning
        className={`${ibmPlexMono.variable} ${playfairDisplay.variable} antialiased`}
      >
        <OfflineBanner />
        <SessionTimeout />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
