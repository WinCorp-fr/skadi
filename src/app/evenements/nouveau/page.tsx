import { EventForm } from "@/components/evenements/event-form";

export default function NouvelEvenementPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Nouvel événement
        </h1>
        <p className="text-sm text-zinc-400">
          Ajouter un événement manuellement
        </p>
      </div>

      <EventForm />
    </div>
  );
}
