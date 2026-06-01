import { getParametres } from "@/lib/actions/parametres";
import { ParametresForm } from "@/components/parametres/parametres-form";
import Link from "next/link";
import { Mail } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ParametresPage() {
  let initial = {
    adresseBase: "",
    latitudeBase: null as number | null,
    longitudeBase: null as number | null,
    prixCarburantLitre: 1.80,
    consommationL100km: 8.0,
    perDiemNourriture: 15.0,
    margeCiblePct: 30.0,
    tauxPeageParKm: 0.09,
    pourcentageAutoroute: 0.60,
    seuilHebergementKm: 150,
    coutHebergementNuit: 70.0,
    emailExpediteur: null as string | null,
    smtpHost: null as string | null,
    smtpPort: 587 as number | null,
    smtpUser: null as string | null,
    smtpPassword: null as string | null,
  };

  try {
    const params = await getParametres();
    initial = {
      adresseBase: params.adresseBase,
      latitudeBase: params.latitudeBase,
      longitudeBase: params.longitudeBase,
      prixCarburantLitre: Number(params.prixCarburantLitre),
      consommationL100km: Number(params.consommationL100km),
      perDiemNourriture: Number(params.perDiemNourriture),
      margeCiblePct: Number(params.margeCiblePct),
      tauxPeageParKm: Number(params.tauxPeageParKm),
      pourcentageAutoroute: Number(params.pourcentageAutoroute),
      seuilHebergementKm: params.seuilHebergementKm,
      coutHebergementNuit: Number(params.coutHebergementNuit),
      emailExpediteur: params.emailExpediteur,
      smtpHost: params.smtpHost,
      smtpPort: params.smtpPort,
      smtpUser: params.smtpUser,
      smtpPassword: params.smtpPassword,
    };
  } catch (error) {
    console.error("[parametres] Erreur chargement :", error);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Paramètres</h1>
        <p className="text-sm text-zinc-400">
          Configuration du client et des agents
        </p>
      </div>

      <ParametresForm initial={initial} />

      {/* Lien vers les templates email */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-zinc-500" />
            <div>
              <h2 className="text-sm font-medium text-zinc-300">Templates email</h2>
              <p className="text-xs text-zinc-500">Modèles de prospection réutilisables</p>
            </div>
          </div>
          <Link
            href="/parametres/templates"
            className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
          >
            Gérer les templates →
          </Link>
        </div>
      </div>
    </div>
  );
}
