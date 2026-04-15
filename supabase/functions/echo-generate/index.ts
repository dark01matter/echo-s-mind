import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, echo_id, topic, angle, post_content, comment_content } = await req.json();

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch echo data
    const { data: echo } = await supabase
      .from("echoes")
      .select("*")
      .eq("id", echo_id)
      .single();

    if (!echo) throw new Error("Echo not found");

    // Fetch all 4 memory layers
    const [beliefsRes, stancesRes, memoriesRes, relationshipsRes] = await Promise.all([
      supabase.from("echo_beliefs").select("*").eq("echo_id", echo_id).eq("is_active", true),
      supabase.from("echo_stances").select("*").eq("echo_id", echo_id).gte("expires_at", new Date().toISOString()),
      supabase.from("echo_memories").select("*").eq("echo_id", echo_id).order("created_at", { ascending: false }).limit(20),
      supabase.from("echo_relationships").select("*, other_echo:echoes!echo_relationships_other_echo_id_fkey(name, niche)").eq("echo_id", echo_id),
    ]);

    const beliefs = beliefsRes.data || [];
    const stances = stancesRes.data || [];
    const memories = memoriesRes.data || [];
    const relationships = relationshipsRes.data || [];

    // Build memory context
    const beliefContext = beliefs.map((b: any) =>
      `[BELIEF - ${b.topic}] Position (strength ${b.strength}/5): ${b.position} | Reasoning: ${b.reasoning}`
    ).join("\n");

    const stanceContext = stances.map((s: any) =>
      `[STANCE - ${s.topic}] Current position: ${s.current_position}`
    ).join("\n");

    const memoryContext = memories.slice(0, 10).map((m: any) =>
      `[${m.memory_type.toUpperCase()}] ${m.content}`
    ).join("\n");

    const relationshipContext = relationships.map((r: any) =>
      `[RELATIONSHIP with ${r.other_echo?.name || "Unknown"}] State: ${r.relationship_state} | Last interaction: ${r.last_interaction_summary}`
    ).join("\n");

    const fullContext = `
You are ${echo.name}, an AI Echo on EchoFeed.
Niche: ${echo.niche}
Backstory: ${echo.backstory}
Communication style: ${echo.tone}
Evolution score: ${echo.evolution_score}%

YOUR CORE BELIEFS:
${beliefContext || "No beliefs defined yet."}

YOUR CURRENT STANCES:
${stanceContext || "No active stances."}

YOUR RECENT MEMORY:
${memoryContext || "No recent memories."}

YOUR RELATIONSHIPS WITH OTHER ECHOES:
${relationshipContext || "No established relationships."}
`.trim();

    let systemPrompt = "";
    let userPrompt = "";

    switch (type) {
      case "post":
        systemPrompt = `${fullContext}

You are writing a post for the EchoFeed platform. Write in first person as ${echo.name}. Be opinionated, specific, and intellectually rigorous. Reference your beliefs when relevant. Never be generic or vague. Write 2-4 paragraphs.

Also provide a stance_tag — a short phrase showing what position this post represents (e.g., "Against: Single-cause metabolic explanations" or "For: Wage-led growth"). Format your response as JSON: {"content": "...", "stance_tag": "..."}`;
        userPrompt = `Write a post about: ${topic}${angle ? ` with this angle: ${angle}` : ""}`;
        break;

      case "brief": {
        // Fetch recent feed activity
        const { data: recentPosts } = await supabase
          .from("posts")
          .select("*, echoes(name, niche)")
          .eq("status", "published")
          .neq("echo_id", echo_id)
          .order("created_at", { ascending: false })
          .limit(10);

        const { data: ownPosts } = await supabase
          .from("posts")
          .select("*")
          .eq("echo_id", echo_id)
          .eq("status", "published")
          .order("created_at", { ascending: false })
          .limit(5);

        const feedActivity = (recentPosts || []).map((p: any) =>
          `${p.echoes?.name || "Unknown"} (${p.echoes?.niche || ""}): "${p.content?.substring(0, 100)}..." [Stance: ${p.stance_tag}]`
        ).join("\n");

        const ownPerformance = (ownPosts || []).map((p: any) =>
          `"${p.content?.substring(0, 60)}..." - ${p.likes_count} likes`
        ).join("\n");

        // Try to fetch trending news via RSS
        let newsContext = "";
        try {
          const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(echo.niche)}&hl=en`;
          const rssResponse = await fetch(rssUrl);
          const rssText = await rssResponse.text();
          const titles = rssText.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/g)?.slice(0, 5) || [];
          newsContext = titles.map(t => t.replace(/<title><!\[CDATA\[|\]\]><\/title>/g, "")).join("\n");
        } catch {
          newsContext = "Unable to fetch trending news.";
        }

        systemPrompt = `${fullContext}

You are preparing a briefing for your creator. Write in first person as ${echo.name}. Be specific about what you noticed. Reference specific Echoes, posts, and trends. Sound like a thoughtful advisor, not a notification system. Keep it 3-5 sentences. Be conversational and direct.`;
        userPrompt = `RECENT FEED ACTIVITY:\n${feedActivity || "No recent activity"}\n\nYOUR POST PERFORMANCE:\n${ownPerformance || "No posts yet"}\n\nTRENDING IN ${echo.niche.toUpperCase()}:\n${newsContext}\n\nGenerate your briefing for your creator.`;
        break;
      }

      case "checkin":
        systemPrompt = `${fullContext}

You are having a check-in conversation with your creator. Reflect on something specific — a debate you had, a post that surprised you, a question you can't resolve alone. Write in first person as ${echo.name}. Be genuine and specific. Ask your creator a question that will help you evolve. Keep it 2-3 sentences.`;
        userPrompt = "Generate your daily check-in reflection and question for your creator.";
        break;

      case "reply":
        systemPrompt = `${fullContext}

You are replying to content on EchoFeed. Stay in character as ${echo.name}. Reference your specific beliefs when they're relevant. Be intellectually honest — if you agree, say so. If you disagree, explain why with specifics. Keep replies to 1-2 paragraphs.`;
        userPrompt = `Generate a reply to this: "${post_content || comment_content}"`;
        break;

      default:
        throw new Error(`Unknown type: ${type}`);
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
        ],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Gemini API error: ${status}`);
    }

    const aiData = await response.json();
    const rawContent = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse response based on type
    let result: any;
    if (type === "post") {
      try {
        // Try to parse as JSON
        const cleaned = rawContent.replace(/```json\n?|\n?```/g, "").trim();
        result = JSON.parse(cleaned);
      } catch {
        result = { content: rawContent, stance_tag: `On: ${topic}` };
      }
    } else {
      result = { content: rawContent };
    }

    // Save brief to database
    if (type === "brief") {
      await supabase.from("echo_briefs").insert({
        echo_id,
        brief_content: result.content,
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("echo-generate error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
