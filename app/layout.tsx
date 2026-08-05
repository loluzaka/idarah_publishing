import type { Metadata } from "next";
import { Inter, Playfair_Display, Amiri, Noto_Nastaliq_Urdu } from "next/font/google";
import "./globals.css";
import HeaderWrapper from "./components/HeaderWrapper";
import { AuthProvider } from "@/app/context/AuthContext";
import { buildMetadata, organizationJsonLd, jsonLdString } from "@/app/lib/seo";
import { Toaster } from "react-hot-toast";
import Script from "next/script";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair" });
const amiri = Amiri({ subsets: ["arabic"], weight: ["400", "700"], variable: "--font-amiri" });

const notoUrdu = Noto_Nastaliq_Urdu({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-noto-urdu"
});

// Site-wide default metadata — page-level generateMetadata still overrides.
export const metadata: Metadata = buildMetadata();

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} ${amiri.variable} ${notoUrdu.variable}`} suppressHydrationWarning>
      <body className="antialiased bg-[#FBFBFA] text-[#1A1A1A]" suppressHydrationWarning>
        {/* Site-wide Organization structured data for search engines */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdString(organizationJsonLd()) }}
        />
        {/* Razorpay Checkout — loaded once, used by PayButton */}
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="afterInteractive"
        />
        <AuthProvider>
          <HeaderWrapper />
          {children}
          <Toaster position="bottom-right" />
        </AuthProvider>
      </body>
    </html>
  );
}
