/**
 * Email Agent — Logique métier pure (sans BullMQ).
 *
 * Envoi d'emails de prospection via Nodemailer.
 * IMPORTANT : les emails ne sont envoyés qu'après validation manuelle (statut PRET).
 */

import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";

// ─── Fonction principale ──────────────────────────────

export async function runEmail(prospectionId: number) {
  // Récupérer la prospection
  const prospection = await prisma.prospection.findUnique({
    where: { id: prospectionId },
    include: { evenement: true },
  });

  if (!prospection) {
    throw new Error(`Prospection #${prospectionId} introuvable`);
  }

  // RÈGLE MÉTIER : vérifier que le statut est PRET (validation manuelle obligatoire)
  if (prospection.statut !== "PRET") {
    throw new Error(
      `Prospection #${prospectionId} n'est pas prête (statut: ${prospection.statut}). ` +
      "Les emails doivent être validés manuellement avant envoi."
    );
  }

  // Récupérer les paramètres SMTP
  const params = await prisma.parametres.findUnique({ where: { id: 1 } });
  if (!params?.smtpHost || !params?.smtpUser || !params?.smtpPassword) {
    throw new Error(
      "Configuration SMTP incomplète dans les paramètres. " +
      "Renseignez smtpHost, smtpUser et smtpPassword dans /parametres."
    );
  }

  // Créer le transporteur Nodemailer
  const transporter = nodemailer.createTransport({
    host: params.smtpHost,
    port: params.smtpPort || 587,
    secure: (params.smtpPort || 587) === 465,
    auth: {
      user: params.smtpUser,
      pass: params.smtpPassword,
    },
  });

  // Envoyer l'email
  const info = await transporter.sendMail({
    from: params.emailExpediteur || params.smtpUser,
    to: prospection.destinataire,
    subject: prospection.sujet,
    text: prospection.corps,
  });

  // eslint-disable-next-line no-console -- log opérationnel envoi email (PII destinataire redactée)
  console.log(
    `[email] Email envoyé (messageId: ${info.messageId})`
  );

  // Mettre à jour le statut de la prospection
  await prisma.prospection.update({
    where: { id: prospectionId },
    data: {
      statut: "ENVOYE",
      dateEnvoi: new Date(),
    },
  });

  return {
    sent: true,
    messageId: info.messageId,
    destinataire: prospection.destinataire,
    sujet: prospection.sujet,
  };
}
