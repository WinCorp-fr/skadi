"use client";

import { useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  typeEvenementOptions,
  statutPipelineFilterOptions,
} from "@/lib/validations/evenement";
import { Search } from "lucide-react";

export function EventFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page"); // reset pagination on filter change
    router.push(`/evenements?${params.toString()}`);
  }

  const debouncedSearch = useCallback(
    (value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => updateFilter("search", value), 300);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams]
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
        <Input
          placeholder="Rechercher..."
          defaultValue={searchParams.get("search") ?? ""}
          onChange={(e) => debouncedSearch(e.target.value)}
          className="w-64 border-zinc-700 bg-zinc-800 pl-9"
        />
      </div>

      <select
        defaultValue={searchParams.get("type") ?? ""}
        onChange={(e) => updateFilter("type", e.target.value)}
        className="h-10 rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm"
      >
        <option value="">Tous les types</option>
        {typeEvenementOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <select
        defaultValue={searchParams.get("statut") ?? ""}
        onChange={(e) => updateFilter("statut", e.target.value)}
        className="h-10 rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm"
      >
        <option value="">Tous les statuts</option>
        {statutPipelineFilterOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <select
        defaultValue={searchParams.get("score") ?? ""}
        onChange={(e) => updateFilter("score", e.target.value)}
        className="h-10 rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm"
      >
        <option value="">Tous les scores</option>
        <option value="8">★ ≥ 8/10 (excellent)</option>
        <option value="6">★ ≥ 6/10 (pertinent)</option>
        <option value="4">★ ≥ 4/10 (moyen)</option>
        <option value="1">★ ≥ 1/10 (analysé)</option>
      </select>

      <select
        defaultValue={searchParams.get("dist") ?? ""}
        onChange={(e) => updateFilter("dist", e.target.value)}
        className="h-10 rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm"
      >
        <option value="">Toutes distances</option>
        <option value="50">≤ 50 km (1h AR)</option>
        <option value="100">≤ 100 km (2h AR)</option>
        <option value="150">≤ 150 km (3h AR)</option>
        <option value="250">≤ 250 km (5h AR)</option>
      </select>
    </div>
  );
}
