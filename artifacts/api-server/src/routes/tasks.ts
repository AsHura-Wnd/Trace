import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";
import { db, tasksTable, memoriesTable } from "@workspace/db";
import {
  ListTasksParams,
  ListTasksQueryParams,
  ListTasksResponse,
  CreateTaskParams,
  CreateTaskBody,
  UpdateTaskParams,
  UpdateTaskBody,
  UpdateTaskResponse,
  DeleteTaskParams,
  ExtractTasksFromMemoryParams,
  ExtractTasksFromMemoryBody,
  ExtractTasksFromMemoryResponse,
} from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

const extractedTaskItemSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  assignee: z.string().trim().nullable().optional(),
});
const extractedTasksSchema = z.array(extractedTaskItemSchema);

function cleanJsonString(raw: string): string {
  const trimmed = raw.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fencedMatch ? fencedMatch[1].trim() : trimmed;
}

router.get("/projects/:projectId/tasks", async (req, res): Promise<void> => {
  const params = ListTasksParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const query = ListTasksQueryParams.safeParse(req.query);

  const tasks = await db
    .select()
    .from(tasksTable)
    .where(
      query.success && query.data.status
        ? and(
            eq(tasksTable.projectId, params.data.projectId),
            eq(tasksTable.status, query.data.status)
          )
        : eq(tasksTable.projectId, params.data.projectId)
    )
    .orderBy(desc(tasksTable.createdAt));

  res.json(ListTasksResponse.parse(tasks));
});

router.post("/projects/:projectId/tasks", async (req, res): Promise<void> => {
  const params = CreateTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [task] = await db
    .insert(tasksTable)
    .values({ ...parsed.data, projectId: params.data.projectId })
    .returning();
  res.status(201).json(UpdateTaskResponse.parse(task));
});

router.patch("/projects/:projectId/tasks/:taskId", async (req, res): Promise<void> => {
  const params = UpdateTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [task] = await db
    .update(tasksTable)
    .set(parsed.data)
    .where(
      and(
        eq(tasksTable.id, params.data.taskId),
        eq(tasksTable.projectId, params.data.projectId)
      )
    )
    .returning();
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.json(UpdateTaskResponse.parse(task));
});

router.delete("/projects/:projectId/tasks/:taskId", async (req, res): Promise<void> => {
  const params = DeleteTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db
    .delete(tasksTable)
    .where(
      and(
        eq(tasksTable.id, params.data.taskId),
        eq(tasksTable.projectId, params.data.projectId)
      )
    )
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/projects/:projectId/extract-tasks", async (req, res): Promise<void> => {
  const params = ExtractTasksFromMemoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = ExtractTasksFromMemoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [memory] = await db
    .select()
    .from(memoriesTable)
    .where(
      and(
        eq(memoriesTable.id, parsed.data.memoryId),
        eq(memoriesTable.projectId, params.data.projectId)
      )
    );
  if (!memory) {
    res.status(404).json({ error: "Memory not found" });
    return;
  }

  const response = await openai.chat.completions.create({
    model: "gpt-5.1",
    max_completion_tokens: 1024,
    messages: [
      {
        role: "system",
        content: `You are a task extraction assistant. Given a team discussion or note, extract all action items and tasks as a JSON array. Each task should have: title (string, concise action), assignee (string or null if not mentioned).
Return ONLY valid JSON array, no markdown. Example: [{"title":"Set up CI pipeline","assignee":"Alex"},{"title":"Review PR #42","assignee":null}]`,
      },
      { role: "user", content: memory.content },
    ],
  });

  const rawText = response.choices[0]?.message?.content ?? "[]";
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(cleanJsonString(rawText));
  } catch {
    res.status(502).json({ error: "Failed to parse AI response as valid JSON" });
    return;
  }

  const validated = extractedTasksSchema.safeParse(parsedJson);
  if (!validated.success) {
    res.status(502).json({
      error: "AI response did not match expected task structure",
      details: validated.error.issues,
    });
    return;
  }

  const extracted = validated.data;
  if (extracted.length === 0) {
    res.json([]);
    return;
  }

  const tasks = await db
    .insert(tasksTable)
    .values(
      extracted.map((t) => ({
        projectId: params.data.projectId,
        memoryId: memory.id,
        title: t.title,
        assignee: t.assignee ?? null,
        status: "open",
      }))
    )
    .returning();

  res.json(ExtractTasksFromMemoryResponse.parse(tasks));
});

export default router;
