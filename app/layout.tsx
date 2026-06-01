import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Data Maturity — Is Your Data Ready for AI?",
  description:
    "Upload your dataset and get a column-by-column AI readiness assessment with an overall maturity score and ready-to-use AI context block.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f8f9fa] text-gray-900">
        <div className="max-w-[680px] mx-auto px-4 py-8">{children}</div>
      </body>
    </html>
  );
}
