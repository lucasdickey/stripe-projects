import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stripe Projects Feedback",
  description: "Share and discuss improvements for Stripe Projects",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="app-container">
          {children}
        </div>
      </body>
    </html>
  );
}
