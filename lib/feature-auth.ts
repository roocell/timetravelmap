import { Prisma, type PrismaClient } from "@prisma/client";
import type { NextRequest } from "next/server";
import { canAccessApp } from "./access";
import { getStackUser } from "../stack";

export type OwnedFeatureKind = "event" | "find" | "prospect";

export class AuthRequiredError extends Error {}
export class AccessDeniedError extends Error {}
export class FeatureOwnershipError extends Error {}

export async function requireStackUser(request?: NextRequest | Request) {
  const user = await getStackUser(request);

  if (!user) {
    throw new AuthRequiredError("You must be signed in to do that");
  }

  if (!canAccessApp(user)) {
    throw new AccessDeniedError("You do not have access to this app");
  }

  return user;
}

export async function getFeatureOwnerId(
  prisma: PrismaClient,
  kind: OwnedFeatureKind,
  id: string
) {
  if (kind === "event") {
    const rows = await prisma.$queryRaw<Array<{ owner_id: string | null }>>(
      Prisma.sql`
        select owner_id
        from timetravelmap.events
        where id = ${id}::uuid
        limit 1
      `
    );

    return rows[0]?.owner_id ?? null;
  }

  if (kind === "find") {
    const rows = await prisma.$queryRaw<Array<{ owner_id: string | null }>>(
      Prisma.sql`
        select owner_id
        from timetravelmap.finds
        where id = ${id}::uuid
        limit 1
      `
    );

    return rows[0]?.owner_id ?? null;
  }

  const rows = await prisma.$queryRaw<Array<{ owner_id: string | null }>>(
    Prisma.sql`
      select owner_id
      from timetravelmap.prospects
      where id = ${id}::uuid
      limit 1
    `
  );

  return rows[0]?.owner_id ?? null;
}

export async function ensureFeatureOwner(
  prisma: PrismaClient,
  kind: OwnedFeatureKind,
  id: string,
  userId: string
) {
  const ownerId = await getFeatureOwnerId(prisma, kind, id);

  if (!ownerId || ownerId !== userId) {
    throw new FeatureOwnershipError("You can only modify features you own");
  }
}

export async function ensureImageOwnedByUser(
  prisma: PrismaClient,
  src: string,
  userId: string
) {
  const rows = await prisma.$queryRaw<Array<{
    id: string;
    owner_id: string | null;
    storage_path: string;
  }>>(
    Prisma.sql`
      select id, owner_id, storage_path
      from timetravelmap.images
      where storage_path = ${src}
      limit 1
    `
  );

  const image = rows[0];

  if (!image) {
    throw new FeatureOwnershipError("Image not found");
  }

  if (!image.owner_id || image.owner_id !== userId) {
    throw new FeatureOwnershipError("You can only attach images you own");
  }

  return {
    id: image.id,
    ownerId: image.owner_id,
    storagePath: image.storage_path
  };
}
