import { Header } from "@/components/Header";
import { VideoBackground } from "@/components/VideoBackground";
import { TWAPClientContent } from "@/components/twap/TWAPClientContent";
import { fetchTokenData } from "@/lib/tokenData";

export const revalidate = 60; // Revalidate every 60 seconds

export default async function TWAPPage() {
  const tokenDataResponse = await fetchTokenData();
  const tokenData = tokenDataResponse.error ? null : tokenDataResponse.data;

  return (
    <div className="min-h-screen relative">
      <VideoBackground />
      <div className="relative z-10">
        <Header tokenData={tokenData || undefined} activeTab="twap" />

        <main className="container mx-auto px-4 py-6">
          <TWAPClientContent />
        </main>
      </div>
    </div>
  );
}
