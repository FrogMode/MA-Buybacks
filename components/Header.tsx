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
    <header className="border-b border-movement-dark-700/50 bg-movement-dark-800/80 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {tokenData?.logoUrl ? (
              <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-movement-dark-700 ring-2 ring-movement-teal-500/30">
                <Image
                  src={tokenData.logoUrl}
                  alt="MOVE logo"
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : (
              <div className="bg-gradient-to-br from-movement-teal-500 to-movement-yellow-500 p-2 rounded-lg">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-movement-teal-400 to-movement-yellow-500 bg-clip-text text-transparent">
                $MOVE Buyback
              </h2>
              <p className="text-xs text-movement-dark-300">Powered by Movement Network</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {tokenData && (
              <div className="hidden lg:flex items-center gap-3 px-4 py-2 bg-movement-dark-700/50 rounded-lg border border-movement-teal-500/20">
                <div>
                  <p className="text-xs text-movement-dark-300">Price</p>
                  <p className="text-sm font-semibold text-white">
                    {formatPrice(tokenData.price)}
                  </p>
                </div>
                {priceChange && (
                  <span
                    className={`text-xs font-medium ${
                      priceChange.color === "green"
                        ? "text-movement-teal-400"
                        : priceChange.color === "red"
                        ? "text-red-400"
                        : "text-movement-dark-300"
                    }`}
                  >
                    {priceChange.text}
                  </span>
                )}
              </div>
            )}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-movement-teal-500/10 rounded-full border border-movement-teal-500/30">
              <div className="w-2 h-2 bg-movement-teal-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-movement-teal-400 font-medium">Live</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
