import { listTemplates } from "@/lib/actions/prospection";
import { TemplatesManager } from "@/components/templates/templates-manager";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  let templates: Awaited<ReturnType<typeof listTemplates>> = [];
  try {
    templates = await listTemplates();
  } catch (error) {
    console.error("[templates] Erreur chargement :", error);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          href="/parametres"
          className="mb-2 flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
        >
          <ArrowLeft className="h-3 w-3" /> Retour aux paramètres
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Templates email</h1>
        <p className="text-sm text-zinc-400">
          Créez et modifiez vos modèles d&apos;emails de prospection
        </p>
      </div>

      <TemplatesManager templates={templates} />
    </div>
  );
}
