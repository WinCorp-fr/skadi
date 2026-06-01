import { z } from "zod";

export const typeEvenementOptions = [
  { value: "FOIRE_MEDIEVALE", label: "Foire médiévale" },
  { value: "MARCHE", label: "Marché" },
  { value: "FOIRE_ARTISANALE", label: "Foire artisanale" },
  { value: "SALON", label: "Salon" },
  { value: "BROCANTE", label: "Brocante" },
  { value: "AUTRE", label: "Autre" },
] as const;

export const recurrenceOptions = [
  { value: "UNIQUE", label: "Unique" },
  { value: "ANNUEL", label: "Annuel" },
  { value: "MENSUEL", label: "Mensuel" },
  { value: "HEBDOMADAIRE", label: "Hebdomadaire" },
] as const;

export const statutPipelineOptions = [
  { value: "DECOUVERT", label: "Découvert", color: "bg-zinc-700" },
  { value: "INTERESSE", label: "À étudier", color: "bg-blue-900" },
  { value: "PROSPECTION", label: "À prospecter", color: "bg-amber-600" },
  { value: "RESERVE", label: "Réservé", color: "bg-violet-900" },
  { value: "CONFIRME", label: "Confirmé", color: "bg-emerald-700" },
  { value: "TERMINE", label: "Terminé", color: "bg-zinc-800" },
  { value: "ARCHIVE", label: "Archivé", color: "bg-zinc-900" },
] as const;

// Options filtrées pour le dropdown /evenements (sans ARCHIVE — voir /archives)
export const statutPipelineFilterOptions = statutPipelineOptions.filter(
  (o) => o.value !== "ARCHIVE"
);

export const evenementSchema = z
  .object({
    nom: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
    type: z.enum([
      "FOIRE_MEDIEVALE",
      "MARCHE",
      "FOIRE_ARTISANALE",
      "SALON",
      "BROCANTE",
      "AUTRE",
    ]),
    description: z.string().optional(),
    ville: z.string().min(1, "La ville est requise"),
    departement: z
      .string()
      .min(1, "Le département est requis")
      .max(3, "Code département invalide"),
    region: z.string().optional(),
    adresseComplete: z.string().optional(),
    dateDebut: z.string().min(1, "La date de début est requise"),
    dateFin: z.string().min(1, "La date de fin est requise"),
    recurrence: z.enum(["UNIQUE", "ANNUEL", "MENSUEL", "HEBDOMADAIRE"]),
    siteWeb: z.string().url("URL invalide").optional().or(z.literal("")),
    emailContact: z
      .string()
      .email("Email invalide")
      .optional()
      .or(z.literal("")),
    telephone: z.string().optional(),
    prixEmplacement: z.coerce.number().min(0).optional(),
    tailleEmplacement: z.string().optional(),
    nombreVisiteursEstime: z.coerce.number().int().min(0).optional(),
    notes: z.string().optional(),
  })
  .refine(
    (data) => !data.dateDebut || !data.dateFin || data.dateFin >= data.dateDebut,
    {
      message: "La date de fin doit être postérieure ou égale à la date de début",
      path: ["dateFin"],
    }
  );

export type EvenementFormData = z.infer<typeof evenementSchema>;
