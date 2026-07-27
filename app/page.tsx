import BoardViewport from "./components/BoardViewport";
import HUD from "./components/HUD";

export default function HomePage() {
  const isComingSoon =
    process.env.SITE_MODE === "coming_soon";

  if (isComingSoon) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#e9e9e9] px-6 text-[#111111]">
        <div className="text-center">
          <h1 className="text-5xl font-bold tracking-[-0.06em] sm:text-7xl">
            stillpoor
          </h1>

          <p className="mt-4 text-sm uppercase tracking-[0.24em] text-black/55">
            Coming soon
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative h-dvh overflow-hidden bg-gray-200">
      <BoardViewport />
      <HUD />
    </main>
  );
}