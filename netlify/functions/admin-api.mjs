// Fran's Boutique CMS — admin API (Netlify Functions v2 + Netlify Blobs)
// Auth: x-admin-key header must equal ADMIN_PASSWORD env var (set in Netlify).
import { getStore } from "@netlify/blobs";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

const DEFAULT_SETTINGS = {
  pricingMode: "dual",        // "single" | "dual"
  dualPercent: 3.5,           // card price = bank price * (1 + dualPercent/100)
  achEnabled: true
};

export default async (req) => {
  const key = req.headers.get("x-admin-key") || "";
  const expected = Netlify.env.get("ADMIN_PASSWORD") || "";
  if (!expected) return json({ error: "ADMIN_PASSWORD not configured in Netlify env vars" }, 500);
  if (key !== expected) return json({ error: "Unauthorized" }, 401);

  const store = getStore({ name: "frans-cms", consistency: "strong" });
  const url = new URL(req.url);
  const resource = url.searchParams.get("resource") || "all";

  try {
    if (req.method === "GET") {
      const settings = (await store.get("settings", { type: "json" })) || DEFAULT_SETTINGS;
      const products = (await store.get("products", { type: "json" })) || [];
      return json({ settings, products });
    }

    if (req.method === "PUT" && resource === "settings") {
      const body = await req.json();
      const settings = {
        pricingMode: body.pricingMode === "single" ? "single" : "dual",
        dualPercent: Math.max(0, Math.min(10, Number(body.dualPercent) || 0)),
        achEnabled: !!body.achEnabled
      };
      await store.setJSON("settings", settings);
      return json({ ok: true, settings });
    }

    if (req.method === "POST" && resource === "product") {
      const b = await req.json();
      const products = (await store.get("products", { type: "json" })) || [];
      const p = {
        id: b.id || ("p" + Date.now().toString(36)),
        name: String(b.name || "").slice(0, 120),
        collection: ["find", "studio", "shelf"].includes(b.collection) ? b.collection : "find",
        priceBank: Math.max(0, Number(b.priceBank) || 0),
        badge: String(b.badge || "").slice(0, 40),
        imgUrl: String(b.imgUrl || "").slice(0, 500),
        sold: !!b.sold,
        stripeLink: String(b.stripeLink || "").slice(0, 500),
        achLink: String(b.achLink || "").slice(0, 500),
        paypalLink: String(b.paypalLink || "").slice(0, 500)
      };
      const i = products.findIndex(x => x.id === p.id);
      if (i >= 0) products[i] = p; else products.unshift(p);
      await store.setJSON("products", products);
      return json({ ok: true, product: p });
    }

    if (req.method === "DELETE" && resource === "product") {
      const id = url.searchParams.get("id");
      let products = (await store.get("products", { type: "json" })) || [];
      products = products.filter(x => x.id !== id);
      await store.setJSON("products", products);
      return json({ ok: true });
    }

    return json({ error: "Unsupported operation" }, 400);
  } catch (err) {
    console.error("admin-api error:", err.message);
    return json({ error: "Server error" }, 500);
  }
};
