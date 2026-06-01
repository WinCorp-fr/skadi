import { addWeeks, addMonths, startOfToday, isAfter, isBefore, isSameDay } from "date-fns";

type Recurrence = "HEBDOMADAIRE" | "MENSUEL" | "ANNUEL" | "UNIQUE";

/**
 * Calcule la prochaine occurrence d'un événement récurrent.
 * Pour UNIQUE/ANNUEL : retourne dateDebut si dans le futur, sinon null.
 * Pour HEBDOMADAIRE : prochaine occurrence hebdomadaire >= today.
 * Pour MENSUEL : prochaine occurrence mensuelle >= today.
 */
export function nextOccurrence(
  recurrence: Recurrence,
  dateDebut: Date,
  dateFin: Date
): Date | null {
  const today = startOfToday();

  // Si la fin est passée, l'événement est terminé
  if (isBefore(dateFin, today) && !isSameDay(dateFin, today)) {
    return null;
  }

  if (recurrence === "UNIQUE" || recurrence === "ANNUEL") {
    // Afficher si dateDebut est encore à venir ou en cours
    if (isAfter(dateDebut, today) || isSameDay(dateDebut, today)) {
      return dateDebut;
    }
    // En cours (dateDebut passée mais dateFin future)
    if (isAfter(dateFin, today)) {
      return dateDebut;
    }
    return null;
  }

  if (recurrence === "HEBDOMADAIRE") {
    if (isAfter(dateDebut, today) || isSameDay(dateDebut, today)) {
      return dateDebut;
    }
    // Calculer la prochaine occurrence >= today
    const daysSince = Math.ceil((today.getTime() - dateDebut.getTime()) / (7 * 24 * 3600 * 1000));
    const next = addWeeks(dateDebut, daysSince);
    if (isBefore(next, dateFin) || isSameDay(next, dateFin)) {
      return next;
    }
    return null;
  }

  if (recurrence === "MENSUEL") {
    if (isAfter(dateDebut, today) || isSameDay(dateDebut, today)) {
      return dateDebut;
    }
    // Calculer la prochaine occurrence mensuelle >= today
    const monthsSince = Math.ceil(
      (today.getFullYear() - dateDebut.getFullYear()) * 12 +
      (today.getMonth() - dateDebut.getMonth())
    );
    const next = addMonths(dateDebut, monthsSince);
    if (isBefore(next, dateFin) || isSameDay(next, dateFin)) {
      return next;
    }
    return null;
  }

  return null;
}

/**
 * Génère toutes les occurrences d'un événement récurrent dans un intervalle.
 * Utilisé pour le calendrier grille.
 */
export function occurrencesInRange(
  recurrence: Recurrence,
  dateDebut: Date,
  dateFin: Date,
  rangeStart: Date,
  rangeEnd: Date
): Date[] {
  if (recurrence === "UNIQUE" || recurrence === "ANNUEL") {
    if (
      (isAfter(dateDebut, rangeStart) || isSameDay(dateDebut, rangeStart)) &&
      (isBefore(dateDebut, rangeEnd) || isSameDay(dateDebut, rangeEnd))
    ) {
      return [dateDebut];
    }
    return [];
  }

  const results: Date[] = [];
  let cursor = new Date(dateDebut);

  // Avancer jusqu'au rangeStart
  while (isBefore(cursor, rangeStart)) {
    cursor = recurrence === "HEBDOMADAIRE" ? addWeeks(cursor, 1) : addMonths(cursor, 1);
  }

  // Collecter toutes les occurrences dans le range
  while (
    (isBefore(cursor, rangeEnd) || isSameDay(cursor, rangeEnd)) &&
    (isBefore(cursor, dateFin) || isSameDay(cursor, dateFin))
  ) {
    if (isAfter(cursor, rangeStart) || isSameDay(cursor, rangeStart)) {
      results.push(new Date(cursor));
    }
    cursor = recurrence === "HEBDOMADAIRE" ? addWeeks(cursor, 1) : addMonths(cursor, 1);
    if (results.length > 60) break; // garde-fou
  }

  return results;
}
