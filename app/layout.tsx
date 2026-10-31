import type { Metadata } from "next";
import { Inter, Playfair_Display, Amiri, Noto_Nastaliq_Urdu } from "next/font/google";
import "./globals.css";
import HeaderWrapper from "./components/HeaderWrapper";
import Footer from "./components/Footer";
import { AuthProvider } from "@/app/context/AuthContext";
import { buildMetadata, SITE } from "@/app/lib/seo";
import { SchemaOrg } from "@/components/seo/SchemaOrg";
import { Toaster } from "react-hot-toast";
import { GoogleAnalytics } from '@next/third-parties/google';

// Self-hosted by next/font at build time (no request to Google). `swap` shows text
// immediately in the fallback face; the Arabic-script fonts are large and only
// needed on Urdu content, so they are NOT preloaded on every page.
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
const playfair = Playfair_Display({ subsets: ["latin"], display: "swap", variable: "--font-playfair" });
const amiri = Amiri({ subsets: ["arabic"], weight: ["400", "700"], display: "swap", preload: false, variable: "--font-amari" });

const notoUrdu = Noto_Nastaliq_Urdu({
  subsets: ["arabic"],
  weight: ["400", "700"],
  display: "swap",
  preload: false,
  variable: "--font-noto-urdu"
});

// Site-wide default metadata — page-level generateMetadata still overrides.
// Child pages return a bare title (see buildMetadata); this template turns it into
// "[Book Title / Category] | Idara Adabiyat Delhi (Idarah Books)".
export const metadata: Metadata = {
  ...buildMetadata(),
  metadataBase: new URL(SITE.url),
  title: { default: SITE.defaultTitle, template: `%s | ${SITE.titleSuffix}` },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} ${amiri.variable} ${notoUrdu.variable}`} suppressHydrationWarning>
      <body className="antialiased bg-[#FBFBFA] text-[#1A1A1A] flex flex-col min-h-screen" suppressHydrationWarning>
        {/* Site-wide Organization + WebSite structured data for search engines */}
        <SchemaOrg type="organization" />
        <SchemaOrg type="website" />
        {/* Razorpay scripts (Magic + standard) are loaded on demand by PayButton. */}
        <AuthProvider>
          <HeaderWrapper />
          <main className="flex-1">{children}</main>
          <Footer />
          <Toaster position="bottom-right" />
        </AuthProvider>
        {process.env.NEXT_PUBLIC_GA_ID ? (
  <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
) : null}
      </body>
    </html>
  );
}
