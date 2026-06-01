"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// ─── Saisie résultat post-événement ──────────────────

interface ResultatData {
  evenementId: number;
  chiffreAffaires: number;
  nombreClients?: number;
  meteo?: string;
  noteSatisfaction?: number;
  commentaire?: string;
  recommande: boolean;
}

export async function createOrUpdateResultat(data: ResultatData) {
  // Récupérer l'événement avec ses coûts pour calculer bénéfice/marge
  const evenement = await prisma.evenement.findUnique({
    where: { id: data.evenementId },
    include: { cout: true },
  });

  if (!evenement) throw new Error("Événement introuvable");

  const coutTotal = evenement.cout ? Number(evenement.cout.coutTotal) : 0;
  const beneficeNet = data.chiffreAffaires - coutTotal;
  const margePct =
    data.chiffreAffaires > 0
      ? (beneficeNet / data.chiffreAffaires) * 100
      : 0;

  const resultat = await prisma.resultatEvenement.upsert({
    where: { evenementId: data.evenementId },
    create: {
      evenementId: data.evenementId,
      chiffreAffaires: data.chiffreAffaires,
      nombreClients: data.nombreClients ?? null,
      meteo: data.meteo || null,
      noteSatisfaction: data.noteSatisfaction ?? null,
      commentaire: data.commentaire || null,
      beneficeNet: Math.round(beneficeNet * 100) / 100,
      margePct: Math.round(margePct * 100) / 100,
      recommande: data.recommande,
    },
    update: {
      chiffreAffaires: data.chiffreAffaires,
      nombreClients: data.nombreClients ?? null,
      meteo: data.meteo || null,
      noteSatisfaction: data.noteSatisfaction ?? null,
      commentaire: data.commentaire || null,
      beneficeNet: Math.round(beneficeNet * 100) / 100,
      margePct: Math.round(margePct * 100) / 100,
      recommande: data.recommande,
    },
  });

  // Passer l'événement en TERMINE
  if (evenement.statutPipeline !== "TERMINE" && evenement.statutPipeline !== "ARCHIVE") {
    await prisma.evenement.update({
      where: { id: data.evenementId },
      data: { statutPipeline: "TERMINE" },
    });
  }

  revalidatePath(`/evenements/${data.evenementId}`);
  revalidatePath("/rapports");
  revalidatePath("/pipeline");
  return resultat;
}

// ─── Données pour les graphiques ─────────────────────

export async function getReportingData() {
  const resultats = await prisma.resultatEvenement.findMany({
    include: {
      evenement: {
        select: {
          id: true,
          nom: true,
          type: true,
          ville: true,
          region: true,
          departement: true,
          dateDebut: true,
          cout: true,
        },
      },
    },
    orderBy: { evenement: { dateDebut: "asc" } },
  });

  // CA par type d'événement
  const caParType: Record<string, { ca: number; count: number; benefice: number }> = {};
  for (const r of resultats) {
    const type = r.evenement.type;
    if (!caParType[type]) caParType[type] = { ca: 0, count: 0, benefice: 0 };
    caParType[type].ca += Number(r.chiffreAffaires);
    caParType[type].count += 1;
    caParType[type].benefice += Number(r.beneficeNet || 0);
  }

  // CA par mois
  const caParMois: Record<string, { ca: number; count: number; benefice: number }> = {};
  for (const r of resultats) {
    const date = new Date(r.evenement.dateDebut);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    if (!caParMois[key]) caParMois[key] = { ca: 0, count: 0, benefice: 0 };
    caParMois[key].ca += Number(r.chiffreAffaires);
    caParMois[key].count += 1;
    caParMois[key].benefice += Number(r.beneficeNet || 0);
  }

  // CA par région
  const caParRegion: Record<string, { ca: number; count: number }> = {};
  for (const r of resultats) {
    const region = r.evenement.region || "Inconnue";
    if (!caParRegion[region]) caParRegion[region] = { ca: 0, count: 0 };
    caParRegion[region].ca += Number(r.chiffreAffaires);
    caParRegion[region].count += 1;
  }

  // KPIs globaux
  const totalCA = resultats.reduce((sum, r) => sum + Number(r.chiffreAffaires), 0);
  const totalBenefice = resultats.reduce((sum, r) => sum + Number(r.beneficeNet || 0), 0);
  const totalEvents = resultats.length;
  const avgSatisfaction =
    resultats.filter((r) => r.noteSatisfaction).length > 0
      ? resultats.reduce((sum, r) => sum + (r.noteSatisfaction || 0), 0) /
        resultats.filter((r) => r.noteSatisfaction).length
      : 0;
  const recommandes = resultats.filter((r) => r.recommande).length;

  return {
    resultats,
    caParType: Object.entries(caParType).map(([type, data]) => ({
      type,
      ...data,
    })),
    caParMois: Object.entries(caParMois)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mois, data]) => ({ mois, ...data })),
    caParRegion: Object.entries(caParRegion).map(([region, data]) => ({
      region,
      ...data,
    })),
    kpis: {
      totalCA: Math.round(totalCA * 100) / 100,
      totalBenefice: Math.round(totalBenefice * 100) / 100,
      totalEvents,
      avgSatisfaction: Math.round(avgSatisfaction * 10) / 10,
      recommandes,
      margeMoyenne:
        totalCA > 0 ? Math.round((totalBenefice / totalCA) * 10000) / 100 : 0,
    },
  };
}
