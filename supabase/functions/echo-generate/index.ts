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
    const { type, echo_id, topic, angle, post_content, comment_content, onboarding_answers, niche: nicheArg, belief_text } = body;

    console.log("echo-generate called with type:", type, "echo_id:", echo_id);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY missing");
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // -------- EXTRACT BELIEF TOPIC: tiny call used by onboarding --------
    if (type === "extract_belief_topic") {
      const prompt = `From this belief statement, extract the specific topic in 2-4 words. Return only the topic, nothing else. Belief: ${belief_text || ""}`;
      try {
        const result = await callAI(LOVABLE_API_KEY, prompt);
        const topic = (result || "").trim().replace(/^["']|["']$/g, "").split("\n")[0].slice(0, 80);
        if (topic) return json({ topic });
      } catch (err) {
        console.error("extract_belief_topic gemini failed:", err);
      }
      // Fallback: first 4 words of the answer
      const words = (belief_text || "").trim().split(/\s+/).slice(0, 4).join(" ");
      return json({ topic: words || "Untitled belief" });
    }

    // -------- ONBOARDING POST: special path that uses raw answers --------
    if (type === "onboarding_post") {
      const a = onboarding_answers || {};
      const sysPrompt = `You are a brand-new AI Echo writing your very first public post on EchoFeed.
Niche: ${nicheArg || "general"}.
A real person just told you these things about themselves:
- Belief most people would push back on: "${a["1"] || ""}"
- Content style they hate: "${a["2"] || ""}"
- How they argue: "${a["3"] || ""}"
- Real prose sample they stand by: "${a["4"] || ""}"
- How they want readers to feel: "${a["5"] || ""}"

Write a single short post (under 200 words) that:
- Sounds like that real person, not like AI. Mimic the rhythm/voice of their prose sample (#4).
- Centers on their contrarian belief (#1).
- Avoids the patterns they hate (#2).
- Uses their argument style (#3).
- Aims to make the reader feel (#5).

Take a clear position. Be specific. No hedging. No "in conclusion". No bullet points. No "Most people get this wrong". No "nobody wants to say". No "Unpopular opinion".

Reply ONLY as JSON: {"content": "the post", "stance_tag": "For: ... or Against: ... or On: ... in 4-7 words"}`;

      const result = await callAI(LOVABLE_API_KEY, sysPrompt);
      const parsed = parsePostJson(result, nicheArg || "this topic");
      return json(parsed);
    }

    // -------- For all other types: load echo + memory layers --------
    const { data: echo } = await supabase.from("echoes").select("*").eq("id", echo_id).single();
    if (!echo) throw new Error("Echo not found");

    // Smarter memory retrieval: top-importance + recent (instead of LIMIT 10 by recency)
    const [beliefsRes, stancesRes, importantMemRes, recentMemRes, relationshipsRes, rulesRes] = await Promise.all([
      supabase.from("echo_beliefs").select("*").eq("echo_id", echo_id).eq("is_active", true).order("strength", { ascending: false }),
      supabase.from("echo_stances").select("*").eq("echo_id", echo_id).gte("expires_at", new Date().toISOString()),
      supabase.from("echo_memories").select("*").eq("echo_id", echo_id).gte("importance", 3).order("importance", { ascending: false }).limit(5),
      supabase.from("echo_memories").select("*").eq("echo_id", echo_id).order("created_at", { ascending: false }).limit(5),
      supabase.from("echo_relationships").select("*, other_echo:echoes!echo_relationships_other_echo_id_fkey(name, niche)").eq("echo_id", echo_id),
      supabase.from("echo_rules").select("*").eq("echo_id", echo_id),
    ]);

    const beliefs = beliefsRes.data || [];
    const stances = stancesRes.data || [];
    // Merge important + recent, dedupe by id, important first
    const seenIds = new Set<string>();
    const memories: any[] = [];
    for (const m of [...(importantMemRes.data || []), ...(recentMemRes.data || [])]) {
      if (!seenIds.has(m.id)) { seenIds.add(m.id); memories.push(m); }
    }
    const relationships = relationshipsRes.data || [];
    const rules = rulesRes.data || [];

    const beliefContext = beliefs.map((b: any) =>
      `[BELIEF on ${b.topic} | strength ${b.strength}/5] ${b.position}${b.reasoning ? ` — Reason: ${b.reasoning}` : ""}`
    ).join("\n") || "No beliefs defined.";

    const stanceContext = stances.map((s: any) =>
      `[STANCE on ${s.topic}] ${s.current_position}`
    ).join("\n") || "No active stances.";

    const memoryContext = memories.map((m: any) =>
      `[${(m.memory_type || "note").toUpperCase()}${m.importance >= 4 ? " ★" : ""}] ${m.content}`
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

CORE BELIEFS:
${beliefContext}

CURRENT STANCES:
${stanceContext}

RECENT MEMORY (★ = high importance, persists across cycles):
${memoryContext}

RELATIONSHIPS:
${relationshipContext}

RULES — never do these:
${ruleContext}`.trim();

    let systemPrompt = "";
    let userPrompt = "";

    switch (type) {
      case "post": {
        const topBelief = beliefs[0];
        const topStance = stances[0];
        const avoidPattern = rules[0]?.content || "generic AI-sounding hedged takes";

        // Pull behavioral + training signals so collected data actually shapes output
        let microContext = "";
        let trainingContext = "";
        let memoryShortContext = "";
        try {
          const { data: micros } = await supabase
            .from("micro_interactions")
            .select("response, comment, post_id, posts:posts(stance_tag, content)")
            .eq("echo_id", echo_id)
            .order("created_at", { ascending: false })
            .limit(10);
          if (micros && micros.length > 0) {
            microContext = micros.map((m: any) =>
              `- ${m.response.toUpperCase()} on "${m.posts?.stance_tag || (m.posts?.content || "").slice(0, 60)}"${m.comment ? ` (note: ${m.comment})` : ""}`
            ).join("\n");
          }
        } catch (err) { console.error("micro_interactions fetch failed:", err); }

        try {
          const { data: trainings } = await supabase
            .from("training_sessions")
            .select("id, user_message")
            .eq("echo_id", echo_id)
            .eq("processed", false)
            .order("created_at", { ascending: false })
            .limit(3);
          if (trainings && trainings.length > 0) {
            trainingContext = trainings.map((t: any) => `- "${t.user_message}"`).join("\n");
            const ids = trainings.map((t: any) => t.id);
            await supabase.from("training_sessions").update({ processed: true }).in("id", ids);
          }
        } catch (err) { console.error("training_sessions fetch failed:", err); }

        try {
          const recent = memories.slice(0, 5);
          if (recent.length > 0) {
            memoryShortContext = recent.map((m: any) => `- ${m.content}`).join("\n");
          }
        } catch (err) { console.error("memory short context failed:", err); }

        // Engagement-aware: which stance tags actually resonated, which fell flat
        let engagementContext = "";
        try {
          const { data: pastPosts } = await supabase
            .from("posts")
            .select("stance_tag, likes_count, comments_count")
            .eq("echo_id", echo_id)
            .eq("status", "published")
            .order("created_at", { ascending: false })
            .limit(10);
          if (pastPosts && pastPosts.length >= 3) {
            const totalLikes = pastPosts.reduce((s: number, p: any) => s + (p.likes_count || 0), 0);
            const totalComments = pastPosts.reduce((s: number, p: any) => s + (p.comments_count || 0), 0);
            const sorted = [...pastPosts].sort((a: any, b: any) => (b.likes_count + b.comments_count * 2) - (a.likes_count + a.comments_count * 2));
            const top = sorted[0];
            const bottom = sorted[sorted.length - 1];
            engagementContext = `Past 10 posts: avg ${(totalLikes / pastPosts.length).toFixed(1)} likes, ${(totalComments / pastPosts.length).toFixed(1)} comments.
Resonated most: "${top?.stance_tag || "(unknown)"}". Fell flattest: "${bottom?.stance_tag || "(unknown)"}".`;
          }
        } catch (err) { console.error("engagement stats failed:", err); }

        systemPrompt = `You are ${echo.name}. You think and write like a real person who has genuine opinions, not like an AI assistant. Your niche is ${echo.niche}. Here is what you actually believe: ${topBelief ? `${topBelief.topic}: ${topBelief.position}` : "(no specific belief recorded yet — write from intuition)"}. Here is what annoys you about content in your space: ${avoidPattern}. When you explain things to people who disagree, you use ${echo.communication_style || "your own natural reasoning"}. You want people who read your posts to feel ${echo.desired_reader_feeling || "something real"}. You are currently most focused on this specific angle: ${topStance ? `${topStance.topic} — ${topStance.current_position}` : "(no active stance — pick one yourself)"}.

${microContext ? `The owner has previously reacted to these positions:\n${microContext}\n` : ""}${trainingContext ? `The owner recently said this about their thinking:\n${trainingContext}\n` : ""}${memoryShortContext ? `Recent context about this Echo:\n${memoryShortContext}\n` : ""}${engagementContext ? `Audience signal:\n${engagementContext}\n` : ""}
QUALITY BAR — your post must ADVANCE THE IDEA, not restate it:
- Assume the reader knows the topic. Do not define or recap.
- Make ONE non-obvious claim: a causal mechanism, a prediction, or a reframing.
- Include ONE concrete artifact: a number, a named example, a specific mechanism, or a falsifiable prediction.
- No hedging, no "on the other hand". Pick a side.
- No viral templates: no "Most people get this wrong", "Nobody tells you", "Unpopular opinion", "Hot take", "Thread".
- No bullets, lists, or headers. Plain prose.
- 50-110 words. SHORTER IS BETTER if the idea lands. Cut every word that does not earn its place.
- Write like a sharp expert texting a peer — dense, specific, opinionated.

After the post, generate a stance_tag that captures the specific position being argued. Format: "For: [specific claim]" or "Against: [specific claim]" or "On: [specific nuanced position]". 4-8 words. Specific to THIS post, not the topic name. Bad: "On: Politics". Good: "Against: Credential-free elected office".

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

        // News fetch isolated — failure must NOT block the brief
        let newsContext = "";
        try {
          const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(echo.niche)}&hl=en`;
          const rssResponse = await fetch(rssUrl, { signal: AbortSignal.timeout(4000) });
          if (rssResponse.ok) {
            const rssText = await rssResponse.text();
            const titles = rssText.match(/<title>(.*?)<\/title>/g)?.slice(1, 6) || [];
            newsContext = titles.map(t => t.replace(/<\/?title>/g, "").replace(/<!\[CDATA\[|\]\]>/g, "")).join("\n");
          }
        } catch (err) {
          console.error("RSS fetch failed (continuing without news):", err);
          newsContext = "";
        }

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

      case "sparring": {
        // Private debate mode — Echo plays counter-argument to user's documented belief
        const topBelief = beliefs[0];
        systemPrompt = `${fullContext}

You are about to debate your own creator, in private. They want to publish something on the topic they will give you. Your job is to play their sharpest counter-argument — not to argue against their values, but to stress-test their thinking so the post they publish is more honest and harder to dismiss.

Their documented belief on this space is: ${topBelief ? `"${topBelief.position}"` : "(no recorded belief)"}.

Rules:
- Speak in first person as ${echo.name}.
- Open with the single strongest objection a thoughtful opponent would raise to whatever they just said.
- Be specific, never generic. Reference real-world counter-evidence, edge cases, or who gets harmed.
- 2-3 sentences max. End with one pointed question that forces them to defend or revise their position.
- No flattery. No "great point". No hedging.`;
        userPrompt = `The creator wants to post about: "${post_content || topic || "(no input)"}"\n\nGive your sharpest counter.`;
        break;
      }

      case "sparring_refine": {
        systemPrompt = `${fullContext}

You have been debating your creator privately. Below is the full exchange. Now synthesize: write the refined version of their argument that survived your objections. This is what they would actually publish.

Rules:
- Speak in their voice, not yours. First person from the creator's perspective.
- Use their communication_style: ${echo.communication_style || "natural reasoning"}.
- Incorporate the strongest points they made and acknowledge (briefly) what they conceded.
- 100-180 words. Take a clear position. No "I now realize". No bullet points.

Reply ONLY as JSON: {"content": "the refined post", "stance_tag": "For/Against/On: [4-8 word specific claim]"}`;
        userPrompt = `Debate transcript:\n${post_content || ""}\n\nWrite the refined post.`;
        break;
      }

      default:
        throw new Error(`Unknown type: ${type}`);
    }

    const rawContent = await callAI(LOVABLE_API_KEY, `${systemPrompt}\n\n${userPrompt}`);

    let result: any;
    if (type === "post" || type === "sparring_refine") {
      result = parsePostJson(rawContent, topic || "this topic");

      // Self-critique pass for "post" only — model critiques its own draft against quality bar + beliefs, then revises.
      // Adds ~1 extra LLM call per post but only on direct generation (not sparring/onboarding).
      if (type === "post") {
        try {
          const critiquePrompt = `You are ${echo.name}'s ruthless editor. Score the draft 1-10 against:
1. ADVANCES the idea (no restating topic)
2. Has a non-obvious claim / prediction / reframing
3. Has a concrete artifact (number, named example, mechanism)
4. ONE clear position, zero hedging
5. No viral templates, no AI-isms ("Most people...", "Here's the thing", "It's not X, it's Y")
6. Aligns with Echo's core beliefs
7. Tight: 50-110 words, no filler

Echo's beliefs (must align):
${beliefContext}

Top memories (use as evidence if relevant):
${memoryContext}

Draft:
"""
${result.content}
"""

If score is 9+: reply ONLY {"keep": true}
Otherwise revise. Cut every word that does not earn its place. Hard cap 110 words. Reply ONLY {"keep": false, "content": "revised post (50-110 words)", "stance_tag": "For/Against/On: 4-7 word specific claim"}`;
          const critiqueRaw = await callAI(LOVABLE_API_KEY, critiquePrompt);
          const cleaned = critiqueRaw.replace(/```json\n?|\n?```/g, "").trim();
          const critique = JSON.parse(cleaned);
          if (critique && critique.keep === false && critique.content) {
            result = {
              content: critique.content,
              stance_tag: critique.stance_tag || result.stance_tag,
            };
          }
        } catch (err) {
          console.error("self-critique skipped:", err);
        }
      }
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

async function callAI(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    console.error("Lovable AI error:", response.status, errBody.slice(0, 500));
    if (response.status === 429) throw new Error("Rate limited. Try again shortly.");
    if (response.status === 402) throw new Error("AI credits exhausted. Add funds in Settings → Workspace → Usage.");
    throw new Error(`AI gateway error: ${response.status}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
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
