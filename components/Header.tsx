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
    <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {tokenData?.logoUrl ? (
              <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-gray-800">
                <Image
                  src={tokenData.logoUrl}
                  alt="MOVE logo"
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : (
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-lg">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-white">$MOVE Buyback</h2>
              <p className="text-xs text-gray-400">Onchain Tracker</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {tokenData && (
              <div className="hidden lg:flex items-center gap-3 px-4 py-2 bg-gray-800/50 rounded-lg">
                <div>
                  <p className="text-xs text-gray-400">Price</p>
                  <p className="text-sm font-semibold text-white">
                    {formatPrice(tokenData.price)}
                  </p>
                </div>
                {priceChange && (
                  <span
                    className={`text-xs font-medium ${
                      priceChange.color === "green"
                        ? "text-green-400"
                        : priceChange.color === "red"
                        ? "text-red-400"
                        : "text-gray-400"
                    }`}
                  >
                    {priceChange.text}
                  </span>
                )}
              </div>
            )}
            <div className="hidden md:flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-400">Live</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
