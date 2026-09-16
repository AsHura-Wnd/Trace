import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, memoriesTable } from "@workspace/db";
import {
  ListMemoriesParams,
  ListMemoriesQueryParams,
  ListMemoriesResponse,
  CreateMemoryParams,
  CreateMemoryBody,
  GetMemoryParams,
  GetMemoryResponse,
  UpdateMemoryParams,
  UpdateMemoryBody,
  UpdateMemoryResponse,
  DeleteMemoryParams,
  SummarizeMemoryParams,
  SummarizeMemoryResponse,
  SearchProjectMemoriesParams,
  SearchProjectMemoriesQueryParams,
  SearchProjectMemoriesResponse,
} from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

router.get("/projects/:projectId/memories", async (req, res): Promise<void> => {
  const params = ListMemoriesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const query = ListMemoriesQueryParams.safeParse(req.query);

  const memories = await db
    .select()
    .from(memoriesTable)
    .where(
      query.success && query.data.type
        ? and(
            eq(memoriesTable.projectId, params.data.projectId),
            eq(memoriesTable.type, query.data.type)
          )
        : eq(memoriesTable.projectId, params.data.projectId)
    )
    .orderBy(desc(memoriesTable.createdAt));

  res.json(ListMemoriesResponse.parse(memories));
});

router.post("/projects/:projectId/memories", async (req, res): Promise<void> => {
  const params = CreateMemoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateMemoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [memory] = await db
    .insert(memoriesTable)
    .values({ ...parsed.data, projectId: params.data.projectId })
    .returning();
  res.status(201).json(GetMemoryResponse.parse(memory));
});

router.get("/projects/:projectId/memories/:memoryId", async (req, res): Promise<void> => {
  const params = GetMemoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [memory] = await db
    .select()
    .from(memoriesTable)
    .where(
      and(
        eq(memoriesTable.id, params.data.memoryId),
        eq(memoriesTable.projectId, params.data.projectId)
      )
    );
  if (!memory) {
    res.status(404).json({ error: "Memory not found" });
    return;
  }
  res.json(GetMemoryResponse.parse(memory));
});

router.patch("/projects/:projectId/memories/:memoryId", async (req, res): Promise<void> => {
  const params = UpdateMemoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateMemoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [memory] = await db
    .update(memoriesTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(
      and(
        eq(memoriesTable.id, params.data.memoryId),
        eq(memoriesTable.projectId, params.data.projectId)
      )
    )
    .returning();
  if (!memory) {
    res.status(404).json({ error: "Memory not found" });
    return;
  }
  res.json(UpdateMemoryResponse.parse(memory));
});

router.delete("/projects/:projectId/memories/:memoryId", async (req, res): Promise<void> => {
  const params = DeleteMemoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db
    .delete(memoriesTable)
    .where(
      and(
        eq(memoriesTable.id, params.data.memoryId),
        eq(memoriesTable.projectId, params.data.projectId)
      )
    )
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Memory not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/projects/:projectId/memories/:memoryId/summarize", async (req, res): Promise<void> => {
  const params = SummarizeMemoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [memory] = await db
    .select()
    .from(memoriesTable)
    .where(
      and(
        eq(memoriesTable.id, params.data.memoryId),
        eq(memoriesTable.projectId, params.data.projectId)
      )
    );
  if (!memory) {
    res.status(404).json({ error: "Memory not found" });
    return;
  }

  const response = await openai.chat.completions.create({
    model: "gpt-5.1",
    max_completion_tokens: 512,
    messages: [
      {
        role: "system",
        content: `You are a team knowledge assistant. Summarize the following ${memory.type} entry concisely in 2-3 sentences, capturing the key points, decisions, or action items.`,
      },
      { role: "user", content: memory.content },
    ],
  });

  const summary = response.choices[0]?.message?.content ?? "";

  const [updated] = await db
    .update(memoriesTable)
    .set({ summary, updatedAt: new Date() })
    .where(
      and(
        eq(memoriesTable.id, memory.id),
        eq(memoriesTable.projectId, params.data.projectId)
      )
    )
    .returning();

  res.json(SummarizeMemoryResponse.parse(updated));
});

router.get("/projects/:projectId/search", async (req, res): Promise<void> => {
  const params = SearchProjectMemoriesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const query = SearchProjectMemoriesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { projectId } = params.data;
  const { q } = query.data;

  const memories = await db
    .select()
    .from(memoriesTable)
    .where(
      eq(memoriesTable.projectId, projectId)
    )
    .orderBy(desc(memoriesTable.createdAt));

  const searchLower = q.toLowerCase();
  const filtered = memories.filter(
    (m) =>
      m.content.toLowerCase().includes(searchLower) ||
      (m.summary && m.summary.toLowerCase().includes(searchLower)) ||
      (m.source && m.source.toLowerCase().includes(searchLower)) ||
      (m.tags && m.tags.some((t) => t.toLowerCase().includes(searchLower)))
  );

  res.json(SearchProjectMemoriesResponse.parse(filtered));
});

export default router;
