import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Inter is the typeface the DESING/ mockup is set in (confirmed by reading
// the mockup's computed `font-family`), so the app matches it directly.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"]
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono-jb",
  weight: ["400", "500", "600"]
});

export const metadata: Metadata = {
  title: "Nexus AI Engineering OS",
  description:
    "Bring-your-own-key engineering leadership OS — PR review, architecture, proposals, research, and knowledge base.",
  icons: {
    icon: "/favicon.ico"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  );
}
