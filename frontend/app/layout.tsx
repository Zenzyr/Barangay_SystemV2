"use client"
import { useState } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import Chatbot from "@/components/ui/chatbot";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // QueryClient must be created inside the component (not at module scope) to
  // prevent cache sharing between SSR requests / different users.
  const [queryClient] = useState(() => new QueryClient());

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <QueryClientProvider client={queryClient}>
          {children}
          <Toaster position="top-right" richColors />
          <Chatbot />
        </QueryClientProvider>
      </body>
    </html>
  );
}
