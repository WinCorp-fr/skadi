"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { StatutProspection } from "@/generated/prisma/client";

// ─── Templates email ─────────────────────────────────

export async function listTemplates() {
  return prisma.emailTemplate.findMany({
    orderBy: { nom: "asc" },
    include: { _count: { select: { prospections: true } } },
  });
}

export async function getTemplate(id: number) {
  return prisma.emailTemplate.findUnique({ where: { id } });
}

export async function createTemplate(data: {
  nom: string;
  sujetTemplate: string;
  corpsTemplate: string;
  variables: string[];
}) {
  const template = await prisma.emailTemplate.create({
    data: {
      nom: data.nom,
      sujetTemplate: data.sujetTemplate,
      corpsTemplate: data.corpsTemplate,
      variables: data.variables,
    },
  });

  revalidatePath("/prospection");
  return template;
}

export async function updateTemplate(
  id: number,
  data: {
    nom?: string;
    sujetTemplate?: string;
    corpsTemplate?: string;
    variables?: string[];
  }
) {
  const template = await prisma.emailTemplate.update({
    where: { id },
    data,
  });

  revalidatePath("/prospection");
  return template;
}

export async function deleteTemplate(id: number) {
  await prisma.emailTemplate.delete({ where: { id } });
  revalidatePath("/prospection");
}

// ─── Prospections (emails) ───────────────────────────

export async function listProspections(filters: {
  statut?: StatutProspection;
  evenementId?: number;
} = {}) {
  return prisma.prospection.findMany({
    where: {
      ...(filters.statut && { statut: filters.statut }),
      ...(filters.evenementId && { evenementId: filters.evenementId }),
    },
    include: {
      evenement: { select: { id: true, nom: true, ville: true, emailContact: true } },
      template: { select: { id: true, nom: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createProspection(data: {
  evenementId: number;
  templateId?: number;
  destinataire: string;
  sujet: string;
  corps: string;
  genereParIa?: boolean;
}) {
  const prospection = await prisma.prospection.create({
    data: {
      evenementId: data.evenementId,
      templateId: data.templateId || null,
      destinataire: data.destinataire,
      sujet: data.sujet,
      corps: data.corps,
      statut: "BROUILLON",
      genereParIa: data.genereParIa || false,
    },
  });

  revalidatePath("/prospection");
  revalidatePath(`/evenements/${data.evenementId}`);
  return prospection;
}

export async function updateProspection(
  id: number,
  data: {
    sujet?: string;
    corps?: string;
    statut?: StatutProspection;
    reponseNotes?: string;
  }
) {
  const prospection = await prisma.prospection.update({
    where: { id },
    data,
  });

  revalidatePath("/prospection");
  return prospection;
}

export async function markProspectionReady(id: number) {
  const prospection = await prisma.prospection.update({
    where: { id },
    data: { statut: "PRET" },
  });

  revalidatePath("/prospection");
  return prospection;
}

export async function updateStatutProspection(id: number, statut: StatutProspection) {
  const prospection = await prisma.prospection.update({
    where: { id },
    data: { statut },
  });

  revalidatePath("/prospection");
  return prospection;
}

export async function deleteProspection(id: number) {
  await prisma.prospection.delete({ where: { id } });
  revalidatePath("/prospection");
}

export async function sendProspection(id: number): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(
      `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3099"}/api/prospection/send`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectionId: id }),
      }
    );
    const data = await res.json();
    if (data.error) {
      return { success: false, message: data.error };
    }
    revalidatePath("/prospection");
    return { success: true, message: `Email envoyé à ${data.output?.destinataire || "destinataire"}` };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Erreur inconnue" };
  }
}

// ─── Rendu d'un template avec variables ──────────────

export async function renderTemplate(
  templateId: number,
  evenementId: number
): Promise<{ sujet: string; corps: string }> {
  const [template, evenement] = await Promise.all([
    prisma.emailTemplate.findUnique({ where: { id: templateId } }),
    prisma.evenement.findUnique({
      where: { id: evenementId },
      include: { cout: true },
    }),
  ]);

  if (!template || !evenement) {
    throw new Error("Template ou événement introuvable");
  }

  // Variables disponibles pour le template
  const vars: Record<string, string> = {
    "{{nom_evenement}}": evenement.nom,
    "{{ville}}": evenement.ville,
    "{{departement}}": evenement.departement,
    "{{date_debut}}": evenement.dateDebut.toLocaleDateString("fr-FR"),
    "{{date_fin}}": evenement.dateFin.toLocaleDateString("fr-FR"),
    "{{type}}": evenement.type,
    "{{site_web}}": evenement.siteWeb || "",
    "{{email_contact}}": evenement.emailContact || "",
    "{{score}}": evenement.scorePertinence?.toString() || "N/A",
    "{{distance_km}}": evenement.cout?.distanceKm?.toString() || "N/A",
  };

  let sujet = template.sujetTemplate;
  let corps = template.corpsTemplate;

  for (const [key, value] of Object.entries(vars)) {
    sujet = sujet.replaceAll(key, value);
    corps = corps.replaceAll(key, value);
  }

  return { sujet, corps };
}
