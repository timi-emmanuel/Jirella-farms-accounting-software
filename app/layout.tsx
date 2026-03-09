import type { Metadata } from "next";
import "./globals.css";
import { AuthLogger } from "@/components/AuthLogger";
import { Toaster } from "@/components/ui/toaster";
import { AlertToastBridge } from "@/components/AlertToastBridge";

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
      <body className="antialiased overflow-hidden">
        <AuthLogger />
        <AlertToastBridge />
        <Toaster />
        {children}
      </body>
    </html>
  );
}
