import BoardCanvas from "./BoardCanvas";

export default function Board() {
  return (
    <section
      aria-label="StillPoor board"
      className="absolute inset-0 h-full w-full"
    >
      <BoardCanvas />
    </section>
  );
}