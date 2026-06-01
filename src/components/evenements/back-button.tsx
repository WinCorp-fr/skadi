"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function BackButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className="mb-2 flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
    >
      <ArrowLeft className="h-3 w-3" /> Retour aux événements
    </button>
  );
}
