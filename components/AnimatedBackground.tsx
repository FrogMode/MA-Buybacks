"use client";

import { useEffect, useRef, useState } from "react";

interface Orb {
  x: number;
  y: number;
  size: number;
  color: string;
  vx: number;
  vy: number;
}

export function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const orbsRef = useRef<Orb[]>([]);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Initialize orbs
    const colors = [
      "rgba(255, 218, 0, 0.15)", // Yellow
      "rgba(255, 218, 0, 0.08)", // Yellow lighter
      "rgba(120, 119, 198, 0.1)", // Purple
      "rgba(255, 255, 255, 0.03)", // White
    ];

    orbsRef.current = Array.from({ length: 5 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 300 + 200,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
    }));

    // Mouse tracking
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleMouseMove);

    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw base gradient
      const baseGradient = ctx.createRadialGradient(
        canvas.width / 2,
        0,
        0,
        canvas.width / 2,
        0,
        canvas.height
      );
      baseGradient.addColorStop(0, "rgba(255, 218, 0, 0.03)");
      baseGradient.addColorStop(1, "transparent");
      ctx.fillStyle = baseGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw and update orbs
      orbsRef.current.forEach((orb) => {
        // Mouse influence
        const dx = mouseRef.current.x - orb.x;
        const dy = mouseRef.current.y - orb.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = 400;

        if (dist < maxDist) {
          const force = (maxDist - dist) / maxDist;
          orb.vx += (dx / dist) * force * 0.02;
          orb.vy += (dy / dist) * force * 0.02;
        }

        // Apply velocity with damping
        orb.x += orb.vx;
        orb.y += orb.vy;
        orb.vx *= 0.99;
        orb.vy *= 0.99;

        // Bounce off edges
        if (orb.x < -orb.size) orb.x = canvas.width + orb.size;
        if (orb.x > canvas.width + orb.size) orb.x = -orb.size;
        if (orb.y < -orb.size) orb.y = canvas.height + orb.size;
        if (orb.y > canvas.height + orb.size) orb.y = -orb.size;

        // Draw orb with radial gradient
        const gradient = ctx.createRadialGradient(
          orb.x,
          orb.y,
          0,
          orb.x,
          orb.y,
          orb.size
        );
        gradient.addColorStop(0, orb.color);
        gradient.addColorStop(1, "transparent");

        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.size, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      });

      // Draw mouse glow
      const mouseGlow = ctx.createRadialGradient(
        mouseRef.current.x,
        mouseRef.current.y,
        0,
        mouseRef.current.x,
        mouseRef.current.y,
        200
      );
      mouseGlow.addColorStop(0, "rgba(255, 218, 0, 0.08)");
      mouseGlow.addColorStop(0.5, "rgba(255, 218, 0, 0.02)");
      mouseGlow.addColorStop(1, "transparent");

      ctx.beginPath();
      ctx.arc(mouseRef.current.x, mouseRef.current.y, 200, 0, Math.PI * 2);
      ctx.fillStyle = mouseGlow;
      ctx.fill();

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("mousemove", handleMouseMove);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ background: "#050508" }}
    />
  );
}
