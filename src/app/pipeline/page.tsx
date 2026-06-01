import { prisma } from "@/lib/prisma";
import PipelineBoard from "@/components/pipeline/pipeline-board";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  let events: Awaited<ReturnType<typeof prisma.evenement.findMany<{ where: object; include: { cout: true }; orderBy: object }>>> = [];
  try {
    const raw = await prisma.evenement.findMany({
      where: {
        statutPipeline: { not: "ARCHIVE" },
      },
      include: { cout: true },
      orderBy: [{ scorePertinence: "desc" }, { dateDebut: "asc" }],
    });
    events = raw.map((e) => ({
      ...e,
      prixEmplacement: e.prixEmplacement != null ? Number(e.prixEmplacement) : null,
      cout: e.cout
        ? {
            ...e.cout,
            coutCarburant: Number(e.cout.coutCarburant),
            coutPeage: Number(e.cout.coutPeage),
            coutEmplacement: Number(e.cout.coutEmplacement),
            coutHebergement: Number(e.cout.coutHebergement),
            coutNourriture: Number(e.cout.coutNourriture),
            coutDivers: Number(e.cout.coutDivers),
            coutTotal: Number(e.cout.coutTotal),
            seuilRentabilite: e.cout.seuilRentabilite != null ? Number(e.cout.seuilRentabilite) : null,
          }
        : null,
    })) as typeof events;
  } catch (error) {
    console.error("[pipeline] Erreur chargement :", error);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
        <p className="text-sm text-zinc-400">
          Glissez-déposez les événements entre les colonnes pour suivre votre prospection
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-600">
          <span><strong className="text-zinc-400">Découvert</strong> → trouvé par le scraper</span>
          <span><strong className="text-blue-400">À étudier</strong> → vous intéresse, à creuser</span>
          <span><strong className="text-amber-400">À prospecter</strong> → email à envoyer</span>
          <span><strong className="text-violet-400">Réservé</strong> → emplacement réservé</span>
          <span><strong className="text-emerald-400">Confirmé</strong> → payé, c&apos;est officiel</span>
          <span><strong className="text-zinc-400">Terminé</strong> → événement passé, saisir le résultat</span>
        </div>
      </div>

      <PipelineBoard events={events} />
    </div>
  );
}
