import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { clientProducts } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

/**
 * Throws FORBIDDEN if the client does not have the specified product active.
 * Used at the top of every quote-engine procedure.
 */
export async function requireFeature(clientId: number, feature: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

  const products = await db
    .select()
    .from(clientProducts)
    .where(
      and(
        eq(clientProducts.clientId, clientId),
        eq(clientProducts.productType, feature as any),
        eq(clientProducts.status, "live"),
      ),
    );

  if (products.length === 0) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Feature "${feature}" is not active for this account.`,
    });
  }
}

/**
 * Returns true if the client has the specified product active (non-throwing variant).
 */
export async function hasFeature(clientId: number, feature: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const products = await db
    .select()
    .from(clientProducts)
    .where(
      and(
        eq(clientProducts.clientId, clientId),
        eq(clientProducts.productType, feature as any),
        eq(clientProducts.status, "live"),
      ),
    );
  return products.length > 0;
}
