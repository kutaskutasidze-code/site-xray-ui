import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Site X-Ray",
  description: "Rendering pipeline level web cloner",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
