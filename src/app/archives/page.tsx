import { Button } from "@/components/ui/button";
import { Archive } from "lucide-react";
import Link from "next/link";
import { listArchives } from "@/lib/actions/evenements";
import { ArchivesTable } from "@/components/archives/archives-table";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: {
    search?: string;
    page?: string;
  };
}

export default async function ArchivesPage({ searchParams }: PageProps) {
  let evenements: Awaited<ReturnType<typeof listArchives>>["evenements"] = [];
  let total = 0;
  let page = 1;
  let totalPages = 1;

  try {
    const result = await listArchives({
      search: searchParams.search,
      page: searchParams.page ? parseInt(searchParams.page) : 1,
    });
    evenements = result.evenements;
    total = result.total;
    page = result.page;
    totalPages = result.totalPages;
  } catch (error) {
    console.error("[archives] Erreur chargement :", error);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Archives</h1>
        <p className="text-sm text-zinc-400">
          {total} événement{total !== 1 ? "s" : ""} passé
          {total !== 1 ? "s" : ""} — consultez les résultats ou renseignez vos
          statistiques
        </p>
      </div>

      {/* Recherche */}
      <form className="flex gap-2" action="/archives" method="GET">
        <input
          name="search"
          type="text"
          placeholder="Rechercher dans les archives..."
          defaultValue={searchParams.search ?? ""}
          className="h-10 w-80 rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-200 placeholder:text-zinc-500"
        />
        <Button type="submit" variant="outline" size="sm" className="h-10">
          Rechercher
        </Button>
      </form>

      {/* Table */}
      {evenements.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-zinc-800">
          <div className="text-center">
            <Archive className="mx-auto h-8 w-8 text-zinc-600" />
            <p className="mt-2 text-sm text-zinc-500">Aucune archive</p>
          </div>
        </div>
      ) : (
        <ArchivesTable evenements={evenements.map((e) => ({
          ...e,
          resultat: e.resultat ? {
            chiffreAffaires: Number(e.resultat.chiffreAffaires),
            noteSatisfaction: e.resultat.noteSatisfaction,
          } : null,
        }))} />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-zinc-400">
          <span>
            Page {page} sur {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/archives?page=${page - 1}${searchParams.search ? `&search=${searchParams.search}` : ""}`}
              >
                <Button variant="outline" size="sm">
                  Précédent
                </Button>
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/archives?page=${page + 1}${searchParams.search ? `&search=${searchParams.search}` : ""}`}
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
