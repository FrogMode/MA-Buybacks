"use client";

import { TrendingUp, Bot } from "lucide-react";
import { TokenMarketData } from "@/types";
import { formatPrice, formatPercentageChange } from "@/lib/tokenData";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface HeaderProps {
  tokenData?: TokenMarketData;
  activeTab?: "tracker" | "twap";
}

export function Header({ tokenData, activeTab }: HeaderProps) {
  const pathname = usePathname();
  const currentTab = activeTab || (pathname === "/twap" ? "twap" : "tracker");

  const priceChange = tokenData
    ? formatPercentageChange(tokenData.priceChangePercentage24h)
    : null;

  return (
    <header className="glass-subtle sticky top-0 z-50 border-b border-white/5">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              {tokenData?.logoUrl ? (
                <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-white/5 ring-1 ring-white/10">
                  <Image
                    src={tokenData.logoUrl}
                    alt="MOVE logo"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="bg-movement-yellow/90 p-2 rounded-xl shadow-lg shadow-movement-yellow/20">
                  <TrendingUp className="w-6 h-6 text-black" />
                </div>
              )}
              <div>
                <h2 className="text-xl font-bold text-white">Move Alliance</h2>
                <p className="text-xs text-white/50">Buyback Dashboard</p>
              </div>
            </div>

            {/* Tab Navigation */}
            <nav className="hidden md:flex items-center gap-1 ml-4">
              <Link
                href="/"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  currentTab === "tracker"
                    ? "bg-movement-yellow/20 text-movement-yellow border border-movement-yellow/30"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                Tracker
              </Link>
              <Link
                href="/twap"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  currentTab === "twap"
                    ? "bg-movement-yellow/20 text-movement-yellow border border-movement-yellow/30"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <Bot className="w-4 h-4" />
                TWAP Bot
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {tokenData && (
              <div className="hidden lg:flex items-center gap-3 px-4 py-2 glass rounded-xl">
                <div>
                  <p className="text-xs text-white/50">Price</p>
                  <p className="text-sm font-semibold text-white">
                    {formatPrice(tokenData.price)}
                  </p>
                </div>
                {priceChange && (
                  <span
                    className={`text-xs font-medium ${
                      priceChange.color === "green"
                        ? "text-emerald-400"
                        : priceChange.color === "red"
                        ? "text-red-400"
                        : "text-white/50"
                    }`}
                  >
                    {priceChange.text}
                  </span>
                )}
              </div>
            )}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-lg shadow-emerald-400/50"></div>
              <span className="text-sm text-emerald-400 font-medium">Live</span>
            </div>

            {/* Mobile Tab Navigation */}
            <nav className="flex md:hidden items-center gap-1">
              <Link
                href="/"
                className={`p-2 rounded-lg transition-all ${
                  currentTab === "tracker"
                    ? "bg-movement-yellow/20 text-movement-yellow"
                    : "text-white/60"
                }`}
              >
                <TrendingUp className="w-5 h-5" />
              </Link>
              <Link
                href="/twap"
                className={`p-2 rounded-lg transition-all ${
                  currentTab === "twap"
                    ? "bg-movement-yellow/20 text-movement-yellow"
                    : "text-white/60"
                }`}
              >
                <Bot className="w-5 h-5" />
              </Link>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
