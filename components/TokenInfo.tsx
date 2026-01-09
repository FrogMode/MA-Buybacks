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
    <div className="bg-gradient-to-r from-movement-teal-900/30 to-movement-dark-800/50 backdrop-blur-sm border border-movement-teal-500/30 rounded-xl p-6 mb-8 shadow-lg shadow-movement-teal-500/10">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        {/* Token Info */}
        <div className="flex items-center gap-4">
          {data.logoUrl && (
            <div className="relative w-16 h-16 rounded-full overflow-hidden bg-movement-dark-700 flex-shrink-0 ring-2 ring-movement-teal-500/40">
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
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-2xl font-bold text-white">{data.name}</h2>
              <span className="text-movement-dark-300 text-lg">{data.symbol}</span>
              {data.marketCapRank && (
                <span className="bg-movement-teal-500/20 text-movement-teal-400 text-xs px-2 py-1 rounded border border-movement-teal-500/30">
                  Rank #{data.marketCapRank}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold text-white">
                {formatPrice(data.price)}
              </span>
              <div
                className={`flex items-center gap-1 px-2 py-1 rounded ${
                  priceChange.color === "green"
                    ? "bg-movement-teal-500/20 text-movement-teal-400 border border-movement-teal-500/30"
                    : priceChange.color === "red"
                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                    : "bg-movement-dark-500/20 text-movement-dark-300 border border-movement-dark-500/30"
                }`}
              >
                {priceChange.color === "green" && <TrendingUp className="w-4 h-4" />}
                {priceChange.color === "red" && <TrendingDown className="w-4 h-4" />}
                {priceChange.color === "gray" && <Minus className="w-4 h-4" />}
                <span className="text-sm font-medium">{priceChange.text}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Market Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          <div>
            <p className="text-movement-dark-300 text-xs mb-1">Market Cap</p>
            <p className="text-white font-semibold text-lg">
              {formatMarketCap(data.marketCap)}
            </p>
          </div>
          <div>
            <p className="text-movement-dark-300 text-xs mb-1">24h Volume</p>
            <p className="text-white font-semibold text-lg">
              {formatMarketCap(data.volume24h)}
            </p>
          </div>
          <div className="col-span-2 md:col-span-1">
            <p className="text-movement-dark-300 text-xs mb-1">Circulating Supply</p>
            <p className="text-white font-semibold text-lg">
              {data.circulatingSupply.toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Data Source Info */}
      <div className="mt-4 pt-4 border-t border-movement-teal-500/20">
        <p className="text-xs text-movement-dark-400">
          Data from CoinGecko • Last updated:{" "}
          {new Date(data.lastUpdated).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}
