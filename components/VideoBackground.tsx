"use client";

import { useEffect, useRef, useState } from "react";

export function VideoBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = 0.75; // Slow down slightly for smoother effect
    }
  }, []);

  return (
    <>
      {/* Video Background */}
      <div className="fixed inset-0 z-0 overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          onLoadedData={() => setIsLoaded(true)}
          className={`absolute w-full h-full object-cover transition-opacity duration-1000 ${
            isLoaded ? "opacity-100" : "opacity-0"
          }`}
        >
          <source src="/videos/movement-bg.webm" type="video/webm" />
          <source src="/videos/movement-bg.mp4" type="video/mp4" />
        </video>

        {/* Dark overlay for readability - reduced for brighter video */}
        <div className="absolute inset-0 bg-black/30" />

        {/* Gradient overlays for depth - lighter */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/50" />
      </div>

      {/* Fallback gradient background while video loads */}
      <div
        className={`fixed inset-0 z-0 bg-movement-dark transition-opacity duration-1000 ${
          isLoaded ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% -20%, rgba(255, 218, 0, 0.15) 0%, transparent 50%),
            radial-gradient(ellipse 60% 40% at 80% 50%, rgba(255, 218, 0, 0.08) 0%, transparent 40%),
            radial-gradient(ellipse 50% 30% at 20% 80%, rgba(120, 119, 198, 0.08) 0%, transparent 40%),
            linear-gradient(180deg, #050508 0%, #0a0a12 50%, #050508 100%)
          `,
        }}
      />

      {/* Noise texture overlay */}
      <div className="fixed inset-0 z-[1] pointer-events-none opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </>
  );
}
