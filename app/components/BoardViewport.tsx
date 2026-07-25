import Board from "./Board";

export default function BoardViewport() {
  return (
    <div className="absolute inset-0 h-full w-full overflow-hidden">
      <Board />
    </div>
  );
}