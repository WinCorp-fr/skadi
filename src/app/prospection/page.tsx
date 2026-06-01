import { prisma } from "@/lib/prisma";
import EmailComposer from "@/components/prospection/email-composer";
import ProspectionList from "@/components/prospection/prospection-list";

export const dynamic = "force-dynamic";

export default async function ProspectionPage() {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let prospections: any[] = [];
  let evenements: { id: number; nom: string; ville: string; emailContact: string | null }[] = [];
  let templates: { id: number; nom: string }[] = [];

  try {
    [prospections, evenements, templates] = await Promise.all([
      prisma.prospection.findMany({
        include: {
          evenement: { select: { id: true, nom: true, ville: true, emailContact: true } },
          template: { select: { id: true, nom: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.evenement.findMany({
        where: {
          statutPipeline: { in: ["INTERESSE", "PROSPECTION", "RESERVE"] },
        },
        select: { id: true, nom: true, ville: true, emailContact: true },
        orderBy: { nom: "asc" },
      }),
      prisma.emailTemplate.findMany({
        select: { id: true, nom: true },
        orderBy: { nom: "asc" },
      }),
    ]);
  } catch (error) {
    console.error("[prospection] Erreur chargement :", error);
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  // Compteurs par statut
  const counts = {
    brouillon: prospections.filter((p) => p.statut === "BROUILLON").length,
    pret: prospections.filter((p) => p.statut === "PRET").length,
    envoye: prospections.filter((p) => p.statut === "ENVOYE").length,
    repondu: prospections.filter((p) => p.statut === "REPONDU").length,
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Prospection</h1>
        <p className="text-sm text-zinc-400">
          Gestion des emails de prospection et suivi des réponses
        </p>
      </div>

      {/* Compteurs */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
          <div className="text-lg font-semibold text-zinc-100">{counts.brouillon}</div>
          <div className="text-xs text-zinc-400">Brouillons</div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
          <div className="text-lg font-semibold text-amber-400">{counts.pret}</div>
          <div className="text-xs text-zinc-400">Prêts à envoyer</div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
          <div className="text-lg font-semibold text-blue-400">{counts.envoye}</div>
          <div className="text-xs text-zinc-400">Envoyés</div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
          <div className="text-lg font-semibold text-emerald-400">{counts.repondu}</div>
          <div className="text-xs text-zinc-400">Répondus</div>
        </div>
      </div>

      {/* Composer un email */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-6">
        <h2 className="text-lg font-medium text-zinc-100 mb-4">
          Nouveau email de prospection
        </h2>
        <EmailComposer evenements={evenements} templates={templates} />
      </div>

      {/* Liste des prospections */}
      <div>
        <h2 className="text-lg font-medium text-zinc-100 mb-3">
          Prospections ({prospections.length})
        </h2>
        <ProspectionList prospections={prospections} />
      </div>
    </div>
  );
}
