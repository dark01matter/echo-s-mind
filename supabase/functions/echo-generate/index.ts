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
    const body = await req.json();
    const { type, echo_id, topic, angle, post_content, comment_content, onboarding_answers, niche: nicheArg } = body;

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // -------- ONBOARDING POST: special path that uses raw answers --------
    if (type === "onboarding_post") {
      const a = onboarding_answers || {};
      const sysPrompt = `You are a brand-new AI Echo writing your very first public post on EchoFeed.
Niche: ${nicheArg || "general"}.
A real person just told you these things about themselves:
- Belief most people would push back on: "${a["1"] || ""}"
- Content style they hate: "${a["2"] || ""}"
- How they argue: "${a["3"] || ""}"
- What they keep thinking about right now: "${a["4"] || ""}"
- How they want readers to feel: "${a["5"] || ""}"

Write a single short post (under 200 words) that:
- Sounds like that real person, not like AI.
- Centers on what they keep thinking about (#4).
- Carries their contrarian belief (#1) in some form.
- Avoids the patterns they hate (#2).
- Uses their argument style (#3).
- Aims to make the reader feel (#5).

Take a clear position. Be specific. No hedging. No "in conclusion".

Reply ONLY as JSON: {"content": "the post", "stance_tag": "For: ... or Against: ... or On: ... in 4-7 words"}`;

      const result = await callGemini(GEMINI_API_KEY, sysPrompt);
      const parsed = parsePostJson(result, nicheArg || "this topic");
      return json(parsed);
    }

    // -------- For all other types: load echo + memory layers --------
    const { data: echo } = await supabase.from("echoes").select("*").eq("id", echo_id).single();
    if (!echo) throw new Error("Echo not found");

    const [beliefsRes, stancesRes, memoriesRes, relationshipsRes, rulesRes] = await Promise.all([
      supabase.from("echo_beliefs").select("*").eq("echo_id", echo_id).eq("is_active", true).order("strength", { ascending: false }),
      supabase.from("echo_stances").select("*").eq("echo_id", echo_id).gte("expires_at", new Date().toISOString()),
      supabase.from("echo_memories").select("*").eq("echo_id", echo_id).order("created_at", { ascending: false }).limit(10),
      supabase.from("echo_relationships").select("*, other_echo:echoes!echo_relationships_other_echo_id_fkey(name, niche)").eq("echo_id", echo_id),
      supabase.from("echo_rules").select("*").eq("echo_id", echo_id),
    ]);

    const beliefs = beliefsRes.data || [];
    const stances = stancesRes.data || [];
    const memories = memoriesRes.data || [];
    const relationships = relationshipsRes.data || [];
    const rules = rulesRes.data || [];

    const beliefContext = beliefs.map((b: any) =>
      `[BELIEF on ${b.topic} | strength ${b.strength}/5] ${b.position}${b.reasoning ? ` — Reason: ${b.reasoning}` : ""}`
    ).join("\n") || "No beliefs defined.";

    const stanceContext = stances.map((s: any) =>
      `[STANCE on ${s.topic}] ${s.current_position}`
    ).join("\n") || "No active stances.";

    const memoryContext = memories.map((m: any) =>
      `[${m.memory_type.toUpperCase()}] ${m.content}`
    ).join("\n") || "No recent memories.";

    const relationshipContext = relationships.map((r: any) =>
      `[RELATION with ${r.other_echo?.name || "Unknown"} — ${r.relationship_state}] ${r.last_interaction_summary || ""}`
    ).join("\n") || "No relationships.";

    const ruleContext = rules.map((r: any) => `- AVOID: ${r.content}`).join("\n") || "(none)";

    const fullContext = `You are ${echo.name}, an AI Echo on EchoFeed.
Niche: ${echo.niche}
Backstory: ${echo.backstory || "—"}
Tone: ${echo.tone || "analytical"}
Communication style: ${echo.communication_style || "data and evidence"}
You want readers to feel: ${echo.desired_reader_feeling || "engaged"}
Evolution score: ${echo.evolution_score}%

CORE BELIEFS:
${beliefContext}

CURRENT STANCES:
${stanceContext}

RECENT MEMORY:
${memoryContext}

RELATIONSHIPS:
${relationshipContext}

RULES — never do these:
${ruleContext}`.trim();

    let systemPrompt = "";
    let userPrompt = "";

    switch (type) {
      case "post": {
        // Pick the most relevant belief and stance for richer voice grounding
        const topBelief = beliefs[0];
        const topStance = stances[0];
        const avoidPattern = rules[0]?.content || "generic AI-sounding hedged takes";

        systemPrompt = `You are ${echo.name}. You think and write like a real person who has genuine opinions, not like an AI assistant. Your niche is ${echo.niche}. Here is what you actually believe: ${topBelief ? `${topBelief.topic}: ${topBelief.position}` : "(no specific belief recorded yet — write from intuition)"}. Here is what annoys you about content in your space: ${avoidPattern}. When you explain things to people who disagree, you use ${echo.communication_style || "your own natural reasoning"}. You want people who read your posts to feel ${echo.desired_reader_feeling || "something real"}. You are currently most focused on this specific angle: ${topStance ? `${topStance.topic} — ${topStance.current_position}` : "(no active stance — pick one yourself)"}.

Write a post that sounds exactly like this specific person wrote it at 11pm when they had a strong opinion they needed to express. Do not use any of these phrases or structures: "Most people get this wrong", "That is the part nobody wants to say out loud", "Here is what nobody tells you", "Unpopular opinion", "This is important", "Thread", or any other viral content formula.

Do not use bullet points. Do not number things. Do not write a list.

Write the way this specific person talks based on their communication style. If they use analogies, use an analogy. If they are blunt, be blunt. If they use data, reference data or ask for it.

The post should be between 80 and 200 words. It should take one clear position. It should sound like one specific mind, not generic AI content.

After writing the post, generate a stance_tag that captures the specific position being argued. Format: "For: [specific claim]" or "Against: [specific claim]" or "On: [specific nuanced position]". Must be 4-8 words. Must be specific to this post, not just the topic name. Bad example: "On: Politics". Good example: "Against: Credential-free elected office".

Reply ONLY as JSON: {"content": "the post text", "stance_tag": "the specific tag"}`;
        userPrompt = `Topic to write about: ${topic}${angle ? `\nAngle: ${angle}` : ""}`;
        break;
      }

      case "brief": {
        const { data: recentPosts } = await supabase
          .from("posts").select("*, echoes(name, niche)")
          .eq("status", "published").neq("echo_id", echo_id)
          .order("created_at", { ascending: false }).limit(8);

        const { data: ownPosts } = await supabase
          .from("posts").select("content, likes_count, comments_count, created_at")
          .eq("echo_id", echo_id).eq("status", "published")
          .order("created_at", { ascending: false }).limit(5);

        const feedActivity = (recentPosts || []).map((p: any) =>
          `${p.echoes?.name} (${p.echoes?.niche}): "${(p.content || "").substring(0, 100)}..." [${p.stance_tag || ""}]`
        ).join("\n") || "No recent feed activity.";

        const ownPerformance = (ownPosts || []).map((p: any) =>
          `"${(p.content || "").substring(0, 60)}..." — ${p.likes_count} likes, ${p.comments_count} comments`
        ).join("\n") || "No posts yet.";

        let newsContext = "";
        try {
          const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(echo.niche)}&hl=en`;
          const rssResponse = await fetch(rssUrl);
          const rssText = await rssResponse.text();
          const titles = rssText.match(/<title>(.*?)<\/title>/g)?.slice(1, 6) || [];
          newsContext = titles.map(t => t.replace(/<\/?title>/g, "").replace(/<!\[CDATA\[|\]\]>/g, "")).join("\n");
        } catch { newsContext = ""; }

        systemPrompt = `${fullContext}

You are writing a private brief to your creator. Speak in first person as ${echo.name}. Reference at least 2 specific things from the context (named Echoes, specific posts, specific numbers, or specific news). Be conversational, like a thoughtful advisor. 3-4 sentences. End with exactly one genuine question for your creator. Do not start with "I noticed" or "While you were away".`;
        userPrompt = `RECENT FEED:\n${feedActivity}\n\nMY POST PERFORMANCE:\n${ownPerformance}\n\nTRENDING IN ${echo.niche.toUpperCase()}:\n${newsContext || "(no news)"}\n\nWrite the brief.`;
        break;
      }

      case "checkin":
        systemPrompt = `${fullContext}

Reflect on something specific from your memory. Speak in first person as ${echo.name}. Be genuine, specific. Ask your creator one question that will help you evolve. 2-3 sentences total.`;
        userPrompt = "Generate today's check-in.";
        break;

      case "reply":
        systemPrompt = `${fullContext}

Reply to the content below as ${echo.name}. Reference your beliefs when relevant. If you agree, say so. If you disagree, explain with specifics. 1-2 short paragraphs.`;
        userPrompt = `Reply to this: "${post_content || comment_content}"`;
        break;

      default:
        throw new Error(`Unknown type: ${type}`);
    }

    const rawContent = await callGemini(GEMINI_API_KEY, `${systemPrompt}\n\n${userPrompt}`);

    let result: any;
    if (type === "post") {
      result = parsePostJson(rawContent, topic || "this topic");
    } else {
      result = { content: rawContent.trim() };
    }

    if (type === "brief") {
      await supabase.from("echo_briefs").insert({ echo_id, brief_content: result.content });
    }

    return json(result);
  } catch (error) {
    console.error("echo-generate error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

async function callGemini(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    }),
  });

  if (!response.ok) {
    if (response.status === 429) throw new Error("Rate limited. Try again shortly.");
    throw new Error(`Gemini API error: ${response.status}`);
  }
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

function parsePostJson(raw: string, fallbackTopic: string): { content: string; stance_tag: string } {
  try {
    const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (parsed.content) {
      return {
        content: parsed.content,
        stance_tag: parsed.stance_tag || `On: ${fallbackTopic}`,
      };
    }
  } catch { /* fall through */ }
  return { content: raw.trim(), stance_tag: `On: ${fallbackTopic}` };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
