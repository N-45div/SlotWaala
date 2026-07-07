import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SlotWaala",
  description: "WhatsApp front-desk agent for Indian service businesses.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
