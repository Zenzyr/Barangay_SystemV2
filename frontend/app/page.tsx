"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Users,
  Building2,
  ChevronRight,
  Star,
  Shield,
  Sparkles,
  UserPlus,
  BadgeCheck,
  Globe,
  Share2,
  MessageSquare,
} from "lucide-react";
import HeroCarousel from "@/components/HeroCarousel";
import { useState, useEffect } from "react";

export default function Home() {
  const [scrolled, setScrolled] = useState(false);
  const [stats, setStats] = useState({
    activeResidents: null,
    processedDocuments: null,
    skilledNeighbors: null,
  });

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    
    fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL_LIVE}/public/stats`)
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch((err) => console.error("Failed to fetch public stats:", err));

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="flex flex-col min-h-screen font-sans">
      {/* ── Navigation ── */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white/80 backdrop-blur-xl shadow-lg shadow-sky-900/5"
            : "bg-white/20 backdrop-blur-md border-b border-white/10 shadow-sm"
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-3">
          {/* Logo + Brand */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-10 h-10 rounded-xl overflow-hidden ring-2 ring-sky-200/50 group-hover:ring-sky-400/60 transition-all duration-300">
              <Image
                src="/assets/logo.jpg"
                alt="Barangay Logo"
                fill
                sizes="(max-width: 768px) 40px, 40px"
                className="object-cover"
              />
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-sky-700 to-emerald-600 bg-clip-text text-transparent">
              Barangay Rabon
            </span>
          </Link>

          {/* Nav Links (desktop) */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-800">
            <button
              onClick={() => scrollToSection("features")}
              className="hover:text-sky-700 transition-colors duration-200"
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection("about")}
              className="hover:text-sky-700 transition-colors duration-200"
            >
              About
            </button>
            <button
              onClick={() => scrollToSection("contact")}
              className="hover:text-sky-700 transition-colors duration-200"
            >
              Contact
            </button>
          </nav>


          {/* Auth Buttons */}
          <div className="flex items-center gap-3">
            <Link href="/guest/signIn">
              <Button
                variant="ghost"
                className="text-sky-700 hover:text-sky-800 hover:bg-sky-50 font-medium"
              >
                Sign In
              </Button>
            </Link>
            <Link href="/guest/signUp">
              <Button className="bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white shadow-md shadow-sky-200/50 hover:shadow-lg hover:shadow-sky-300/50 transition-all duration-300 font-semibold px-5">
                Sign Up
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        <HeroCarousel />

        {/* Decorative floating shapes */}
        <div className="absolute top-1/4 left-10 w-72 h-72 bg-sky-200/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-10 w-96 h-96 bg-emerald-200/20 rounded-full blur-3xl animate-pulse delay-1000" />

        <div className="relative max-w-7xl mx-auto px-6 pt-24 pb-20 w-full">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left – Text Container */}
            <div className="bg-slate-950/30 backdrop-blur-md p-8 sm:p-10 rounded-3xl border border-white/10 shadow-2xl">
              <div className="space-y-8">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-white text-sm font-medium backdrop-blur-sm shadow-sm">
                  <Sparkles className="w-4 h-4" />
                  Your Digital Barangay Portal
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight text-white/95 [text-shadow:0_2px_4px_rgba(0,0,0,0.3)]">
                  <span className="text-white">Welcome to</span>{" "}
                  <span className="text-emerald-300">
                    Barangay Rabon
                  </span>
                </h1>

                <p className="text-lg text-slate-100 leading-relaxed max-w-lg [text-shadow:0_1px_2px_rgba(0,0,0,0.3)]">
                  Your all-in-one community hub. Request barangay documents, discover local skills, and connect with your neighbors — all in one place.
                </p>

                {/* CTA Buttons */}
                <div className="flex flex-wrap gap-4">
                  <Link href="/guest/signIn">
                    <Button
                      size="lg"
                      className="bg-sky-500 hover:bg-sky-600 text-white shadow-lg shadow-sky-900/20 transition-all duration-300 font-semibold px-7 h-11 text-base rounded-xl"
                    >
                      Get Started
                      <ChevronRight className="ml-1 w-4 h-4" />
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => scrollToSection("features")}
                    className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:border-white/30 font-medium px-7 h-11 text-base rounded-xl"
                  >
                    Explore Features
                  </Button>
                </div>

                {/* Trust indicators */}
                <div className="flex items-center gap-6 pt-4 text-sm text-slate-200">
                  <div className="flex items-center gap-1.5 [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    <span>Secure & Private</span>
                  </div>
                  <div className="flex items-center gap-1.5 [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]">
                    <Star className="w-4 h-4 text-amber-300" />
                    <span>Community Trusted</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right – Logo/Illustration */}
            <div className="hidden md:flex items-center justify-center">
              <div className="relative w-80 h-80 lg:w-96 lg:h-96">
                {/* Glow behind logo */}
                <div className="absolute inset-0 bg-gradient-to-br from-sky-300/30 to-emerald-300/30 rounded-full blur-3xl" />
                <div className="relative w-full h-full rounded-3xl overflow-hidden ring-4 ring-white/60 shadow-2xl shadow-sky-200/30">
                  <Image
                    src="/assets/logo.jpg"
                    alt="Barangay Rabon"
                    fill
                    sizes="(max-width: 768px) 320px, 384px"
                    className="object-cover"
                    priority
                  />
                </div>
                {/* Decorative badge */}
                <div className="absolute -bottom-3 -right-3 bg-white rounded-2xl px-4 py-2 shadow-lg border border-sky-100 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-semibold text-slate-700">
                    Online
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 100" className="w-full h-auto fill-white">
            <path d="M0,50 C360,100 1080,0 1440,50 L1440,100 L0,100 Z" />
          </svg>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="relative overflow-hidden bg-slate-50/80 py-24">
        <div className="absolute inset-0 bg-grid-glow [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sky-100/70 border border-sky-200/50 text-sky-700 text-sm font-medium mb-4">
              <Sparkles className="w-4 h-4" />
              Simple & Hassle-free
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 text-balance">
              How It Works
            </h2>
            <p className="mt-4 text-slate-500 text-lg">
              From sign-up to document approval in three easy steps.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                icon: UserPlus,
                title: "Create Your Account",
                desc: "Sign up and verify your details to become part of the Barangay Rabon community.",
              },
              {
                step: "02",
                icon: FileText,
                title: "Request Services",
                desc: "Apply for clearances, certificates, permits, and community services right from home.",
              },
              {
                step: "03",
                icon: BadgeCheck,
                title: "Track & Get Approved",
                desc: "Follow your request in real time and claim your approved document at the barangay hall.",
              },
            ].map((s) => (
              <div
                key={s.step}
                className="group relative bg-white rounded-2xl p-8 shadow-sm border border-slate-100 hover:shadow-xl hover:shadow-sky-100/60 hover:-translate-y-1 hover:border-sky-200 transition-all duration-300"
              >
                <div className="absolute top-6 right-7 text-4xl font-extrabold text-slate-100 group-hover:text-sky-100 transition-colors duration-300 select-none">
                  {s.step}
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-emerald-500 flex items-center justify-center mb-5 shadow-md shadow-sky-200/50">
                  <s.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">{s.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features Section ── */}
      <section id="features" className="relative scroll-mt-24 bg-white py-24">
        <div className="max-w-7xl mx-auto px-6">
          {/* Section header */}
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/50 text-emerald-700 text-sm font-medium mb-4">
              <Sparkles className="w-4 h-4" />
              Community Services
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-800">
              Everything You Need in One Portal
            </h2>
            <p className="mt-4 text-slate-500 text-lg">
              We bring essential barangay services directly to your
              fingertips.
            </p>
          </div>

          {/* Feature cards */}
          <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8 justify-items-center">
            {/* Card 1 – Document Request */}
            <div className="group relative bg-white rounded-2xl p-8 shadow-lg shadow-sky-100/50 border border-sky-100 hover:shadow-xl hover:shadow-sky-200/40 hover:-translate-y-1 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-sky-50/50 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center mb-5 shadow-md shadow-sky-200/50">
                  <FileText className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-3">
                  Document Requests
                </h3>
                <p className="text-slate-500 leading-relaxed mb-5">
                  Request barangay clearances, certificates, and other
                  official documents online. No more long queues — submit
                  from home.
                </p>
                <ul className="space-y-2 text-sm text-slate-500">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                    Barangay Clearance
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                    Certificate of Residency
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                    Business Permits
                  </li>
                </ul>
              </div>
            </div>

            {/* Card 2 – Skills & Hiring */}
            <div className="group relative bg-white rounded-2xl p-8 shadow-lg shadow-emerald-100/50 border border-emerald-100 hover:shadow-xl hover:shadow-emerald-200/40 hover:-translate-y-1 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mb-5 shadow-md shadow-emerald-200/50">
                  <Users className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-3">
                  Neighbor Skills & Hiring
                </h3>
                <p className="text-slate-500 leading-relaxed mb-5">
                  Discover the talents within your community. Hire neighbors
                  for plumbing, tutoring, gardening, events, and more.
                </p>
                <ul className="space-y-2 text-sm text-slate-500">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Browse neighbor profiles
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Search by skill or trade
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Connect & hire directly
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats Section ── */}
      <section className="relative overflow-hidden bg-gradient-to-r from-sky-50 to-emerald-50 py-20 flex items-center justify-center min-h-[300px]">
        <div className="absolute inset-0 bg-grid-glow [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
        <div className="relative max-w-7xl mx-auto px-6 w-full">
          <div className="flex flex-wrap justify-center items-center gap-6 md:gap-8">
            {[
              { label: "Active Residents", value: stats.activeResidents ?? "—" },
              { label: "Documents Processed", value: stats.processedDocuments ?? "—" },
              { label: "Skilled Neighbors", value: stats.skilledNeighbors ?? "—" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="group rounded-2xl bg-white/70 backdrop-blur-md border border-white/80 p-6 text-center shadow-sm hover:shadow-xl hover:shadow-sky-200/40 hover:-translate-y-0.5 transition-all duration-300 w-full sm:w-64"
              >
                <div className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-sky-600 to-emerald-600 bg-clip-text text-transparent">
                  {stat.value}
                </div>
                <div className="text-sm text-slate-500 font-medium mt-1.5">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── About / CTA Section ── */}
      <section id="about" className="scroll-mt-24 bg-white py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="bg-gradient-to-br from-sky-500 to-emerald-600 rounded-3xl p-10 md:p-16 text-center text-white shadow-2xl shadow-sky-200/50 relative overflow-hidden">
            {/* Decorative blobs */}
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-white/5 rounded-full blur-3xl" />

            <div className="relative">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Join Your Barangay Community Today
              </h2>
              <p className="text-sky-100 text-lg max-w-xl mx-auto mb-8">
                Sign up now to access all barangay services, connect with
                neighbors, and support local businesses.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link href="/guest/signUp">
                  <Button
                    size="lg"
                    className="bg-white text-sky-700 hover:bg-sky-50 shadow-lg font-semibold px-8 h-11 text-base rounded-xl"
                  >
                    Create Free Account
                  </Button>
                </Link>
                <Link href="/guest/signIn">
                  <Button
                    size="lg"
                    className="bg-white text-sky-700 hover:bg-sky-50 shadow-lg font-semibold px-8 h-11 text-base rounded-xl"
                  >
                    I Already Have an Account
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer / Contact ── */}
      <footer id="contact" className="scroll-mt-24 bg-slate-900 text-slate-400 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-10">
            {/* Brand */}
            <div className="md:col-span-1 space-y-4">
              <div className="flex items-center gap-3">
                <div className="relative w-9 h-9 rounded-lg overflow-hidden ring-2 ring-sky-500/30">
                  <Image
                    src="/assets/logo.jpg"
                    alt="Barangay Logo"
                    fill
                    sizes="36px"
                    className="object-cover"
                  />
                </div>
                <span className="text-white font-bold text-base">
                  Barangay Rabon
                </span>
              </div>
              <p className="text-sm leading-relaxed">
                Your all-in-one digital portal for barangay services,
                community connection, and local commerce.
              </p>
              <div className="flex items-center gap-3 pt-1">
                {[
                  { icon: Globe, label: "Official Website" },
                  { icon: MessageSquare, label: "Community Chat" },
                  { icon: Share2, label: "Social Media" },
                ].map((s) => (
                  <a
                    key={s.label}
                    href="#"
                    aria-label={s.label}
                    className="flex size-8 items-center justify-center rounded-lg bg-white/5 text-slate-400 transition-all hover:bg-gradient-to-br hover:from-sky-500 hover:to-emerald-500 hover:text-white"
                  >
                    <s.icon className="size-4" />
                  </a>
                ))}
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">
                Services
              </h4>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <button className="hover:text-sky-300 transition-colors">
                    Document Request
                  </button>
                </li>
                <li>
                  <button className="hover:text-sky-300 transition-colors">
                    Skills Directory
                  </button>
                </li>
                <li>
                  <button className="hover:text-sky-300 transition-colors">
                    Business Listings
                  </button>
                </li>
                <li>
                  <button className="hover:text-sky-300 transition-colors">
                    Help Center
                  </button>
                </li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">
                Contact
              </h4>
              <ul className="space-y-2.5 text-sm">
                <li>Barangay Hall</li>
                <li>Rabon, Rosario, La Union</li>
                <li>Visit the Barangay Hall during office hours for inquiries.</li>
              </ul>
            </div>

            {/* Hours */}
            <div>
              <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">
                Office Hours
              </h4>
              <ul className="space-y-2.5 text-sm">
                <li className="flex justify-between">
                  <span>Mon – Fri</span>
                  <span className="text-slate-300">8:00 AM – 5:00 PM</span>
                </li>
                <li className="flex justify-between">
                  <span>Saturday</span>
                  <span className="text-slate-300">8:00 AM – 12:00 PM</span>
                </li>
                <li className="flex justify-between">
                  <span>Sunday</span>
                  <span className="text-slate-500">Closed</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
            <p>© {new Date().getFullYear()} Barangay Rabon. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <a href="/privacy-policy" className="hover:text-sky-300 transition-colors">
                Privacy Policy
              </a>
              <a href="/terms-of-service" className="hover:text-sky-300 transition-colors">
                Terms of Service
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
