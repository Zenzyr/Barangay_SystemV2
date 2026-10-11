"use client";

import { Inter, Merriweather, Roboto_Mono } from "next/font/google";
import "./globals.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import Chatbot from "@/components/ui/chatbot";
import useUserStore from "@/app/store/useUserStore";
import { useState } from "react";

// Staff-facing roles don't get the floating assistant — it's a resident feature.
const CHATBOT_EXCLUDED_ROLES = ["secretary", "treasurer", "super_admin"];

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
  const { user, _hasHydrated } = useUserStore();
  // Only render once hydration has happened so staff never see a flash of the
  // chatbot button before their role is known.
  const showChatbot =
    _hasHydrated && !(user && CHATBOT_EXCLUDED_ROLES.includes(user.role ?? ""));

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body
        className={`${inter.variable} ${merriweather.variable} ${robotoMono.variable} antialiased bg-ambient-pattern`}
      >
        <QueryClientProvider client={queryClient}>
          {children}
          <Toaster position="top-right" richColors />
          {showChatbot && <Chatbot />}
        </QueryClientProvider>
      </body>
    </html>
  );
}
