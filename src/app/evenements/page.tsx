import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { listEvenements } from "@/lib/actions/evenements";
import { EventTable } from "@/components/evenements/event-table";
import { EventFilters } from "@/components/evenements/event-filters";
import { AnalyzeButton } from "@/components/evenements/analyze-button";
import type { TypeEvenement, StatutPipeline } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: {
    search?: string;
    type?: string;
    statut?: string;
    score?: string;
    dist?: string;
    vue?: string;
    sort?: string;
    order?: string;
    page?: string;
  };
}

export default async function EvenementsPage({ searchParams }: PageProps) {
  let evenements: Awaited<ReturnType<typeof listEvenements>>["evenements"] = [];
  let total = 0;
  let page = 1;
  let totalPages = 1;

  const vue = searchParams.vue as "recurring" | "annuel" | "unique" | undefined;

  try {
    const result = await listEvenements({
      search: searchParams.search,
      scoreMin: searchParams.score ? parseInt(searchParams.score) : undefined,
      distanceMax: searchParams.dist ? parseInt(searchParams.dist) : undefined,
      recurrenceFilter: vue || undefined,
      type: searchParams.type as TypeEvenement | undefined,
      statutPipeline: searchParams.statut as StatutPipeline | undefined,
      sort: searchParams.sort as "score" | "distance" | "date" | undefined,
      order: searchParams.order as "asc" | "desc" | undefined,
      page: searchParams.page ? parseInt(searchParams.page) : 1,
    });
    // Sérialiser les Decimal Prisma en nombres avant passage au client component
    evenements = result.evenements.map((e) => ({
      ...e,
      prixEmplacement: e.prixEmplacement != null ? Number(e.prixEmplacement) : null,
      cout: e.cout
        ? {
            ...e.cout,
            coutCarburant: Number(e.cout.coutCarburant),
            coutPeage: Number(e.cout.coutPeage),
            coutEmplacement: Number(e.cout.coutEmplacement),
            coutHebergement: Number(e.cout.coutHebergement),
            coutNourriture: Number(e.cout.coutNourriture),
            coutDivers: Number(e.cout.coutDivers),
            coutTotal: Number(e.cout.coutTotal),
            seuilRentabilite: e.cout.seuilRentabilite != null ? Number(e.cout.seuilRentabilite) : null,
          }
        : null,
    })) as typeof evenements;
    total = result.total;
    page = result.page;
    totalPages = result.totalPages;
  } catch (error) {
    console.error("[evenements] Erreur chargement :", error);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Événements</h1>
          <p className="text-sm text-zinc-400">
            {total} événement{total !== 1 ? "s" : ""} référencé
            {total !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <AnalyzeButton />
          <Link href="/evenements/nouveau">
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Ajouter manuellement
            </Button>
          </Link>
        </div>
      </div>

      {/* Onglets Tous / Récurrents / Annuels / Ponctuels */}
      <div className="flex gap-1 border-b border-zinc-800">
        {[
          { key: "", label: "Tous" },
          { key: "recurring", label: "Récurrents" },
          { key: "annuel", label: "Annuels" },
          { key: "unique", label: "Ponctuels" },
        ].map((tab) => {
          const isActive = (vue || "") === tab.key;
          const href = tab.key
            ? `/evenements?vue=${tab.key}`
            : "/evenements";
          return (
            <Link
              key={tab.key}
              href={href}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "border-b-2 border-amber-500 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
        <span className="ml-auto self-center text-xs text-zinc-600">
          {vue === "recurring"
            ? "Marchés hebdomadaires et mensuels"
            : vue === "annuel"
              ? "Foires et marchés annuels"
              : vue === "unique"
                ? "Salons et événements ponctuels"
                : ""}
        </span>
      </div>

      <Suspense fallback={<div className="text-sm text-zinc-500">Chargement des filtres...</div>}>
        <EventFilters />
      </Suspense>

      <EventTable
        evenements={evenements}
        sort={searchParams.sort}
        order={searchParams.order as "asc" | "desc" | undefined}
        searchParams={searchParams}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-zinc-400">
          <span>
            Page {page} sur {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/evenements?page=${page - 1}${searchParams.search ? `&search=${searchParams.search}` : ""}${searchParams.type ? `&type=${searchParams.type}` : ""}${searchParams.statut ? `&statut=${searchParams.statut}` : ""}${searchParams.score ? `&score=${searchParams.score}` : ""}${searchParams.dist ? `&dist=${searchParams.dist}` : ""}${searchParams.vue ? `&vue=${searchParams.vue}` : ""}`}
              >
                <Button variant="outline" size="sm">
                  Précédent
                </Button>
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/evenements?page=${page + 1}${searchParams.search ? `&search=${searchParams.search}` : ""}${searchParams.type ? `&type=${searchParams.type}` : ""}${searchParams.statut ? `&statut=${searchParams.statut}` : ""}${searchParams.score ? `&score=${searchParams.score}` : ""}${searchParams.dist ? `&dist=${searchParams.dist}` : ""}${searchParams.vue ? `&vue=${searchParams.vue}` : ""}`}
              >
                <Button variant="outline" size="sm">
                  Suivant
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
