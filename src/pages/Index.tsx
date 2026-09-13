import { Loader2, Paintbrush } from "lucide-react";

export default function Index() {
  return (
    <div className="min-h-screen flex items-center justify-center gradient-primary">
      <div className="text-white text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 gradient-accent">
          <Paintbrush className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold mb-2">PintorPro</h1>
        <Loader2 className="w-6 h-6 animate-spin mx-auto opacity-70" />
      </div>
    </div>
  );
}
