import { db } from "./server/db.ts";
import { users, clients, clientSubscriptions, clientFeatures } from "./drizzle/schema.ts";
import { eq } from "drizzle-orm";

async function main() {
  const appleUser = await db.select().from(users).where(eq(users.email, "apple.review@solvr.com.au")).limit(1);
  console.log("Apple reviewer user:", appleUser.length > 0 ? `✅ EXISTS (id: ${appleUser[0].id})` : "❌ NOT FOUND");

  const androidUser = await db.select().from(users).where(eq(users.email, "android.review@solvr.com.au")).limit(1);
  console.log("Android reviewer user:", androidUser.length > 0 ? `✅ EXISTS (id: ${androidUser[0].id})` : "❌ NOT FOUND");

  if (appleUser.length > 0) {
    const appleClient = await db.select().from(clients).where(eq(clients.userId, appleUser[0].id)).limit(1);
    if (appleClient.length > 0) {
      const clientId = appleClient[0].id;
      console.log(`Apple client: ✅ EXISTS (id: ${clientId})`);
      const subs = await db.select().from(clientSubscriptions).where(eq(clientSubscriptions.clientId, clientId));
      console.log(`Apple subscriptions: ${subs.length > 0 ? JSON.stringify(subs.map(s => ({ plan: s.planId, status: s.status }))) : "❌ NONE"}`);
      const features = await db.select().from(clientFeatures).where(eq(clientFeatures.clientId, clientId));
      console.log(`Apple features: ${features.length > 0 ? features.map(f => f.featureKey).join(", ") : "❌ NONE"}`);
    } else {
      console.log("Apple client: ❌ NOT FOUND");
    }
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
