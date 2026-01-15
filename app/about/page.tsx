import { Header } from "@/components/Header";
import { VideoBackground } from "@/components/VideoBackground";
import { fetchTokenData } from "@/lib/tokenData";

export const revalidate = 60;

export default async function AboutPage() {
  const tokenDataResponse = await fetchTokenData();
  const tokenData = tokenDataResponse.error ? null : tokenDataResponse.data;

  return (
    <div className="min-h-screen relative">
      <VideoBackground />
      <div className="relative z-10">
        <Header tokenData={tokenData || undefined} activeTab="about" />

        <main className="container mx-auto px-4 py-6">
          <div className="max-w-3xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 text-gradient">
                About
              </h1>
              <p className="text-white/50">
                Learn more about the Movement Buyback Tracker
              </p>
            </div>

            <div className="glass rounded-xl p-6 md:p-8 space-y-6">
              {/* Placeholder content - user will provide copy */}
              <section>
                <h2 className="text-xl font-semibold text-movement-yellow mb-3">
                  About This Project
                </h2>
                <p className="text-white/70 leading-relaxed">
                  {/* User will provide copy here */}
                  Content coming soon. This section will explain the purpose and mission of the Movement Buyback Tracker.
                </p>
              </section>

              <hr className="border-white/10" />

              <section>
                <h2 className="text-xl font-semibold text-movement-yellow mb-3">
                  How It Works
                </h2>
                <p className="text-white/70 leading-relaxed">
                  {/* User will provide copy here */}
                  Content coming soon. This section will explain how the buyback mechanism and TWAP bot work.
                </p>
              </section>

              <hr className="border-white/10" />

              <section>
                <h2 className="text-xl font-semibold text-movement-yellow mb-3">
                  The Team
                </h2>
                <p className="text-white/70 leading-relaxed">
                  {/* User will provide copy here */}
                  Content coming soon. This section will introduce the team behind the project.
                </p>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
