import { getReportingData } from "@/lib/actions/rapports";
import ReportCharts from "@/components/rapports/report-charts";
import { BarChart3, TrendingUp, Euro, Star, ThumbsUp } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function RapportsPage() {
  let data = {
    kpis: { totalCA: 0, totalBenefice: 0, totalEvents: 0, margeMoyenne: 0, avgSatisfaction: 0, recommandes: 0 },
    caParType: [] as { type: string; ca: number; count: number; benefice: number }[],
    caParMois: [] as { mois: string; ca: number; count: number; benefice: number }[],
    caParRegion: [] as { region: string; ca: number; count: number }[],
    resultats: [] as Awaited<ReturnType<typeof getReportingData>>["resultats"],
  };
  try {
    data = await getReportingData();
  } catch (error) {
    console.error("[rapports] Erreur chargement :", error);
  }
  const { kpis } = data;

  const hasData = data.resultats.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Rapports</h1>
        <p className="text-sm text-zinc-400">
          Chiffre d&apos;affaires, rentabilité et comparaisons
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Euro className="h-3.5 w-3.5" />
            CA Total
          </div>
          <div className="mt-1 text-xl font-semibold text-zinc-100">
            {kpis.totalCA.toLocaleString("fr-FR")}€
          </div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <TrendingUp className="h-3.5 w-3.5" />
            Bénéfice net
          </div>
          <div
            className={`mt-1 text-xl font-semibold ${
              kpis.totalBenefice >= 0 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {kpis.totalBenefice.toLocaleString("fr-FR")}€
          </div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <BarChart3 className="h-3.5 w-3.5" />
            Événements
          </div>
          <div className="mt-1 text-xl font-semibold text-zinc-100">
            {kpis.totalEvents}
          </div>
          <div className="text-xs text-zinc-500">
            Marge moy. {kpis.margeMoyenne}%
          </div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Star className="h-3.5 w-3.5" />
            Satisfaction
          </div>
          <div className="mt-1 text-xl font-semibold text-amber-400">
            {kpis.avgSatisfaction}/5
          </div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <ThumbsUp className="h-3.5 w-3.5" />
            Recommandés
          </div>
          <div className="mt-1 text-xl font-semibold text-zinc-100">
            {kpis.recommandes}/{kpis.totalEvents}
          </div>
        </div>
      </div>

      {/* Graphiques */}
      {hasData ? (
        <ReportCharts
          caParType={data.caParType}
          caParMois={data.caParMois}
          caParRegion={data.caParRegion}
        />
      ) : (
        <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-zinc-800">
          <div className="text-center">
            <BarChart3 className="mx-auto h-8 w-8 text-zinc-600" />
            <p className="mt-2 text-sm text-zinc-500">
              Aucune donnée de résultat disponible
            </p>
            <p className="text-xs text-zinc-600">
              Les graphiques apparaîtront après le premier événement terminé
              avec un résultat saisi
            </p>
          </div>
        </div>
      )}

      {/* Détail des résultats */}
      {hasData && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <h3 className="mb-3 text-sm font-medium text-zinc-300">
            Détail des événements ({data.resultats.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-zinc-400">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="py-2 text-left font-medium">Événement</th>
                  <th className="py-2 text-left font-medium">Ville</th>
                  <th className="py-2 text-right font-medium">CA</th>
                  <th className="py-2 text-right font-medium">Coûts</th>
                  <th className="py-2 text-right font-medium">Bénéfice</th>
                  <th className="py-2 text-right font-medium">Marge</th>
                  <th className="py-2 text-center font-medium">Note</th>
                  <th className="py-2 text-center font-medium">Rec.</th>
                </tr>
              </thead>
              <tbody>
                {data.resultats.map((r) => {
                  const cout = r.evenement.cout
                    ? Number(r.evenement.cout.coutTotal)
                    : 0;
                  const benefice = Number(r.beneficeNet || 0);
                  const marge = Number(r.margePct || 0);

                  return (
                    <tr key={r.id} className="border-b border-zinc-800/50">
                      <td className="py-2 text-zinc-300">{r.evenement.nom}</td>
                      <td className="py-2">{r.evenement.ville}</td>
                      <td className="py-2 text-right font-mono">
                        {Number(r.chiffreAffaires).toFixed(0)}€
                      </td>
                      <td className="py-2 text-right font-mono">
                        {cout.toFixed(0)}€
                      </td>
                      <td
                        className={`py-2 text-right font-mono ${
                          benefice >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {benefice.toFixed(0)}€
                      </td>
                      <td
                        className={`py-2 text-right font-mono ${
                          marge >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {marge.toFixed(1)}%
                      </td>
                      <td className="py-2 text-center text-amber-400">
                        {r.noteSatisfaction ? `${r.noteSatisfaction}/5` : "—"}
                      </td>
                      <td className="py-2 text-center">
                        {r.recommande ? "✓" : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
