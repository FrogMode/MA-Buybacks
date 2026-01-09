import { StatsCards } from "@/components/StatsCards";
import { BuybackChart } from "@/components/BuybackChart";
import { TransactionTable } from "@/components/TransactionTable";
import { Header } from "@/components/Header";
import { TokenInfo } from "@/components/TokenInfo";
import { fetchTokenData } from "@/lib/tokenData";

export const revalidate = 60; // Revalidate every 60 seconds

export default async function Home() {
  const tokenDataResponse = await fetchTokenData();
  const tokenData = tokenDataResponse.error ? null : tokenDataResponse.data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <Header tokenData={tokenData || undefined} />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            $MOVE Token Buyback Tracker
          </h1>
          <p className="text-gray-400">
            Real-time monitoring of $MOVE token buyback activity onchain
          </p>
        </div>

        {tokenData && <TokenInfo data={tokenData} />}

        {tokenDataResponse.error && (
          <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4 mb-8">
            <p className="text-yellow-400 text-sm">
              Unable to fetch token data: {tokenDataResponse.error}
            </p>
          </div>
        )}

        <StatsCards />

        <div className="mt-8">
          <BuybackChart />
        </div>

        <div className="mt-8">
          <TransactionTable />
        </div>
      </main>
    </div>
  );
}
