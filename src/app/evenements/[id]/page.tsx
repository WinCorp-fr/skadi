import { notFound } from "next/navigation";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Mail,
  Phone,
  Calendar,
  Euro,
  Users,
} from "lucide-react";
import Link from "next/link";
import { CoutDiversInput } from "@/components/evenements/cout-divers-input";
import { PrixEmplacementInput } from "@/components/evenements/prix-emplacement-input";
import { EmailContactInput } from "@/components/evenements/email-contact-input";
import { TelephoneInput } from "@/components/evenements/telephone-input";
import { NotesEditor } from "@/components/evenements/notes-editor";
import { BackButton } from "@/components/evenements/back-button";
import { getEvenement } from "@/lib/actions/evenements";
import {
  typeEvenementOptions,
  statutPipelineOptions,
} from "@/lib/validations/evenement";
import ResultatForm from "@/components/rapports/resultat-form";
import { SiteOfficielEditor } from "@/components/evenements/site-officiel-editor";

interface PageProps {
  params: { id: string };
}

export default async function EvenementDetailPage({ params }: PageProps) {
  const id = parseInt(params.id);
  if (isNaN(id)) notFound();

  let evt;
  try {
    evt = await getEvenement(id);
  } catch (error) {
    console.error("[evenement-detail] Erreur chargement :", error);
  }
  if (!evt) notFound();

  const typeLabel =
    typeEvenementOptions.find((o) => o.value === evt.type)?.label ?? evt.type;
  const statutInfo =
    statutPipelineOptions.find((o) => o.value === evt.statutPipeline) ?? {
      label: evt.statutPipeline,
      color: "bg-zinc-700",
    };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <BackButton />
          <h1 className="text-2xl font-semibold tracking-tight">{evt.nom}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="outline" className="text-xs text-zinc-400">
              {typeLabel}
            </Badge>
            <Badge
              className={`${statutInfo.color} text-xs text-zinc-200 border-0`}
            >
              {statutInfo.label}
            </Badge>
            {evt.scorePertinence && (
              <span
                className={`text-xs font-mono ${
                  evt.scorePertinence >= 7
                    ? "text-emerald-400"
                    : evt.scorePertinence >= 4
                      ? "text-amber-400"
                      : "text-zinc-500"
                }`}
              >
                Score : {evt.scorePertinence}/10
              </span>
            )}
          </div>
          {/* Actions rapides */}
          <div className="flex gap-2 mt-2">
            <Link
              href={`/prospection?event=${evt.id}`}
              className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500 flex items-center gap-1"
            >
              <Mail className="h-3 w-3" />
              Prospecter
            </Link>
            <Link
              href="/pipeline"
              className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 flex items-center gap-1"
            >
              Pipeline
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Infos principales */}
        <Card className="border-zinc-800 bg-zinc-900 p-4 space-y-3">
          <h2 className="text-sm font-medium text-zinc-300">Informations</h2>

          {evt.description && (
            <p className="text-sm text-zinc-400">{evt.description}</p>
          )}

          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-zinc-400">
              <MapPin className="h-4 w-4 text-zinc-500" />
              {evt.ville} ({evt.departement})
              {evt.region && ` — ${evt.region}`}
            </div>
            {evt.adresseComplete && (
              <p className="ml-6 text-xs text-zinc-500">
                {evt.adresseComplete}
              </p>
            )}

            <div className="flex items-center gap-2 text-zinc-400">
              <Calendar className="h-4 w-4 text-zinc-500" />
              {format(new Date(evt.dateDebut), "dd MMMM yyyy", { locale: fr })}
              {evt.dateDebut.getTime() !== evt.dateFin.getTime() &&
                ` → ${format(new Date(evt.dateFin), "dd MMMM yyyy", { locale: fr })}`}
            </div>

            <SiteOfficielEditor
              evenementId={evt.id}
              siteOfficiel={evt.siteOfficiel ?? null}
              siteWeb={evt.siteWeb}
            />

            <div className="flex items-center gap-2 text-zinc-400">
              <Mail className="h-4 w-4 text-zinc-500 shrink-0" />
              <EmailContactInput evenementId={evt.id} initialValue={evt.emailContact ?? null} />
            </div>

            <div className="flex items-center gap-2 text-zinc-400">
              <Phone className="h-4 w-4 text-zinc-500 shrink-0" />
              <TelephoneInput evenementId={evt.id} initialValue={evt.telephone ?? null} />
            </div>
          </div>
        </Card>

        {/* Tarifs & capacité */}
        <Card className="border-zinc-800 bg-zinc-900 p-4 space-y-3">
          <h2 className="text-sm font-medium text-zinc-300">
            Tarifs & capacité
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-zinc-400">
              <Euro className="h-4 w-4 text-zinc-500" />
              <span>Emplacement :</span>
              <PrixEmplacementInput
                evenementId={evt.id}
                initialValue={evt.prixEmplacement != null ? Number(evt.prixEmplacement) : null}
              />
            </div>
            {evt.tailleEmplacement && (
              <p className="ml-6 text-xs text-zinc-500">
                Taille : {evt.tailleEmplacement}
              </p>
            )}
            {evt.nombreVisiteursEstime && (
              <div className="flex items-center gap-2 text-zinc-400">
                <Users className="h-4 w-4 text-zinc-500" />
                ~{evt.nombreVisiteursEstime.toLocaleString("fr-FR")} visiteurs
                estimés
              </div>
            )}
          </div>

          {/* Coûts calculés */}
          {evt.cout ? (
            <div className="mt-4 rounded-md border border-zinc-700 bg-zinc-800 p-3">
              <h3 className="mb-2 text-xs font-medium text-zinc-300">
                Analyse de coûts
              </h3>
              <div className="grid grid-cols-2 gap-1 text-xs text-zinc-400">
                <span>Distance :</span>
                <span className="font-mono">
                  {evt.cout.distanceKm ? `${evt.cout.distanceKm} km` : "—"}
                </span>
                <span>Carburant :</span>
                <span className="font-mono">
                  {Number(evt.cout.coutCarburant)}€
                </span>
                <span>Péage :</span>
                <span className="font-mono">
                  {Number(evt.cout.coutPeage)}€
                </span>
                <span>Emplacement :</span>
                <span className="font-mono">
                  {Number(evt.cout.coutEmplacement)}€
                </span>
                <span>Hébergement :</span>
                <span className="font-mono">
                  {Number(evt.cout.coutHebergement)}€
                </span>
                <span>Nourriture :</span>
                <span className="font-mono">
                  {Number(evt.cout.coutNourriture)}€
                </span>
                <CoutDiversInput
                  evenementId={evt.id}
                  initialValue={Number(evt.cout.coutDivers)}
                />
                <span className="font-semibold text-zinc-200">
                  Coût total :
                </span>
                <span className="font-mono font-semibold text-zinc-200">
                  {Number(evt.cout.coutTotal)}€
                </span>
                {evt.cout.seuilRentabilite && (
                  <>
                    <span className="text-amber-400">Seuil rentabilité :</span>
                    <span className="font-mono text-amber-400">
                      {Number(evt.cout.seuilRentabilite)}€
                    </span>
                  </>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-2 text-xs text-zinc-600">
              Coûts non calculés — le Géocodage et Coûts Agent s&apos;en chargeront
            </p>
          )}
        </Card>
      </div>

      {/* Tags IA */}
      {evt.tagsIa && (
        <Card className="border-zinc-800 bg-zinc-900 p-4">
          <h2 className="mb-2 text-sm font-medium text-zinc-300">
            Tags IA
          </h2>
          <div className="flex flex-wrap gap-2">
            {(evt.tagsIa as string[]).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
          {evt.resumeIa && (
            <p className="mt-2 text-sm text-zinc-400">{evt.resumeIa}</p>
          )}
        </Card>
      )}

      {/* Suivi contact & notes */}
      <Card className="border-zinc-800 bg-zinc-900 p-4">
        <h2 className="mb-3 text-sm font-medium text-zinc-300">Suivi contact & notes</h2>
        <NotesEditor evenementId={evt.id} initialValue={evt.notes ?? null} />
      </Card>

      {/* Résultat post-événement */}
      {(evt.statutPipeline === "CONFIRME" ||
        evt.statutPipeline === "TERMINE") && (
        <Card className="border-zinc-800 bg-zinc-900 p-4">
          <h2 className="mb-3 text-sm font-medium text-zinc-300">
            Résultat post-événement
          </h2>
          <ResultatForm
            evenementId={evt.id}
            evenementNom={evt.nom}
            existing={
              evt.resultat
                ? {
                    chiffreAffaires: Number(evt.resultat.chiffreAffaires),
                    nombreClients: evt.resultat.nombreClients,
                    meteo: evt.resultat.meteo,
                    noteSatisfaction: evt.resultat.noteSatisfaction,
                    commentaire: evt.resultat.commentaire,
                    recommande: evt.resultat.recommande,
                  }
                : undefined
            }
          />
        </Card>
      )}

      {/* Prospections */}
      <Card className="border-zinc-800 bg-zinc-900 p-4">
        <h2 className="mb-2 text-sm font-medium text-zinc-300">
          Prospections ({evt.prospections.length})
        </h2>
        {evt.prospections.length === 0 ? (
          <p className="text-xs text-zinc-500">
            Aucune prospection pour cet événement
          </p>
        ) : (
          <div className="space-y-2">
            {evt.prospections.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded border border-zinc-700 bg-zinc-800 p-2"
              >
                <div>
                  <p className="text-sm text-zinc-300">{p.sujet}</p>
                  <p className="text-xs text-zinc-500">→ {p.destinataire}</p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {p.statut}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
