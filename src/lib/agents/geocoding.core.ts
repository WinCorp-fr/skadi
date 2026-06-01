/**
 * Géocodage Agent — Logique métier pure (sans BullMQ).
 *
 * Résolution d'adresses + calcul distances via OpenRouteService.
 * Cache en PostgreSQL (table GeocodingCache, TTL 30 jours).
 *
 * API : OpenRouteService (gratuit, 2000 req/jour)
 */

import { prisma } from "@/lib/prisma";

// ─── Types ────────────────────────────────────────────

interface GeocodingResult {
  latitude: number;
  longitude: number;
}

interface DirectionsResult {
  distanceKm: number;
  dureeTrajetMin: number;
}

// ─── Constantes ──────────────────────────────────────

const ORS_BASE_URL = "https://api.openrouteservice.org";
const CACHE_TTL_DAYS = 30;
const DELAY_BETWEEN_REQUESTS_MS = 1500; // Rate-limit ORS (40 req/min)
const MAX_EVENTS_PER_BATCH = 5; // Limite pour respecter timeout Vercel (60s)

// ─── Cache PostgreSQL ────────────────────────────────

async function getCached<T>(key: string): Promise<T | null> {
  const entry = await prisma.geocodingCache.findUnique({
    where: { cacheKey: key },
  });

  if (!entry) return null;

  // Vérifier expiration
  if (new Date() > entry.expiresAt) {
    // Expiry — supprimer et retourner null
    await prisma.geocodingCache.delete({ where: { cacheKey: key } }).catch(() => {});
    return null;
  }

  return entry.data as T;
}

async function setCache(key: string, data: object): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + CACHE_TTL_DAYS);

  await prisma.geocodingCache.upsert({
    where: { cacheKey: key },
    create: { cacheKey: key, data, expiresAt },
    update: { data, expiresAt },
  });
}

// ─── Helpers API ─────────────────────────────────────

function getOrsApiKey(): string {
  const key = process.env.ORS_API_KEY;
  if (!key) {
    throw new Error("ORS_API_KEY manquant dans les variables d'environnement");
  }
  return key;
}

async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  // Vérifier le cache PostgreSQL
  const cacheKey = `geocode:${address.toLowerCase().trim()}`;
  const cached = await getCached<GeocodingResult>(cacheKey);
  if (cached) return cached;

  const url = `${ORS_BASE_URL}/geocode/search?api_key=${getOrsApiKey()}&text=${encodeURIComponent(address)}&boundary.country=FR&size=1`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    console.error(`[geocoding] Erreur géocodage pour "${address}": ${response.status}`);
    return null;
  }

  const data = await response.json();
  const features = data.features;

  if (!features || features.length === 0) {
    console.warn(`[geocoding] Aucun résultat pour "${address}"`);
    return null;
  }

  const [lng, lat] = features[0].geometry.coordinates;
  const result: GeocodingResult = { latitude: lat, longitude: lng };

  // Mettre en cache
  await setCache(cacheKey, result);

  return result;
}

async function calculateRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<DirectionsResult | null> {
  // Vérifier le cache PostgreSQL
  const cacheKey = `route:${fromLat.toFixed(4)},${fromLng.toFixed(4)}→${toLat.toFixed(4)},${toLng.toFixed(4)}`;
  const cached = await getCached<DirectionsResult>(cacheKey);
  if (cached) return cached;

  const url = `${ORS_BASE_URL}/v2/directions/driving-car`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: getOrsApiKey(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        coordinates: [
          [fromLng, fromLat],
          [toLng, toLat],
        ],
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    console.error(`[geocoding] Erreur calcul route: ${response.status}`);
    return null;
  }

  const data = await response.json();
  const route = data.routes?.[0];

  if (!route) {
    console.warn("[geocoding] Aucune route trouvée");
    return null;
  }

  const result: DirectionsResult = {
    distanceKm: Math.round((route.summary.distance / 1000) * 10) / 10,
    dureeTrajetMin: Math.round(route.summary.duration / 60),
  };

  // Mettre en cache
  await setCache(cacheKey, result);

  return result;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Fonction principale ──────────────────────────────

export async function runGeocoding(eventIds: number[]) {
  if (eventIds.length > MAX_EVENTS_PER_BATCH) {
    throw new Error(
      `Maximum ${MAX_EVENTS_PER_BATCH} événements par appel géocodage (contrainte timeout Vercel). Reçu : ${eventIds.length}`
    );
  }

  // Récupérer les paramètres (adresse de base)
  const params = await prisma.parametres.findUnique({ where: { id: 1 } });
  if (!params?.latitudeBase || !params?.longitudeBase) {
    throw new Error(
      "Adresse de base non configurée dans les paramètres (latitude/longitude manquantes)"
    );
  }

  // Récupérer les événements à géocoder
  const events = await prisma.evenement.findMany({
    where: { id: { in: eventIds } },
    select: {
      id: true,
      nom: true,
      ville: true,
      departement: true,
      adresseComplete: true,
      latitude: true,
      longitude: true,
    },
  });

  let geocoded = 0;
  let cached = 0;
  let failed = 0;

  for (const event of events) {
    try {
      let lat = event.latitude;
      let lng = event.longitude;

      // 1. Géocoder si pas de coordonnées
      if (!lat || !lng) {
        const address = event.adresseComplete || `${event.ville}, ${event.departement}, France`;
        const geo = await geocodeAddress(address);

        if (!geo) {
          failed++;
          continue;
        }

        lat = geo.latitude;
        lng = geo.longitude;
        await sleep(DELAY_BETWEEN_REQUESTS_MS);
      } else {
        cached++;
      }

      // 2. Calculer la distance depuis la base
      const route = await calculateRoute(
        params.latitudeBase,
        params.longitudeBase,
        lat,
        lng
      );

      if (!route) {
        // On a les coordonnées mais pas la route — sauvegarder quand même
        await prisma.evenement.update({
          where: { id: event.id },
          data: { latitude: lat, longitude: lng },
        });
        failed++;
        continue;
      }

      await sleep(DELAY_BETWEEN_REQUESTS_MS);

      // 3. Mettre à jour l'événement
      await prisma.evenement.update({
        where: { id: event.id },
        data: { latitude: lat, longitude: lng },
      });

      // 4. Créer/mettre à jour CoutEvenement avec distance/durée
      await prisma.coutEvenement.upsert({
        where: { evenementId: event.id },
        create: {
          evenementId: event.id,
          distanceKm: route.distanceKm,
          dureeTrajetMin: route.dureeTrajetMin,
        },
        update: {
          distanceKm: route.distanceKm,
          dureeTrajetMin: route.dureeTrajetMin,
        },
      });

      geocoded++;
    } catch (error) {
      console.error(`[geocoding] Erreur pour event #${event.id}:`, error);
      failed++;
    }
  }

  return { geocoded, cached, failed, total: events.length };
}
