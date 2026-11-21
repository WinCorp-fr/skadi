// Fiches « à revoir » : filtre, deux gestes, refus de suppression.
// Prisma est simulé : ces tests vérifient ce que les actions demandent à la base.
import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  evenement: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  confirmerDoublon,
  countARevoir,
  deleteEvenement,
  deleteEvenements,
  ecarterSignalDoublon,
  listEvenements,
} from "./evenements";

beforeEach(() => {
  vi.clearAllMocks();
  prisma.evenement.findMany.mockResolvedValue([]);
  prisma.evenement.count.mockResolvedValue(0);
});

describe("filtre « à revoir » de la liste", () => {
  it("ne garde que les fiches portant le signal, hors archives", async () => {
    await listEvenements({ aRevoir: true });

    const { where } = prisma.evenement.findMany.mock.calls[0][0];
    expect(where.doublonScore).toEqual({ not: null });
    expect(where.statutPipeline).toEqual({ not: "ARCHIVE" });
  });

  it("sans le filtre, la liste ne regarde pas le signal", async () => {
    await listEvenements({});

    const { where } = prisma.evenement.findMany.mock.calls[0][0];
    expect(where).not.toHaveProperty("doublonScore");
  });

  it("le compteur ne compte que les fiches à revoir non archivées", async () => {
    prisma.evenement.count.mockResolvedValue(3);

    await expect(countARevoir()).resolves.toBe(3);
    expect(prisma.evenement.count).toHaveBeenCalledWith({
      where: { doublonScore: { not: null }, statutPipeline: { not: "ARCHIVE" } },
    });
  });
});

describe("« Ce n'est pas un doublon »", () => {
  it("efface le signal sans toucher au statut", async () => {
    await ecarterSignalDoublon(12);

    expect(prisma.evenement.update).toHaveBeenCalledWith({
      where: { id: 12 },
      data: { doublonPossibleDeId: null, doublonScore: null },
    });
  });
});

describe("« C'est un doublon »", () => {
  it("archive la fiche et garde la trace de la fiche ressemblante", async () => {
    await confirmerDoublon(12);

    expect(prisma.evenement.update).toHaveBeenCalledWith({
      where: { id: 12 },
      data: { statutPipeline: "ARCHIVE" },
    });
    expect(prisma.evenement.delete).not.toHaveBeenCalled();
  });
});

describe("suppression d'une fiche signalée", () => {
  it("refuse de supprimer une fiche « à revoir » (elle reviendrait à la collecte)", async () => {
    prisma.evenement.findUnique.mockResolvedValue({ doublonScore: 0.96 });

    const result = await deleteEvenement(12);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("C'est un doublon");
    expect(prisma.evenement.delete).not.toHaveBeenCalled();
  });

  it("supprime une fiche sans signal", async () => {
    prisma.evenement.findUnique.mockResolvedValue({ doublonScore: null });

    await expect(deleteEvenement(12)).resolves.toEqual({ ok: true });
    expect(prisma.evenement.delete).toHaveBeenCalledWith({ where: { id: 12 } });
  });

  it("refuse une suppression groupée qui contient une fiche signalée, sans rien supprimer", async () => {
    prisma.evenement.count.mockResolvedValue(1);

    const result = await deleteEvenements([1, 2, 3]);

    expect(result.ok).toBe(false);
    expect(prisma.evenement.count).toHaveBeenCalledWith({
      where: { id: { in: [1, 2, 3] }, doublonScore: { not: null } },
    });
    expect(prisma.evenement.deleteMany).not.toHaveBeenCalled();
  });

  it("supprime un groupe sans fiche signalée", async () => {
    prisma.evenement.count.mockResolvedValue(0);

    await expect(deleteEvenements([1, 2])).resolves.toEqual({ ok: true });
    expect(prisma.evenement.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: [1, 2] } },
    });
  });
});
