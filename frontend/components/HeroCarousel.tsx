"use client";
import React, { useState, useEffect } from "react";
import Image from "next/image";

// Update this array when you have your images
const images = [
   "/assets/slides/hero1.jpg",
   "/assets/slides/hero2.jpg",
   "/assets/slides/hero3.jpg",
];

export default function HeroCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (images.length === 0) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  // If no images are provided, don't render the carousel
  if (images.length === 0) return null;

  return (
    <div className="absolute inset-0 z-0 overflow-hidden">
      {images.map((src, index) => (
        <div
          key={src}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            index === currentIndex ? "opacity-100" : "opacity-0"
          }`}
        >
          {/* We use a span or simplified container just to hold the image 
              in case the file doesn't exist yet to avoid runtime errors */}
          <Image 
            src={src} 
            alt="Barangay Rabon Community" 
            fill 
            className="object-cover" 
            priority={index === 0}
            onError={(e) => {
              // Graceful handling if image not found
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      ))}
      {/* Dark gradient overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/70 via-slate-900/40 to-slate-900/20" />
      
      {/* Indicators */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-2 z-10">
        {images.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`w-3 h-3 rounded-full transition-all ${
              index === currentIndex ? "bg-white scale-110" : "bg-white/50"
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
