"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  evenementSchema,
  type EvenementFormData,
} from "@/lib/validations/evenement";
import type { StatutPipeline, TypeEvenement } from "@/generated/prisma/client";

// ─── Fiches « à revoir » (signal posé par la collecte) ──

/** Résultat d'une action que l'interface doit pouvoir refuser avec un message lisible. */
export type ActionResult = { ok: true } | { ok: false; error: string };

// Signal « à revoir » : la collecte a trouvé une fiche ressemblante de date proche.
// Le score porte le signal (il survit si la fiche ressemblante est supprimée).
const A_REVOIR = { doublonScore: { not: null } };

const SUPPRESSION_REFUSEE =
  "fiche signalée comme doublon possible : la supprimer la ferait revenir à la prochaine " +
  "collecte. Ouvrez-la et choisissez « C'est un doublon » (elle sera archivée) ou " +
  "« Ce n'est pas un doublon ».";

function revalidateEvenement(id: number) {
  revalidatePath("/evenements");
  revalidatePath(`/evenements/${id}`);
  revalidatePath("/archives");
  revalidatePath("/pipeline");
  revalidatePath("/");
}

/** Nombre de fiches à revoir encore actives (hors archives). */
export async function countARevoir() {
  return prisma.evenement.count({
    where: { ...A_REVOIR, statutPipeline: { not: "ARCHIVE" as const } },
  });
}

/** « Ce n'est pas un doublon » : efface le signal, la fiche reste telle quelle. */
export async function ecarterSignalDoublon(id: number) {
  await prisma.evenement.update({
    where: { id },
    data: { doublonPossibleDeId: null, doublonScore: null },
  });
  revalidateEvenement(id);
}

/**
 * « C'est un doublon » : archive la fiche au lieu de la supprimer. Son empreinte reste en
 * base, la collecte suivante ne la recrée donc pas. Le signal est gardé pour la trace.
 */
export async function confirmerDoublon(id: number) {
  await prisma.evenement.update({
    where: { id },
    data: { statutPipeline: "ARCHIVE" },
  });
  revalidateEvenement(id);
}

// ─── Lister les événements avec filtres ───────────────

type SortField = "score" | "distance" | "date";
type SortOrder = "asc" | "desc";

interface ListFilters {
  type?: TypeEvenement;
  statutPipeline?: StatutPipeline;
  search?: string;
  scoreMin?: number;
  distanceMax?: number; // km max depuis l'adresse de base
  recurrenceFilter?: "recurring" | "annuel" | "unique"; // récurrents / annuels / ponctuels
  aRevoir?: boolean; // fiches signalées par la collecte comme doublon possible
  sort?: SortField;
  order?: SortOrder;
  page?: number;
  perPage?: number;
}

export async function listEvenements(filters: ListFilters = {}) {
  const { type, statutPipeline, search, scoreMin, distanceMax, recurrenceFilter, aRevoir, sort, order = "desc", page = 1, perPage = 20 } = filters;

  const where = {
    // Exclure les archivés par défaut (sauf si filtre explicite)
    ...(statutPipeline
      ? { statutPipeline }
      : { statutPipeline: { not: "ARCHIVE" as const } }),
    ...(type && { type }),
    ...(aRevoir && A_REVOIR),
    ...(scoreMin && { scorePertinence: { gte: scoreMin } }),
    ...(recurrenceFilter === "recurring" && {
      recurrence: { in: ["HEBDOMADAIRE" as const, "MENSUEL" as const] },
    }),
    ...(recurrenceFilter === "annuel" && {
      recurrence: { equals: "ANNUEL" as const },
    }),
    ...(recurrenceFilter === "unique" && {
      recurrence: { equals: "UNIQUE" as const },
    }),
    ...(distanceMax && {
      cout: { distanceKm: { lte: distanceMax } },
    }),
    ...(search && {
      OR: [
        { nom: { contains: search, mode: "insensitive" as const } },
        { ville: { contains: search, mode: "insensitive" as const } },
        { departement: { contains: search, mode: "insensitive" as const } },
      ],
    }),
  };

  // Construire l'orderBy selon le tri demandé
  const orderBy: object[] =
    sort === "distance"
      ? [{ cout: { distanceKm: order } }, { scorePertinence: "desc" }]
      : sort === "date"
        ? [{ dateDebut: order }, { scorePertinence: "desc" }]
        : [{ scorePertinence: order }, { dateDebut: "asc" }]; // défaut = score

  const [evenements, total] = await Promise.all([
    prisma.evenement.findMany({
      where,
      include: { cout: true },
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.evenement.count({ where }),
  ]);

  return { evenements, total, page, perPage, totalPages: Math.ceil(total / perPage) };
}

// ─── Lister les événements archivés ──────────────────

export async function listArchives(filters: { search?: string; page?: number; perPage?: number } = {}) {
  const { search, page = 1, perPage = 20 } = filters;

  const where = {
    statutPipeline: "ARCHIVE" as const,
    ...(search && {
      OR: [
        { nom: { contains: search, mode: "insensitive" as const } },
        { ville: { contains: search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [evenements, total] = await Promise.all([
    prisma.evenement.findMany({
      where,
      include: { cout: true, resultat: true },
      orderBy: { dateDebut: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.evenement.count({ where }),
  ]);

  return { evenements, total, page, perPage, totalPages: Math.ceil(total / perPage) };
}

// ─── Récupérer un événement par ID ────────────────────

export async function getEvenement(id: number) {
  return prisma.evenement.findUnique({
    where: { id },
    include: {
      cout: true,
      resultat: true,
      prospections: { include: { template: true }, orderBy: { createdAt: "desc" } },
      doublonPossibleDe: {
        select: { id: true, nom: true, ville: true, dateDebut: true, statutPipeline: true },
      },
    },
  });
}

// ─── Créer un événement ───────────────────────────────

export async function createEvenement(data: EvenementFormData) {
  const validated = evenementSchema.parse(data);

  const evenement = await prisma.evenement.create({
    data: {
      nom: validated.nom,
      type: validated.type,
      description: validated.description || null,
      ville: validated.ville,
      departement: validated.departement,
      region: validated.region || null,
      adresseComplete: validated.adresseComplete || null,
      dateDebut: new Date(validated.dateDebut),
      dateFin: new Date(validated.dateFin),
      recurrence: validated.recurrence,
      siteWeb: validated.siteWeb || null,
      emailContact: validated.emailContact || null,
      telephone: validated.telephone || null,
      prixEmplacement: validated.prixEmplacement ?? null,
      tailleEmplacement: validated.tailleEmplacement || null,
      nombreVisiteursEstime: validated.nombreVisiteursEstime ?? null,
      notes: validated.notes || null,
      statutPipeline: "DECOUVERT",
    },
  });

  revalidatePath("/evenements");
  revalidatePath("/pipeline");
  revalidatePath("/");

  return evenement;
}

// ─── Mettre à jour un événement ───────────────────────

export async function updateEvenement(
  id: number,
  data: Omit<Partial<EvenementFormData>, "emailContact" | "telephone" | "notes" | "prixEmplacement"> & {
    siteOfficiel?: string | null;
    emailContact?: string | null;
    telephone?: string | null;
    notes?: string | null;
    prixEmplacement?: number | null;
  }
) {
  const { siteOfficiel, ...rest } = data;
  const evenement = await prisma.evenement.update({
    where: { id },
    data: {
      ...rest,
      ...(rest.dateDebut && { dateDebut: new Date(rest.dateDebut) }),
      ...(rest.dateFin && { dateFin: new Date(rest.dateFin) }),
      ...(siteOfficiel !== undefined && { siteOfficiel }),
    },
  });

  revalidatePath("/evenements");
  revalidatePath(`/evenements/${id}`);
  revalidatePath("/pipeline");

  return evenement;
}

// ─── Changer le statut pipeline ───────────────────────

export async function updateStatutPipeline(
  id: number,
  statut: StatutPipeline
) {
  const evenement = await prisma.evenement.update({
    where: { id },
    data: { statutPipeline: statut },
  });

  revalidatePath("/evenements");
  revalidatePath(`/evenements/${id}`);
  revalidatePath("/pipeline");
  revalidatePath("/");

  return evenement;
}

// ─── Supprimer un événement ───────────────────────────

export async function archiveEvenement(id: number) {
  await prisma.evenement.update({
    where: { id },
    data: { statutPipeline: "ARCHIVE" },
  });

  revalidatePath("/evenements");
  revalidatePath("/pipeline");
  revalidatePath("/archives");
  revalidatePath("/");
}

export async function deleteEvenement(id: number): Promise<ActionResult> {
  const fiche = await prisma.evenement.findUnique({
    where: { id },
    select: { doublonScore: true },
  });
  if (fiche?.doublonScore != null) {
    return { ok: false, error: `Suppression refusée, ${SUPPRESSION_REFUSEE}` };
  }

  await prisma.evenement.delete({ where: { id } });

  revalidatePath("/evenements");
  revalidatePath("/pipeline");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteEvenements(ids: number[]): Promise<ActionResult> {
  if (ids.length === 0) return { ok: true };
  const signalees = await prisma.evenement.count({
    where: { id: { in: ids }, ...A_REVOIR },
  });
  if (signalees > 0) {
    return {
      ok: false,
      error:
        `Suppression refusée, rien n'a été supprimé : ${signalees} fiche(s) de la sélection ` +
        "sont signalées comme doublon possible ou confirmé. Les supprimer les ferait revenir " +
        "à la prochaine collecte : retirez-les de la sélection.",
    };
  }

  await prisma.evenement.deleteMany({ where: { id: { in: ids } } });

  revalidatePath("/archives");
  revalidatePath("/evenements");
  revalidatePath("/");
  return { ok: true };
}

// ─── Statistiques pour le dashboard ───────────────────

export async function getStats() {
  const [total, pipeline, prospections, confirmes] = await Promise.all([
    prisma.evenement.count(),
    prisma.evenement.count({
      where: {
        statutPipeline: { in: ["INTERESSE", "PROSPECTION", "RESERVE"] },
      },
    }),
    prisma.prospection.count({ where: { statut: "ENVOYE" } }),
    prisma.evenement.count({ where: { statutPipeline: "CONFIRME" } }),
  ]);

  return { total, pipeline, prospections, confirmes };
}

// ─── Mise à jour coût divers ───────────────────────────

export async function updateCoutDivers(evenementId: number, montant: number) {
  const cout = await prisma.coutEvenement.findUnique({
    where: { evenementId },
  });

  if (!cout) {
    throw new Error("Coûts non calculés pour cet événement");
  }

  // Recalculer le total avec le nouveau montant divers
  const oldDivers = Number(cout.coutDivers);
  const newTotal = Number(cout.coutTotal) - oldDivers + montant;

  await prisma.coutEvenement.update({
    where: { evenementId },
    data: {
      coutDivers: Math.round(montant * 100) / 100,
      coutTotal: Math.round(newTotal * 100) / 100,
    },
  });

  revalidatePath(`/evenements/${evenementId}`);
}
