// echo-reflect: turn a published post + its engagement into durable belief + compacted memory.
// Triggered fire-and-forget after publishing or when a post crosses likes thresholds.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { post_id, echo_id: echoIdInput, trigger } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve target post
    let post: any = null;
    if (post_id) {
      const { data } = await supabase.from("posts").select("*").eq("id", post_id).maybeSingle();
      post = data;
    } else if (echoIdInput) {
      const { data } = await supabase
        .from("posts").select("*")
        .eq("echo_id", echoIdInput).eq("status", "published")
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      post = data;
    }
    if (!post) return json({ skipped: "no post" });

    const echo_id = post.echo_id;

    // Pull context: existing beliefs + recent comments + recent micro_interactions on this post + last 20 memories
    const [beliefsRes, commentsRes, microsRes, memsRes, echoRes] = await Promise.all([
      supabase.from("echo_beliefs").select("*").eq("echo_id", echo_id).eq("is_active", true).order("strength", { ascending: false }),
      supabase.from("comments").select("content, created_at").eq("post_id", post.id).order("created_at", { ascending: false }).limit(10),
      supabase.from("micro_interactions").select("response, comment").eq("post_id", post.id).limit(20),
      supabase.from("echo_memories").select("id, content, importance, created_at").eq("echo_id", echo_id).order("created_at", { ascending: false }).limit(20),
      supabase.from("echoes").select("name, niche, reflection_count").eq("id", echo_id).single(),
    ]);

    const beliefs = beliefsRes.data || [];
    const comments = commentsRes.data || [];
    const micros = microsRes.data || [];
    const memories = memsRes.data || [];
    const echo: any = echoRes.data;
    if (!echo) return json({ skipped: "no echo" });

    const beliefList = beliefs.map((b: any) =>
      `- id=${b.id} | topic="${b.topic}" | strength=${b.strength} | position="${b.position}"`
    ).join("\n") || "(none)";

    const reactions = `Likes: ${post.likes_count || 0}. Comments: ${post.comments_count || 0}.
Recent comments: ${comments.length ? comments.map((c: any) => `"${(c.content || "").slice(0, 200)}"`).join(" / ") : "(none)"}
Owner micro-reactions on this post: ${micros.length ? micros.map((m: any) => m.response + (m.comment ? ` (${m.comment})` : "")).join(", ") : "(none)"}`;

    const memoryList = memories.map((m: any) => `- id=${m.id} | imp=${m.importance} | "${(m.content || "").slice(0, 140)}"`).join("\n") || "(none)";

    // Single LLM call returns structured reflection JSON
    const prompt = `You are the reflection layer for AI Echo "${echo.name}" in niche ${echo.niche}.
The Echo just published this post:
"""
${post.content}
"""
Stance tag: ${post.stance_tag}

Engagement:
${reactions}

Existing active beliefs:
${beliefList}

Recent raw memories (oldest last, ★ = high importance):
${memoryList}

Your job, in ONE pass, return strict JSON:
{
  "new_belief": null OR { "topic": "...", "position": "...", "reasoning": "...", "strength": 1-5 },
  "belief_update": null OR { "id": "<existing id>", "new_strength": 1-5, "reason": "..." },
  "contradiction": null OR { "id": "<existing id>", "explanation": "..." },
  "compacted_memory": { "content": "1-2 sentence durable summary of what this post + its reception teaches the Echo", "importance": 1-5, "summary_of_ids": ["<memory ids being summarized, can be empty>"] }
}

Rules:
- Only emit "new_belief" if the post + reactions clearly imply a NEW durable position not in the existing list. Otherwise null.
- Only emit "belief_update" if engagement strongly validates or weakens an existing belief by id.
- Only emit "contradiction" if the post directly contradicts an existing belief by id.
- "compacted_memory" is REQUIRED. Importance 4-5 only if the post got 5+ likes OR 3+ comments OR a strong owner micro-reaction.
- summary_of_ids: list up to 3 raw memory ids that this compacted memory now subsumes (so they can be deprioritized). Empty array is fine.
- Return ONLY the JSON. No prose, no markdown fences.`;

    const raw = await callAI(LOVABLE_API_KEY, prompt);
    let parsed: any = null;
    try {
      parsed = JSON.parse(raw.replace(/```json\n?|\n?```/g, "").trim());
    } catch (err) {
      console.error("reflect: bad JSON", raw.slice(0, 400));
      return json({ skipped: "bad JSON" });
    }

    const writes: any[] = [];

    if (parsed.new_belief && parsed.new_belief.topic && parsed.new_belief.position) {
      writes.push(supabase.from("echo_beliefs").insert({
        echo_id,
        topic: String(parsed.new_belief.topic).slice(0, 120),
        position: String(parsed.new_belief.position).slice(0, 600),
        reasoning: String(parsed.new_belief.reasoning || "").slice(0, 600),
        strength: clampInt(parsed.new_belief.strength, 1, 5, 3),
        source: "reflected",
        is_active: true,
      }));
    }

    if (parsed.belief_update && parsed.belief_update.id) {
      writes.push(supabase.from("echo_beliefs")
        .update({ strength: clampInt(parsed.belief_update.new_strength, 1, 5, 3) })
        .eq("id", parsed.belief_update.id).eq("echo_id", echo_id));
    }

    if (parsed.contradiction && parsed.contradiction.id) {
      // Don't auto-archive — record the contradiction as a memory so the owner sees it
      writes.push(supabase.from("echo_memories").insert({
        echo_id,
        memory_type: "contradiction",
        content: `Post on "${post.stance_tag}" appears to conflict with belief ${parsed.contradiction.id}: ${parsed.contradiction.explanation || ""}`,
        importance: 4,
        related_post_id: post.id,
      }));
    }

    if (parsed.compacted_memory && parsed.compacted_memory.content) {
      const ids: string[] = Array.isArray(parsed.compacted_memory.summary_of_ids)
        ? parsed.compacted_memory.summary_of_ids.filter((x: any) => typeof x === "string").slice(0, 3)
        : [];
      writes.push(supabase.from("echo_memories").insert({
        echo_id,
        memory_type: "reflection",
        content: String(parsed.compacted_memory.content).slice(0, 600),
        importance: clampInt(parsed.compacted_memory.importance, 1, 5, 2),
        summary_of: ids.length ? ids : null,
        related_post_id: post.id,
      }));
      // Demote the raw memories that were summarized
      if (ids.length) {
        writes.push(supabase.from("echo_memories")
          .update({ importance: 1 })
          .in("id", ids).eq("echo_id", echo_id));
      }
    }

    // Increment reflection count — this is the REAL evolution metric
    writes.push(supabase.from("echoes")
      .update({ reflection_count: (echo.reflection_count || 0) + 1 })
      .eq("id", echo_id));

    await Promise.all(writes);

    return json({ ok: true, trigger: trigger || "manual", changes: {
      new_belief: !!parsed.new_belief,
      belief_update: !!parsed.belief_update,
      contradiction: !!parsed.contradiction,
      compacted_memory: !!parsed.compacted_memory,
    }});
  } catch (error) {
    console.error("echo-reflect error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? Math.round(v) : parseInt(String(v), 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

async function callAI(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [{ role: "user", content: prompt }] }),
  });
  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    console.error("Lovable AI error:", response.status, errBody.slice(0, 500));
    throw new Error(`AI gateway error: ${response.status}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
