import BoardViewport from "./components/BoardViewport";
import HUD from "./components/HUD";

export default function HomePage() {
  return (
    <main className="relative h-dvh overflow-hidden bg-gray-200">
      <BoardViewport />
      <HUD />
    </main>
  );
}