"use client";

import { Inter, Merriweather, Roboto_Mono } from "next/font/google";
import "./globals.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import Chatbot from "@/components/ui/chatbot";
import { useState } from "react";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const merriweather = Merriweather({
  variable: "--font-merriweather",
  subsets: ["latin"],
  weight: ["300", "400", "700", "900"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
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
        className={`${inter.variable} ${merriweather.variable} ${robotoMono.variable} antialiased`}
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
