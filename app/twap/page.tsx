import { Header } from "@/components/Header";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { TWAPClientContent } from "@/components/twap/TWAPClientContent";
import { fetchTokenData } from "@/lib/tokenData";
import { TrendingUp } from "lucide-react";

export const revalidate = 60; // Revalidate every 60 seconds

export default async function TWAPPage() {
  const tokenDataResponse = await fetchTokenData();
  const tokenData = tokenDataResponse.error ? null : tokenDataResponse.data;

  return (
    <div className="min-h-screen relative">
      <AnimatedBackground />
      <div className="relative z-10">
        <Header tokenData={tokenData || undefined} activeTab="twap" />

        <main className="container mx-auto px-4 py-6">
          <TWAPClientContent />
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
                TWAP Buyback Bot for Movement Network
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
