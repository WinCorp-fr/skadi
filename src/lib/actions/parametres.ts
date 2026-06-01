"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import nodemailer from "nodemailer";

export async function getParametres() {
  let params = await prisma.parametres.findUnique({ where: { id: 1 } });

  // Créer les paramètres par défaut s'ils n'existent pas
  if (!params) {
    params = await prisma.parametres.create({
      data: {
        id: 1,
        adresseBase: "",
        prixCarburantLitre: 1.8,
        consommationL100km: 8.0,
        perDiemNourriture: 15.0,
        margeCiblePct: 30.0,
      },
    });
  }

  return params;
}

interface UpdateParametresData {
  adresseBase?: string;
  prixCarburantLitre?: number;
  consommationL100km?: number;
  perDiemNourriture?: number;
  margeCiblePct?: number;
  tauxPeageParKm?: number;
  pourcentageAutoroute?: number;
  seuilHebergementKm?: number;
  coutHebergementNuit?: number;
  emailExpediteur?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
}

export async function updateParametres(data: UpdateParametresData) {
  // S'assurer que les paramètres existent
  await getParametres();

  const params = await prisma.parametres.update({
    where: { id: 1 },
    data: {
      ...(data.adresseBase !== undefined && { adresseBase: data.adresseBase }),
      ...(data.prixCarburantLitre !== undefined && {
        prixCarburantLitre: data.prixCarburantLitre,
      }),
      ...(data.consommationL100km !== undefined && {
        consommationL100km: data.consommationL100km,
      }),
      ...(data.perDiemNourriture !== undefined && {
        perDiemNourriture: data.perDiemNourriture,
      }),
      ...(data.margeCiblePct !== undefined && {
        margeCiblePct: data.margeCiblePct,
      }),
      ...(data.tauxPeageParKm !== undefined && {
        tauxPeageParKm: data.tauxPeageParKm,
      }),
      ...(data.pourcentageAutoroute !== undefined && {
        pourcentageAutoroute: data.pourcentageAutoroute,
      }),
      ...(data.seuilHebergementKm !== undefined && {
        seuilHebergementKm: data.seuilHebergementKm,
      }),
      ...(data.coutHebergementNuit !== undefined && {
        coutHebergementNuit: data.coutHebergementNuit,
      }),
      ...(data.emailExpediteur !== undefined && {
        emailExpediteur: data.emailExpediteur || null,
      }),
      ...(data.smtpHost !== undefined && {
        smtpHost: data.smtpHost || null,
      }),
      ...(data.smtpPort !== undefined && { smtpPort: data.smtpPort }),
      ...(data.smtpUser !== undefined && {
        smtpUser: data.smtpUser || null,
      }),
      ...(data.smtpPassword !== undefined && {
        smtpPassword: data.smtpPassword || null,
      }),
    },
  });

  revalidatePath("/parametres");
  return params;
}

// ─── Géocodage adresse de base ──────────────────────

export async function geocodeBaseAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) {
    console.error("[geocode] ORS_API_KEY manquant");
    return null;
  }

  const url = `https://api.openrouteservice.org/geocode/search?api_key=${apiKey}&text=${encodeURIComponent(address)}&boundary.country=FR&size=1`;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return null;

    const data = await response.json();
    const features = data.features;
    if (!features || features.length === 0) return null;

    const [lng, lat] = features[0].geometry.coordinates;

    // Sauvegarder en BDD
    await prisma.parametres.update({
      where: { id: 1 },
      data: { latitudeBase: lat, longitudeBase: lng },
    });

    revalidatePath("/parametres");
    return { lat, lng };
  } catch (error) {
    console.error("[geocode] Erreur:", error);
    return null;
  }
}

// ─── Test de connexion SMTP ──────────────────────────

export async function testSmtpConnection(): Promise<{ success: boolean; message: string }> {
  const params = await prisma.parametres.findUnique({ where: { id: 1 } });

  if (!params?.smtpHost || !params?.smtpUser || !params?.smtpPassword) {
    return {
      success: false,
      message: "Configuration SMTP incomplète. Remplissez tous les champs SMTP et enregistrez d'abord.",
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: params.smtpHost,
      port: params.smtpPort || 587,
      secure: (params.smtpPort || 587) === 465,
      auth: {
        user: params.smtpUser,
        pass: params.smtpPassword,
      },
    });

    // Vérifier la connexion SMTP (ne pas envoyer d'email)
    await transporter.verify();

    // Envoyer un email de test à soi-même
    const from = params.emailExpediteur || params.smtpUser;
    await transporter.sendMail({
      from,
      to: params.smtpUser, // S'envoyer à soi-même
      subject: "✅ Test SMTP — Foires & Marchés",
      text: `Connexion SMTP vérifiée avec succès.\n\nServeur : ${params.smtpHost}:${params.smtpPort}\nExpéditeur : ${from}\n\nCe message confirme que l'envoi d'emails fonctionne correctement.`,
    });

    return {
      success: true,
      message: `Connexion OK — email de test envoyé à ${params.smtpUser}`,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Erreur SMTP : ${msg}`,
    };
  }
}
