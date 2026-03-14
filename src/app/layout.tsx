import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  weight: "400",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GraphHopper",
  description: "3D graph visualizer with REST API and Rhino file support",
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head> */}
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background`}
      >
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
