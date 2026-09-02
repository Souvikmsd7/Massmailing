import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

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
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#1a1a2e",
              border: "1px solid rgba(139, 92, 246, 0.3)",
              color: "#e2e8f0",
            },
          }}
          richColors
        />
      </body>
    </html>
  );
}
