import type { Metadata } from "next";
import { Space_Grotesk, Noto_Sans_JP, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { AuthProvider } from "@/components/providers/AuthProvider";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

const notoSansJP = Noto_Sans_JP({
  variable: "--font-japanese",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AlgoWars - Code. Battle. Conquer.",
  description:
    "Real-time 1v1 competitive programming battles. Challenge opponents, solve algorithmic problems, climb the ranks.",
  icons: {
    icon: "/favicon.png",
  },
  openGraph: {
    title: "AlgoWars - Code. Battle. Conquer.",
    description: "Real-time 1v1 competitive programming battles. Prove your algorithmic skill.",
    url: "https://www.algowars.online",
    siteName: "AlgoWars",
    images: [
      {
        url: "/algowar-banner.png",
        width: 1200,
        height: 630,
        alt: "AlgoWars - Competitive Programming Arena",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AlgoWars - Code. Battle. Conquer.",
    description: "Real-time 1v1 competitive programming battles. Prove your algorithmic skill.",
    images: ["/algowar-banner.png"],
  },
  metadataBase: new URL("https://www.algowars.online"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        />
      </head>
      <body
        className={`${spaceGrotesk.variable} ${notoSansJP.variable} ${jetbrainsMono.variable} bg-bg-dark text-foreground antialiased min-h-screen`}
        suppressHydrationWarning
      >
        <AuthProvider>{children}</AuthProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
