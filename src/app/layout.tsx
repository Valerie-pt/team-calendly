import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Запись на интервью",
  description: "Забронируйте слот для интервью",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-body">{children}</body>
    </html>
  );
}
