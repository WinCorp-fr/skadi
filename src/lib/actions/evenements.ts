"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  evenementSchema,
  type EvenementFormData,
} from "@/lib/validations/evenement";
import type { StatutPipeline, TypeEvenement } from "@/generated/prisma/client";

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
  sort?: SortField;
  order?: SortOrder;
  page?: number;
  perPage?: number;
}

export async function listEvenements(filters: ListFilters = {}) {
  const { type, statutPipeline, search, scoreMin, distanceMax, recurrenceFilter, sort, order = "desc", page = 1, perPage = 20 } = filters;

  const where = {
    // Exclure les archivés par défaut (sauf si filtre explicite)
    ...(statutPipeline
      ? { statutPipeline }
      : { statutPipeline: { not: "ARCHIVE" as const } }),
    ...(type && { type }),
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

export async function deleteEvenement(id: number) {
  await prisma.evenement.delete({ where: { id } });

  revalidatePath("/evenements");
  revalidatePath("/pipeline");
  revalidatePath("/");
}

export async function deleteEvenements(ids: number[]) {
  if (ids.length === 0) return;
  await prisma.evenement.deleteMany({ where: { id: { in: ids } } });

  revalidatePath("/archives");
  revalidatePath("/evenements");
  revalidatePath("/");
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
