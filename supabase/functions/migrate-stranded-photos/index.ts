// One-shot migration: copy 3 stranded JPEGs from `documents` bucket
// into `photos` bucket and insert photos table rows. Idempotent.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const PROPERTY_ID = "b33f02bf-89de-416d-baa7-919a26c9a37e";

const FILES = [
  {
    src: "e74ae9f0-8f54-4eff-8732-e7568b3d2e52/inbox/1777578907295_24_West_Street_10.jpg",
    dst: `${PROPERTY_ID}/24_West_Street_10.jpg`,
    isCover: false,
    order: 2,
  },
  {
    src: "e74ae9f0-8f54-4eff-8732-e7568b3d2e52/inbox/1777578907295_24_West_Street_Main.jpg",
    dst: `${PROPERTY_ID}/24_West_Street_Main.jpg`,
    isCover: true,
    order: 1,
  },
  {
    src: "e74ae9f0-8f54-4eff-8732-e7568b3d2e52/inbox/1777578907295_24_West_Street_Rear.jpg",
    dst: `${PROPERTY_ID}/24_West_Street_Rear.jpg`,
    isCover: false,
    order: 3,
  },
];

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const results: Array<Record<string, unknown>> = [];

  for (const f of FILES) {
    // 1. Download from documents bucket
    const { data: blob, error: dlErr } = await supabase.storage
      .from("documents")
      .download(f.src);
    if (dlErr || !blob) {
      results.push({ file: f.src, step: "download", error: dlErr?.message ?? "no blob" });
      continue;
    }

    // 2. Upload to photos bucket (upsert = idempotent)
    const { error: upErr } = await supabase.storage
      .from("photos")
      .upload(f.dst, blob, { contentType: "image/jpeg", upsert: true });
    if (upErr) {
      results.push({ file: f.src, step: "upload", error: upErr.message });
      continue;
    }

    // 3. Idempotent insert into public.photos
    const { data: existing } = await supabase
      .from("photos")
      .select("id")
      .eq("property_id", PROPERTY_ID)
      .eq("file_url", f.dst)
      .maybeSingle();

    let photoId = existing?.id as string | undefined;
    if (!photoId) {
      const { data: ins, error: insErr } = await supabase
        .from("photos")
        .insert({
          property_id: PROPERTY_ID,
          file_url: f.dst,
          is_cover: f.isCover,
          display_order: f.order,
        })
        .select("id")
        .single();
      if (insErr) {
        results.push({ file: f.src, step: "insert", error: insErr.message });
        continue;
      }
      photoId = ins.id as string;
    }

    results.push({
      file: f.src,
      newPath: f.dst,
      photoId,
      isCover: f.isCover,
      reused: !!existing,
    });
  }

  // 4. Sanity check
  const { count } = await supabase
    .from("photos")
    .select("*", { count: "exact", head: true })
    .eq("property_id", PROPERTY_ID);

  if (count !== 3) {
    return new Response(
      JSON.stringify({ ok: false, count, results }, null, 2),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ ok: true, count, results }, null, 2),
    { headers: { "content-type": "application/json" } },
  );
});
