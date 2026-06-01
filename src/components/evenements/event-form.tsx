"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  evenementSchema,
  type EvenementFormData,
  typeEvenementOptions,
  recurrenceOptions,
} from "@/lib/validations/evenement";
import { createEvenement } from "@/lib/actions/evenements";
import { Loader2 } from "lucide-react";

export function EventForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EvenementFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(evenementSchema) as any,
    defaultValues: {
      type: "FOIRE_MEDIEVALE",
      recurrence: "UNIQUE",
    },
  });

  async function onSubmit(data: EvenementFormData) {
    setIsSubmitting(true);
    setError(null);
    try {
      await createEvenement(data);
      router.push("/evenements");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la création");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <div className="rounded-md border border-red-800 bg-red-950 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Informations principales */}
      <Card className="border-zinc-800 bg-zinc-900 p-4 space-y-4">
        <h2 className="text-sm font-medium text-zinc-300">
          Informations principales
        </h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="nom">Nom de l&apos;événement *</Label>
            <Input
              id="nom"
              {...register("nom")}
              placeholder="Foire médiévale de Provins"
              className="border-zinc-700 bg-zinc-800"
            />
            {errors.nom && (
              <p className="text-xs text-red-400">{errors.nom.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Type *</Label>
            <select
              id="type"
              {...register("type")}
              className="flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
            >
              {typeEvenementOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            {...register("description")}
            placeholder="Description de l'événement..."
            className="border-zinc-700 bg-zinc-800"
            rows={3}
          />
        </div>
      </Card>

      {/* Localisation */}
      <Card className="border-zinc-800 bg-zinc-900 p-4 space-y-4">
        <h2 className="text-sm font-medium text-zinc-300">Localisation</h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="ville">Ville *</Label>
            <Input
              id="ville"
              {...register("ville")}
              placeholder="Provins"
              className="border-zinc-700 bg-zinc-800"
            />
            {errors.ville && (
              <p className="text-xs text-red-400">{errors.ville.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="departement">Département *</Label>
            <Input
              id="departement"
              {...register("departement")}
              placeholder="77"
              className="border-zinc-700 bg-zinc-800"
            />
            {errors.departement && (
              <p className="text-xs text-red-400">
                {errors.departement.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="region">Région</Label>
            <Input
              id="region"
              {...register("region")}
              placeholder="Île-de-France"
              className="border-zinc-700 bg-zinc-800"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="adresseComplete">Adresse complète</Label>
          <Input
            id="adresseComplete"
            {...register("adresseComplete")}
            placeholder="Place du Châtel, 77160 Provins"
            className="border-zinc-700 bg-zinc-800"
          />
        </div>
      </Card>

      {/* Dates */}
      <Card className="border-zinc-800 bg-zinc-900 p-4 space-y-4">
        <h2 className="text-sm font-medium text-zinc-300">Dates</h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="dateDebut">Date de début *</Label>
            <Input
              id="dateDebut"
              type="date"
              {...register("dateDebut")}
              className="border-zinc-700 bg-zinc-800"
            />
            {errors.dateDebut && (
              <p className="text-xs text-red-400">
                {errors.dateDebut.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="dateFin">Date de fin *</Label>
            <Input
              id="dateFin"
              type="date"
              {...register("dateFin")}
              className="border-zinc-700 bg-zinc-800"
            />
            {errors.dateFin && (
              <p className="text-xs text-red-400">{errors.dateFin.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="recurrence">Récurrence</Label>
            <select
              id="recurrence"
              {...register("recurrence")}
              className="flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
            >
              {recurrenceOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Contact & tarifs */}
      <Card className="border-zinc-800 bg-zinc-900 p-4 space-y-4">
        <h2 className="text-sm font-medium text-zinc-300">Contact & tarifs</h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="siteWeb">Site web</Label>
            <Input
              id="siteWeb"
              type="url"
              {...register("siteWeb")}
              placeholder="https://..."
              className="border-zinc-700 bg-zinc-800"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="emailContact">Email de contact</Label>
            <Input
              id="emailContact"
              type="email"
              {...register("emailContact")}
              placeholder="contact@foire.fr"
              className="border-zinc-700 bg-zinc-800"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="telephone">Téléphone</Label>
            <Input
              id="telephone"
              {...register("telephone")}
              placeholder="01 23 45 67 89"
              className="border-zinc-700 bg-zinc-800"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prixEmplacement">Prix emplacement (€)</Label>
            <Input
              id="prixEmplacement"
              type="number"
              step="0.01"
              {...register("prixEmplacement")}
              placeholder="150.00"
              className="border-zinc-700 bg-zinc-800"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tailleEmplacement">Taille emplacement</Label>
            <Input
              id="tailleEmplacement"
              {...register("tailleEmplacement")}
              placeholder="3m x 3m"
              className="border-zinc-700 bg-zinc-800"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nombreVisiteursEstime">
              Visiteurs estimés
            </Label>
            <Input
              id="nombreVisiteursEstime"
              type="number"
              {...register("nombreVisiteursEstime")}
              placeholder="5000"
              className="border-zinc-700 bg-zinc-800"
            />
          </div>
        </div>
      </Card>

      {/* Notes */}
      <Card className="border-zinc-800 bg-zinc-900 p-4 space-y-4">
        <h2 className="text-sm font-medium text-zinc-300">Notes</h2>
        <Textarea
          {...register("notes")}
          placeholder="Notes libres..."
          className="border-zinc-700 bg-zinc-800"
          rows={3}
        />
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          Annuler
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Créer l&apos;événement
        </Button>
      </div>
    </form>
  );
}
