import Image from "next/image";

import BoardViewport from "./components/BoardViewport";
import HUD from "./components/HUD";

export default function HomePage() {
  const isComingSoon =
    process.env.SITE_MODE === "coming_soon";

  if (isComingSoon) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#e9e9e9] px-6">
        <div className="flex flex-col items-center gap-6 text-center">
          <Image
            src="/stillpoor-logo.svg"
            alt="StillPoor"
            width={396}
            height={123}
            priority
            className="h-auto w-[264px] sm:w-[330px]"
          />

          <p className="text-xl font-medium tracking-[-0.025em] text-[#030712]/55 sm:text-2xl">
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