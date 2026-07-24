// Public read-only product feed for the storefront.
import { getStore } from "@netlify/blobs";

export default async () => {
  try {
    const store = getStore({ name: "frans-cms", consistency: "strong" });
    const settings = (await store.get("settings", { type: "json" })) || { pricingMode: "dual", dualPercent: 3.5, achEnabled: true };
    const products = (await store.get("products", { type: "json" })) || [];
    return new Response(JSON.stringify({ settings, products }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60" }
    });
  } catch (err) {
    console.error("products error:", err.message);
    return new Response(JSON.stringify({ settings: null, products: [] }), {
      status: 200, headers: { "Content-Type": "application/json" }
    });
  }
};
