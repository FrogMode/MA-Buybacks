import { TokenMarketData } from "@/types";
import { formatPrice, formatMarketCap, formatPercentageChange } from "@/lib/tokenData";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import Image from "next/image";

interface TokenInfoProps {
  data: TokenMarketData;
}

export function TokenInfo({ data }: TokenInfoProps) {
  const priceChange = formatPercentageChange(data.priceChangePercentage24h);

  return (
    <div className="glass glass-glow rounded-xl p-4 mb-6 border-movement-yellow/10">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Token Info */}
        <div className="flex items-center gap-3">
          {data.logoUrl && (
            <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-white/5 flex-shrink-0 ring-2 ring-white/10">
              <Image
                src={data.logoUrl}
                alt={`${data.name} logo`}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">{data.name}</h2>
              <span className="text-white/50">{data.symbol}</span>
              {data.marketCapRank && (
                <span className="bg-movement-yellow/20 text-movement-yellow text-xs px-2 py-1 rounded-lg font-medium">
                  Rank #{data.marketCapRank}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-white">
                {formatPrice(data.price)}
              </span>
              <div
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium ${
                  priceChange.color === "green"
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : priceChange.color === "red"
                    ? "bg-red-500/10 text-red-400 border border-red-500/20"
                    : "bg-white/5 text-white/50 border border-white/10"
                }`}
              >
                {priceChange.color === "green" && <TrendingUp className="w-4 h-4" />}
                {priceChange.color === "red" && <TrendingDown className="w-4 h-4" />}
                {priceChange.color === "gray" && <Minus className="w-4 h-4" />}
                <span className="text-sm">{priceChange.text}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Market Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="glass-subtle rounded-lg p-2.5">
            <p className="text-white/40 text-xs">Market Cap</p>
            <p className="text-white font-semibold">
              {formatMarketCap(data.marketCap)}
            </p>
          </div>
          <div className="glass-subtle rounded-lg p-2.5">
            <p className="text-white/40 text-xs">24h Volume</p>
            <p className="text-white font-semibold">
              {formatMarketCap(data.volume24h)}
            </p>
          </div>
          <div className="glass-subtle rounded-lg p-2.5">
            <p className="text-white/40 text-xs">Circulating</p>
            <p className="text-white font-semibold">
              {data.circulatingSupply.toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Data Source Info */}
      <div className="mt-3 pt-3 border-t border-white/5">
        <p className="text-xs text-white/30">
          Data from CoinGecko • Last updated:{" "}
          {new Date(data.lastUpdated).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}
