import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "MassMailer — Recruiter Outreach Platform",
  description:
    "Send personalized job application emails to recruiters at scale. One email per recruiter, tracked individually.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-[#0a0a0f] text-white`}>
        {children}
      </body>
    </html>
  );
}
