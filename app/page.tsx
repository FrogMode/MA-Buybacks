import { StatsCards } from "@/components/StatsCards";
import { BuybackChart } from "@/components/BuybackChart";
import { TransactionTable } from "@/components/TransactionTable";
import { Header } from "@/components/Header";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            $MOVE Token Buyback Tracker
          </h1>
          <p className="text-gray-400">
            Real-time monitoring of $MOVE token buyback activity onchain
          </p>
        </div>

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
