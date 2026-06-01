"use client";

import Link from "next/link";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  format,
} from "date-fns";
import { fr } from "date-fns/locale";

interface CalEvent {
  id: number;
  nom: string;
  type: string;
  dateDebut: Date;
  dateFin: Date;
  statutPipeline: string;
  statutColor: string;
}

interface CalendarGridProps {
  mois: Date; // premier jour du mois à afficher
  events: CalEvent[];
  prevHref: string;
  nextHref: string;
}

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export function CalendarGrid({ mois, events, prevHref, nextHref }: CalendarGridProps) {
  const monthStart = startOfMonth(mois);
  const monthEnd = endOfMonth(mois);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  function eventsForDay(day: Date) {
    return events.filter((e) => {
      const start = new Date(e.dateDebut);
      const end = new Date(e.dateFin);
      // Événement présent si le jour est entre dateDebut et dateFin inclus
      return day >= new Date(start.getFullYear(), start.getMonth(), start.getDate()) &&
             day <= new Date(end.getFullYear(), end.getMonth(), end.getDate());
    });
  }

  return (
    <div className="space-y-4">
      {/* Navigation mois */}
      <div className="flex items-center justify-between">
        <Link
          href={prevHref}
          className="rounded border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
        >
          ←
        </Link>
        <h2 className="text-lg font-medium capitalize text-zinc-200">
          {format(mois, "MMMM yyyy", { locale: fr })}
        </h2>
        <Link
          href={nextHref}
          className="rounded border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
        >
          →
        </Link>
      </div>

      {/* Grille */}
      <div className="rounded-lg border border-zinc-800 overflow-hidden">
        {/* En-têtes jours */}
        <div className="grid grid-cols-7 border-b border-zinc-800">
          {JOURS.map((j) => (
            <div key={j} className="px-2 py-2 text-center text-xs font-medium text-zinc-500">
              {j}
            </div>
          ))}
        </div>

        {/* Cellules */}
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dayEvents = eventsForDay(day);
            const isCurrentMonth = isSameMonth(day, mois);
            const isTodayDay = isToday(day);

            return (
              <div
                key={day.toISOString()}
                className={`min-h-[80px] border-b border-r border-zinc-800/50 p-1.5 last:border-r-0 ${
                  !isCurrentMonth ? "bg-zinc-950/50" : ""
                } ${isTodayDay ? "bg-amber-950/20" : ""}`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                    isTodayDay
                      ? "bg-amber-500 font-semibold text-zinc-900"
                      : isCurrentMonth
                        ? "text-zinc-400"
                        : "text-zinc-700"
                  }`}
                >
                  {format(day, "d")}
                </span>

                <div className="mt-1 space-y-0.5">
                  {dayEvents.slice(0, 3).map((evt) => (
                    <Link
                      key={`${evt.id}-${day.toISOString()}`}
                      href={`/evenements/${evt.id}`}
                      className={`block truncate rounded px-1 py-0.5 text-[10px] leading-tight text-zinc-200 hover:opacity-80 ${evt.statutColor}`}
                      title={evt.nom}
                    >
                      {evt.nom}
                    </Link>
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="block text-[10px] text-zinc-500 pl-1">
                      +{dayEvents.length - 3} autre{dayEvents.length - 3 > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
