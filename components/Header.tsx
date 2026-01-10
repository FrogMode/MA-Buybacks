"use client";

import { TrendingUp } from "lucide-react";
import { TokenMarketData } from "@/types";
import { formatPrice, formatPercentageChange } from "@/lib/tokenData";
import Image from "next/image";

interface HeaderProps {
  tokenData?: TokenMarketData;
}

export function Header({ tokenData }: HeaderProps) {
  const priceChange = tokenData
    ? formatPercentageChange(tokenData.priceChangePercentage24h)
    : null;

  return (
    <header className="glass-subtle sticky top-0 z-50 border-b border-white/5">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
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
              <p className="text-xs text-white/50">Buyback Tracker</p>
            </div>
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
          </div>
        </div>
      </div>
    </header>
  );
}
