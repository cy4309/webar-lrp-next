import GameEngine from "@/components/Game/GameEngine";

export const metadata = {
  title: "Game | La Roche-Posay",
  description: "Interactive Photo Game",
};

export default function GamePage() {
  return (
    <main className="min-h-dvh bg-black">
      <GameEngine />
    </main>
  );
}
