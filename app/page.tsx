import { StatsCards } from "@/components/StatsCards";
import { BuybackChart } from "@/components/BuybackChart";
import { TransactionTable } from "@/components/TransactionTable";
import { Header } from "@/components/Header";
import { TokenInfo } from "@/components/TokenInfo";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { fetchTokenData } from "@/lib/tokenData";

export const revalidate = 60; // Revalidate every 60 seconds

export default async function Home() {
  const tokenDataResponse = await fetchTokenData();
  const tokenData = tokenDataResponse.error ? null : tokenDataResponse.data;

  return (
    <div className="min-h-screen relative">
      <AnimatedBackground />
      <div className="relative z-10">
        <Header tokenData={tokenData || undefined} />

        <main className="container mx-auto px-4 py-6">
          <div className="mb-6">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-1 text-gradient">
              Move Alliance Buyback Tracker
            </h1>
            <p className="text-white/50">
              Real-time monitoring of $MOVE token buyback activity onchain
            </p>
          </div>

          {tokenData && <TokenInfo data={tokenData} />}

          {tokenDataResponse.error && (
            <div className="glass rounded-xl p-4 mb-8 border-movement-yellow/30">
              <p className="text-movement-yellow text-sm">
                Unable to fetch token data: {tokenDataResponse.error}
              </p>
            </div>
          )}

          <StatsCards />

          <div className="mt-6">
            <BuybackChart />
          </div>

          <div className="mt-6">
            <TransactionTable />
          </div>
        </main>

        <footer className="glass-subtle border-t border-white/5 py-6 mt-10">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="bg-movement-yellow p-1.5 rounded-lg shadow-lg shadow-movement-yellow/20">
                  <TrendingUp className="w-4 h-4 text-black" />
                </div>
                <span className="font-semibold text-white">Movement Network</span>
              </div>
              <p className="text-white/40 text-sm">
                Tracking $MOVE buybacks on Movement Network
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

function TrendingUp({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}
