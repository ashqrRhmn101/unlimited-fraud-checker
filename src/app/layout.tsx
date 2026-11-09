import type { Metadata } from "next";
import type { ReactNode } from "react";

import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: "FraudBD Merchant Panel — Customer list + fraud.bd courier checker",
  description:
    "Upload your customer list (Excel / PDF), see every customer with name, phone and address, and check each number's courier history with the fraud.bd API in one click. Supabase PostgreSQL.",
  keywords: [
    "courier fraud check",
    "fraud.bd api",
    "customer list excel import",
    "cod fraud bangladesh",
    "parcel return check",
  ],
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="page-bg min-h-screen antialiased">
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
