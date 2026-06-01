/**
 * Coûts Agent — Logique métier pure (sans BullMQ).
 *
 * Calcul automatique des coûts et seuil de rentabilité.
 * Pour chaque événement avec des coordonnées géocodées :
 * 1. Récupère les paramètres (carburant, consommation, per diem, marge)
 * 2. Applique les formules de coût
 * 3. Calcule le seuil de rentabilité
 *
 * Formules :
 *   Carburant = distance_km × 2 × (conso/100) × prix_litre (aller-retour)
 *   Total = carburant + péage + emplacement + hébergement + nourriture
 *   Seuil = total / (1 - marge_cible/100)
 */

import { prisma } from "@/lib/prisma";

// ─── Fonction principale ──────────────────────────────

export async function runCosts(eventIds: number[]) {
  // Récupérer les paramètres
  const params = await prisma.parametres.findUnique({ where: { id: 1 } });
  if (!params) {
    throw new Error("Paramètres non configurés");
  }

  const prixCarburant = Number(params.prixCarburantLitre);
  const consommation = Number(params.consommationL100km);
  const perDiem = Number(params.perDiemNourriture);
  const margeCible = Number(params.margeCiblePct);
  const tauxPeage = Number(params.tauxPeageParKm);
  const pctAutoroute = Number(params.pourcentageAutoroute);
  const seuilHebergementKm = params.seuilHebergementKm;
  const coutHebergementNuit = Number(params.coutHebergementNuit);

  // Récupérer les événements avec leurs coûts existants
  const events = await prisma.evenement.findMany({
    where: { id: { in: eventIds } },
    include: { cout: true },
  });

  let calculated = 0;
  let totalCost = 0;
  let totalBreakeven = 0;

  for (const event of events) {
    // Il faut un CoutEvenement avec distanceKm (créé par le géocodage)
    if (!event.cout?.distanceKm) {
      console.warn(
        `[costs] Event #${event.id} "${event.nom}" : pas de distance, skip`
      );
      continue;
    }

    const distanceKm = event.cout.distanceKm;

    // Valider la cohérence des dates
    if (event.dateFin.getTime() < event.dateDebut.getTime()) {
      console.error(
        `[costs] Event #${event.id} "${event.nom}" : dateFin < dateDebut, skip`
      );
      continue;
    }

    // Carburant aller-retour
    const coutCarburant =
      distanceKm * 2 * (consommation / 100) * prixCarburant;

    // Péage estimé (aller-retour, % autoroute configurable)
    const coutPeage = distanceKm * 2 * tauxPeage * pctAutoroute;

    // Emplacement (prix de l'événement, ou 0 si inconnu)
    const coutEmplacement = event.prixEmplacement
      ? Number(event.prixEmplacement)
      : 0;

    // Hébergement (si > seuil km ou événement multi-jours)
    const multiJours =
      event.dateFin.getTime() - event.dateDebut.getTime() > 24 * 60 * 60 * 1000;
    const besoinHebergement = distanceKm > seuilHebergementKm || multiJours;
    const nbNuits = multiJours
      ? Math.ceil(
          (event.dateFin.getTime() - event.dateDebut.getTime()) /
            (24 * 60 * 60 * 1000)
        )
      : besoinHebergement
        ? 1
        : 0;
    const coutHebergement = nbNuits * coutHebergementNuit;

    // Nourriture (per diem × nombre de jours)
    const nbJours = Math.max(
      1,
      Math.ceil(
        (event.dateFin.getTime() - event.dateDebut.getTime()) /
          (24 * 60 * 60 * 1000)
      ) + 1
    );
    const coutNourriture = nbJours * perDiem;

    // Coûts divers (saisis manuellement, conservés)
    const coutDivers = event.cout?.coutDivers ? Number(event.cout.coutDivers) : 0;

    // Total
    const coutTotal =
      coutCarburant +
      coutPeage +
      coutEmplacement +
      coutHebergement +
      coutNourriture +
      coutDivers;

    // Seuil de rentabilité
    const seuilRentabilite =
      margeCible >= 100 ? coutTotal * 10 : coutTotal / (1 - margeCible / 100);

    // Arrondir à 2 décimales
    const round2 = (n: number) => Math.round(n * 100) / 100;

    // Mettre à jour en DB
    await prisma.coutEvenement.update({
      where: { evenementId: event.id },
      data: {
        coutCarburant: round2(coutCarburant),
        coutPeage: round2(coutPeage),
        coutEmplacement: round2(coutEmplacement),
        coutHebergement: round2(coutHebergement),
        coutNourriture: round2(coutNourriture),
        coutTotal: round2(coutTotal),
        seuilRentabilite: round2(seuilRentabilite),
        calculePar: "costs.agent v2 (serverless)",
      },
    });

    calculated++;
    totalCost += coutTotal;
    totalBreakeven += seuilRentabilite;
  }

  const avgCost = calculated > 0 ? Math.round((totalCost / calculated) * 100) / 100 : 0;
  const avgBreakeven =
    calculated > 0 ? Math.round((totalBreakeven / calculated) * 100) / 100 : 0;

  return {
    calculated,
    skipped: events.length - calculated,
    avgCost,
    avgBreakeven,
  };
}
