import type { Metadata } from "next";
import { Source_Sans_3 } from "next/font/google";
import { Suspense, type ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Dayfolio",
    template: "%s · Dayfolio",
  },
  description: "Understand, compare, and try everyday household decisions before you save anything.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={sourceSans.className}>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Suspense fallback={<header className="site-header">Dayfolio</header>}>
          <SiteHeader />
        </Suspense>
        <main id="main">{children}</main>
      </body>
    </html>
  );
}
