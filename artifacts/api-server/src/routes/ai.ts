import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, memoriesTable } from "@workspace/db";
import {
  AskProjectQuestionParams,
  AskProjectQuestionBody,
  AskProjectQuestionResponse,
  GetProjectInsightsParams,
  GetProjectInsightsResponse,
} from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

router.post("/projects/:projectId/ask", async (req, res): Promise<void> => {
  const params = AskProjectQuestionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = AskProjectQuestionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const memories = await db
    .select()
    .from(memoriesTable)
    .where(eq(memoriesTable.projectId, params.data.projectId))
    .orderBy(desc(memoriesTable.createdAt))
    .limit(50);

  if (memories.length === 0) {
    res.json(
      AskProjectQuestionResponse.parse({
        answer: "No project memories found. Add some discussions, decisions, or notes first.",
        relevantMemories: [],
      })
    );
    return;
  }

  const memoryContext = memories
    .map(
      (m, i) =>
        `[Memory ${m.id}] Type: ${m.type} | Created: ${m.createdAt.toISOString().split("T")[0]}\n${m.summary || m.content}`
    )
    .join("\n\n---\n\n");

  const response = await openai.chat.completions.create({
    model: "gpt-5.1",
    max_completion_tokens: 1024,
    messages: [
      {
        role: "system",
        content: `You are an intelligent assistant with access to a team's project memory. Answer questions based on the provided context. Be concise, direct, and reference specific memory entries when relevant. Format: answer the question, then list relevant memory IDs as a comma-separated list on a new line prefixed with "RELEVANT_IDS:" (e.g. "RELEVANT_IDS: 1, 3, 7"). If no specific memories are relevant, omit the RELEVANT_IDS line.`,
      },
      {
        role: "user",
        content: `Project memories:\n\n${memoryContext}\n\nQuestion: ${parsed.data.question}`,
      },
    ],
  });

  const fullText = response.choices[0]?.message?.content ?? "";
  const lines = fullText.split("\n");
  const idsLine = lines.find((l) => l.startsWith("RELEVANT_IDS:"));
  const answer = lines.filter((l) => !l.startsWith("RELEVANT_IDS:")).join("\n").trim();
  
  let relevantMemories: number[] = [];
  if (idsLine) {
    relevantMemories = idsLine
      .replace("RELEVANT_IDS:", "")
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));
  }

  res.json(AskProjectQuestionResponse.parse({ answer, relevantMemories }));
});

router.get("/projects/:projectId/insights", async (req, res): Promise<void> => {
  const params = GetProjectInsightsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const memories = await db
    .select()
    .from(memoriesTable)
    .where(eq(memoriesTable.projectId, params.data.projectId))
    .orderBy(desc(memoriesTable.createdAt))
    .limit(60);

  if (memories.length === 0) {
    res.json(
      GetProjectInsightsResponse.parse({
        summary: "No memories found for this project yet. Add discussions, decisions, and notes to generate insights.",
        keyDecisions: [],
        actionItems: [],
        risks: [],
      })
    );
    return;
  }

  const memoryContext = memories
    .map((m) => `[${m.type.toUpperCase()}] ${m.summary || m.content}`)
    .join("\n");

  const response = await openai.chat.completions.create({
    model: "gpt-5.1",
    max_completion_tokens: 2048,
    messages: [
      {
        role: "system",
        content: `You are a project intelligence analyst. Analyze the team's project memories and return a JSON object with:
- summary: string (2-3 sentence project overview)
- keyDecisions: string[] (up to 5 most important decisions made)
- actionItems: string[] (up to 5 pending actions or next steps)
- risks: string[] (up to 3 identified risks or blockers)
Return ONLY valid JSON, no markdown.`,
      },
      {
        role: "user",
        content: `Project memories:\n${memoryContext}\n\nGenerate project insights.`,
      },
    ],
  });

  const rawText = response.choices[0]?.message?.content ?? "{}";
  let insights = { summary: "", keyDecisions: [], actionItems: [], risks: [] };
  try {
    insights = JSON.parse(rawText);
  } catch {
    insights = {
      summary: rawText.substring(0, 200),
      keyDecisions: [],
      actionItems: [],
      risks: [],
    };
  }

  res.json(GetProjectInsightsResponse.parse(insights));
});

export default router;
