"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MapPin, Fuel, Mail, Brain, Loader2, Check, Send } from "lucide-react";
import { updateParametres, testSmtpConnection, geocodeBaseAddress } from "@/lib/actions/parametres";

interface ParametresFormProps {
  initial: {
    adresseBase: string;
    latitudeBase: number | null;
    longitudeBase: number | null;
    prixCarburantLitre: number;
    consommationL100km: number;
    perDiemNourriture: number;
    margeCiblePct: number;
    tauxPeageParKm: number;
    pourcentageAutoroute: number;
    seuilHebergementKm: number;
    coutHebergementNuit: number;
    emailExpediteur: string | null;
    smtpHost: string | null;
    smtpPort: number | null;
    smtpUser: string | null;
    smtpPassword: string | null;
  };
}

export function ParametresForm({ initial }: ParametresFormProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [smtpResult, setSmtpResult] = useState<{ success: boolean; message: string } | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [geoResult, setGeoResult] = useState<{ lat: number; lng: number } | null>(
    initial.latitudeBase && initial.longitudeBase
      ? { lat: initial.latitudeBase, lng: initial.longitudeBase }
      : null
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    const formData = new FormData(e.currentTarget);

    await updateParametres({
      adresseBase: formData.get("adresseBase") as string,
      prixCarburantLitre: parseFloat(
        formData.get("prixCarburantLitre") as string
      ),
      consommationL100km: parseFloat(
        formData.get("consommationL100km") as string
      ),
      perDiemNourriture: parseFloat(
        formData.get("perDiemNourriture") as string
      ),
      margeCiblePct: parseFloat(formData.get("margeCiblePct") as string),
      tauxPeageParKm: parseFloat(formData.get("tauxPeageParKm") as string),
      pourcentageAutoroute: parseFloat(formData.get("pourcentageAutoroute") as string),
      seuilHebergementKm: parseInt(formData.get("seuilHebergementKm") as string),
      coutHebergementNuit: parseFloat(formData.get("coutHebergementNuit") as string),
      emailExpediteur: formData.get("emailExpediteur") as string,
      smtpHost: formData.get("smtpHost") as string,
      smtpPort: parseInt(formData.get("smtpPort") as string) || 587,
      smtpUser: formData.get("smtpUser") as string,
      smtpPassword: formData.get("smtpPassword") as string,
    });

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Adresse de base */}
      <Card className="border-zinc-800 bg-zinc-900 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-zinc-400" />
          <h2 className="text-sm font-medium">Adresse de base</h2>
        </div>
        <p className="text-xs text-zinc-500">
          Point de départ pour le calcul des distances (adresse du client)
        </p>
        <div className="space-y-2">
          <Label htmlFor="adresseBase">Adresse complète</Label>
          <div className="flex gap-2">
            <Input
              id="adresseBase"
              name="adresseBase"
              defaultValue={initial.adresseBase}
              placeholder="12 rue du Fromage, 64000 Pau"
              className="border-zinc-700 bg-zinc-800"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={geocoding}
              className="shrink-0"
              onClick={async () => {
                setGeocoding(true);
                const adresse = (document.getElementById("adresseBase") as HTMLInputElement)?.value;
                if (!adresse) {
                  setGeocoding(false);
                  return;
                }
                const result = await geocodeBaseAddress(adresse);
                if (result) {
                  setGeoResult(result);
                }
                setGeocoding(false);
              }}
            >
              {geocoding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MapPin className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        {geoResult && (
          <p className="text-xs text-emerald-400">
            Coordonnées : {geoResult.lat.toFixed(4)}, {geoResult.lng.toFixed(4)}
          </p>
        )}
      </Card>

      {/* Véhicule & coûts */}
      <Card className="border-zinc-800 bg-zinc-900 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Fuel className="h-4 w-4 text-zinc-400" />
          <h2 className="text-sm font-medium">Véhicule & coûts</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="prixCarburantLitre">Prix carburant (€/L)</Label>
            <Input
              id="prixCarburantLitre"
              name="prixCarburantLitre"
              type="number"
              step="0.001"
              defaultValue={Number(initial.prixCarburantLitre)}
              className="border-zinc-700 bg-zinc-800"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="consommationL100km">
              Consommation (L/100km)
            </Label>
            <Input
              id="consommationL100km"
              name="consommationL100km"
              type="number"
              step="0.1"
              defaultValue={Number(initial.consommationL100km)}
              className="border-zinc-700 bg-zinc-800"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="perDiemNourriture">Per diem nourriture (€)</Label>
            <Input
              id="perDiemNourriture"
              name="perDiemNourriture"
              type="number"
              step="0.5"
              defaultValue={Number(initial.perDiemNourriture)}
              className="border-zinc-700 bg-zinc-800"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="margeCiblePct">Marge cible (%)</Label>
            <Input
              id="margeCiblePct"
              name="margeCiblePct"
              type="number"
              step="1"
              defaultValue={Number(initial.margeCiblePct)}
              className="border-zinc-700 bg-zinc-800"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tauxPeageParKm">Péage (€/km)</Label>
            <Input
              id="tauxPeageParKm"
              name="tauxPeageParKm"
              type="number"
              step="0.001"
              defaultValue={Number(initial.tauxPeageParKm)}
              className="border-zinc-700 bg-zinc-800"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pourcentageAutoroute">% autoroute</Label>
            <Input
              id="pourcentageAutoroute"
              name="pourcentageAutoroute"
              type="number"
              step="0.05"
              min="0"
              max="1"
              defaultValue={Number(initial.pourcentageAutoroute)}
              className="border-zinc-700 bg-zinc-800"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="seuilHebergementKm">Seuil hébergement (km)</Label>
            <Input
              id="seuilHebergementKm"
              name="seuilHebergementKm"
              type="number"
              step="10"
              defaultValue={initial.seuilHebergementKm}
              className="border-zinc-700 bg-zinc-800"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="coutHebergementNuit">Hébergement (€/nuit)</Label>
            <Input
              id="coutHebergementNuit"
              name="coutHebergementNuit"
              type="number"
              step="5"
              defaultValue={Number(initial.coutHebergementNuit)}
              className="border-zinc-700 bg-zinc-800"
            />
          </div>
        </div>
      </Card>

      {/* Configuration email */}
      <Card className="border-zinc-800 bg-zinc-900 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-zinc-400" />
          <h2 className="text-sm font-medium">Configuration email (SMTP)</h2>
        </div>
        <p className="text-xs text-zinc-500">
          Pour l&apos;envoi des emails de prospection par l&apos;Email Agent
        </p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="emailExpediteur">Email expéditeur</Label>
            <Input
              id="emailExpediteur"
              name="emailExpediteur"
              type="email"
              defaultValue={initial.emailExpediteur ?? ""}
              placeholder="fromage@mondomaine.fr"
              className="border-zinc-700 bg-zinc-800"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="smtpHost">Serveur SMTP</Label>
            <Input
              id="smtpHost"
              name="smtpHost"
              defaultValue={initial.smtpHost ?? ""}
              placeholder="smtp.gmail.com"
              className="border-zinc-700 bg-zinc-800"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="smtpPort">Port SMTP</Label>
            <Input
              id="smtpPort"
              name="smtpPort"
              type="number"
              defaultValue={initial.smtpPort ?? 587}
              className="border-zinc-700 bg-zinc-800"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="smtpUser">Utilisateur SMTP</Label>
            <Input
              id="smtpUser"
              name="smtpUser"
              defaultValue={initial.smtpUser ?? ""}
              placeholder="user@gmail.com"
              className="border-zinc-700 bg-zinc-800"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="smtpPassword">Mot de passe SMTP</Label>
            <Input
              id="smtpPassword"
              name="smtpPassword"
              type="password"
              defaultValue={initial.smtpPassword ?? ""}
              placeholder="••••••••"
              className="border-zinc-700 bg-zinc-800"
            />
          </div>
        </div>

        {/* Bouton test SMTP */}
        <div className="flex items-center gap-3 border-t border-zinc-800 pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={testingSmtp}
            onClick={async () => {
              setTestingSmtp(true);
              setSmtpResult(null);
              const result = await testSmtpConnection();
              setSmtpResult(result);
              setTestingSmtp(false);
            }}
          >
            {testingSmtp ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            {testingSmtp ? "Test en cours..." : "Tester la connexion email"}
          </Button>
          {smtpResult && (
            <span
              className={`text-xs ${smtpResult.success ? "text-emerald-400" : "text-red-400"}`}
            >
              {smtpResult.message}
            </span>
          )}
        </div>
      </Card>

      {/* API keys info */}
      <Card className="border-zinc-800 bg-zinc-900 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-zinc-400" />
          <h2 className="text-sm font-medium">Clés API</h2>
        </div>
        <p className="text-xs text-zinc-500">
          Les clés API (Anthropic, OpenRouteService) sont configurées dans le
          fichier <code className="text-zinc-400">.env</code> pour des raisons de
          sécurité. Elles ne sont pas stockées en base.
        </p>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        {saved && (
          <span className="flex items-center gap-1 text-sm text-emerald-400">
            <Check className="h-4 w-4" /> Paramètres sauvegardés
          </span>
        )}
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Enregistrer
        </Button>
      </div>
    </form>
  );
}
