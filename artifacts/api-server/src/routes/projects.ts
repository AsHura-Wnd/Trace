import { Router, type IRouter } from "express";
import { eq, desc, count, sql } from "drizzle-orm";
import { db, projectsTable, memoriesTable, tasksTable } from "@workspace/db";
import {
  ListProjectsResponse,
  CreateProjectBody,
  GetProjectParams,
  GetProjectResponse,
  UpdateProjectParams,
  UpdateProjectBody,
  UpdateProjectResponse,
  DeleteProjectParams,
  GetProjectStatsParams,
  GetProjectStatsResponse,
  GetProjectActivityParams,
  GetProjectActivityResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/projects", async (req, res): Promise<void> => {
  const projects = await db.select().from(projectsTable).orderBy(desc(projectsTable.createdAt));
  res.json(ListProjectsResponse.parse(projects));
});

router.post("/projects", async (req, res): Promise<void> => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [project] = await db.insert(projectsTable).values(parsed.data).returning();
  res.status(201).json(GetProjectResponse.parse(project));
});

router.get("/projects/:projectId", async (req, res): Promise<void> => {
  const params = GetProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, params.data.projectId));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(GetProjectResponse.parse(project));
});

router.patch("/projects/:projectId", async (req, res): Promise<void> => {
  const params = UpdateProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [project] = await db
    .update(projectsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(projectsTable.id, params.data.projectId))
    .returning();
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(UpdateProjectResponse.parse(project));
});

router.delete("/projects/:projectId", async (req, res): Promise<void> => {
  const params = DeleteProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db.delete(projectsTable).where(eq(projectsTable.id, params.data.projectId)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/projects/:projectId/stats", async (req, res): Promise<void> => {
  const params = GetProjectStatsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { projectId } = params.data;

  const [memoryCounts] = await db
    .select({ total: count() })
    .from(memoriesTable)
    .where(eq(memoriesTable.projectId, projectId));

  const typeRows = await db
    .select({ type: memoriesTable.type, cnt: count() })
    .from(memoriesTable)
    .where(eq(memoriesTable.projectId, projectId))
    .groupBy(memoriesTable.type);

  const memoriesByType: Record<string, number> = {};
  for (const row of typeRows) {
    memoriesByType[row.type] = Number(row.cnt);
  }

  const [taskCounts] = await db
    .select({ total: count() })
    .from(tasksTable)
    .where(eq(tasksTable.projectId, projectId));

  const [openTaskCounts] = await db
    .select({ total: count() })
    .from(tasksTable)
    .where(sql`${tasksTable.projectId} = ${projectId} AND ${tasksTable.status} = 'open'`);

  const [doneTaskCounts] = await db
    .select({ total: count() })
    .from(tasksTable)
    .where(sql`${tasksTable.projectId} = ${projectId} AND ${tasksTable.status} = 'done'`);

  const stats = {
    totalMemories: Number(memoryCounts?.total ?? 0),
    totalTasks: Number(taskCounts?.total ?? 0),
    openTasks: Number(openTaskCounts?.total ?? 0),
    completedTasks: Number(doneTaskCounts?.total ?? 0),
    memoriesByType,
    recentDecisions: memoriesByType["decision"] ?? 0,
  };

  res.json(GetProjectStatsResponse.parse(stats));
});

router.get("/projects/:projectId/activity", async (req, res): Promise<void> => {
  const params = GetProjectActivityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const memories = await db
    .select()
    .from(memoriesTable)
    .where(eq(memoriesTable.projectId, params.data.projectId))
    .orderBy(desc(memoriesTable.createdAt))
    .limit(20);

  res.json(GetProjectActivityResponse.parse(memories));
});

export default router;
