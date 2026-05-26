import { Lock } from "lucide-react";

export default function UnavailableFeature({ name }: { name: string }) {
  return (
    <div className="min-h-[60vh] px-4 py-10 md:px-6">
      <div className="mx-auto max-w-2xl border border-dashed border-white/15 bg-black/60 p-8 opacity-60">
        <div className="mb-5 flex items-center gap-3">
          <Lock className="h-5 w-5 text-white/50" />
          <h1 className="font-mono text-lg uppercase text-white/70">{name}</h1>
        </div>
        <p className="font-mono text-xs uppercase leading-6 text-white/45">
          This surface is not enabled in this deployment.
        </p>
      </div>
    </div>
  );
}
