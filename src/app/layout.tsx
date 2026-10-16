import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import { getSession } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dynamic Expiry-Based Grocery & Zero-Waste Marketplace",
  description: "Next-generation dynamic decay-pricing grocery marketplace.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();

  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 min-h-screen flex flex-col antialiased">
        <Navbar initialUser={session} />
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
        <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
          Dynamic Expiry-Based Grocery & Zero-Waste Marketplace • SE University Project
        </footer>
      </body>
    </html>
  );
}
