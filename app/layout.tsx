import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthLogger } from "@/components/AuthLogger";
import { Toaster } from "@/components/ui/toaster";
import { AlertToastBridge } from "@/components/AlertToastBridge";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Jirella Farms Software",
  description: "Farm Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased overflow-hidden`}
      >
        <AuthLogger />
        <AlertToastBridge />
        <Toaster />
        {children}
      </body>
    </html>
  );
}
