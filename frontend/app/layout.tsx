import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const metadata: Metadata = {
  title: "MassMailer — Recruiter Outreach & Campaign Intelligence Platform",
  description:
    "Send personalized job application emails to recruiters at scale with AI pitch generation, multi-SMTP rotation, follow-up sequences, and real-time analytics.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${jakarta.variable} ${outfit.variable} font-sans antialiased bg-[#07070c] text-slate-100 selection:bg-violet-500/30 selection:text-violet-200`}>
        {children}
      </body>
    </html>
  );
}
