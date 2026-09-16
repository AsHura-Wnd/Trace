import { test, describe, beforeEach, after, before } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";

// Set environment variables before any modules load
process.env.DATABASE_URL = "postgres://mock:mock@localhost:5432/mock";
process.env.AI_INTEGRATIONS_OPENAI_BASE_URL = "https://mock.openai.com/v1";
process.env.AI_INTEGRATIONS_OPENAI_API_KEY = "mock-key";
process.env.PORT = "8080";

import { db, memoriesTable, tasksTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import app from "../src/app.js";

interface MemoryRow {
  id: number;
  projectId: number;
  type: string;
  content: string;
  summary: string | null;
  source: string | null;
  tags: string[] | null;
  createdAt: Date;
  updatedAt: Date;
}

interface TaskRow {
  id: number;
  projectId: number;
  memoryId: number | null;
  title: string;
  assignee: string | null;
  status: string;
  dueDate: Date | null;
  createdAt: Date;
}

let memoriesStore: MemoryRow[] = [];
let tasksStore: TaskRow[] = [];
let nextTaskId = 1000;
let lastOpenAiCall: any = null;
let mockOpenAiContent = "[]";
let insertTasksBatchCalls = 0;

let server: Server;
let baseUrl: string;

// Preserve original drizzle methods to avoid recursive loops when generating SQL
const origSelect = db.select.bind(db);
const origUpdate = db.update.bind(db);
const origDelete = db.delete.bind(db);
const origInsert = db.insert.bind(db);

before(async () => {
  // Override OpenAI chat completions
  openai.chat.completions.create = (async (params: any) => {
    lastOpenAiCall = params;
    return {
      choices: [
        {
          message: {
            content: mockOpenAiContent,
          },
        },
      ],
    };
  }) as any;

  // Mock db.select
  (db as any).select = () => {
    return {
      from: (table: any) => {
        const isMemories = table === memoriesTable;
        const isTasks = table === tasksTable;

        const chain: any = {
          where: (cond: any) => {
            const queryObj = (isMemories
              ? origSelect().from(memoriesTable).where(cond)
              : origSelect().from(tasksTable).where(cond)) as any;
            const { sql, params } = queryObj.toSQL();

            const exec = () => {
              if (isMemories) {
                // Check if query is looking for id + projectId
                if (sql.includes('"memories"."id" = $') && sql.includes('"memories"."project_id" = $')) {
                  const id = params[0];
                  const projectId = params[1];
                  const found = memoriesStore.find((m) => m.id === id && m.projectId === projectId);
                  return found ? [found] : [];
                }
                // Check if query is looking for projectId + type
                if (sql.includes('"memories"."project_id" = $') && sql.includes('"memories"."type" = $')) {
                  const projectId = params[0];
                  const type = params[1];
                  return memoriesStore.filter((m) => m.projectId === projectId && m.type === type);
                }
                // ProjectId only
                if (sql.includes('"memories"."project_id" = $')) {
                  const projectId = params[0];
                  return memoriesStore.filter((m) => m.projectId === projectId);
                }
                return memoriesStore;
              }

              if (isTasks) {
                // Check if query is looking for id + projectId
                if (sql.includes('"tasks"."id" = $') && sql.includes('"tasks"."project_id" = $')) {
                  const id = params[0];
                  const projectId = params[1];
                  const found = tasksStore.find((t) => t.id === id && t.projectId === projectId);
                  return found ? [found] : [];
                }
                // Check if query is looking for projectId + status
                if (sql.includes('"tasks"."status" = $')) {
                  const projectId = params[0];
                  const status = params[1];
                  return tasksStore.filter((t) => t.projectId === projectId && t.status === status);
                }
                // ProjectId only
                if (sql.includes('"tasks"."project_id" = $')) {
                  const projectId = params[0];
                  return tasksStore.filter((t) => t.projectId === projectId);
                }
                return tasksStore;
              }
              return [];
            };

            const subChain: any = {
              orderBy: () => subChain,
              limit: (n: number) => {
                const res = exec();
                return Promise.resolve(res.slice(0, n));
              },
              then: (resolve: any, reject: any) => Promise.resolve(exec()).then(resolve, reject),
            };
            return subChain;
          },
        };
        return chain;
      },
    };
  };

  // Mock db.insert
  (db as any).insert = (table: any) => {
    return {
      values: (vals: any) => {
        const isArray = Array.isArray(vals);
        const items = isArray ? vals : [vals];
        return {
          returning: async () => {
            if (table === tasksTable) {
              insertTasksBatchCalls++;
              const inserted = items.map((item: any) => {
                const newRow: TaskRow = {
                  id: nextTaskId++,
                  projectId: item.projectId,
                  memoryId: item.memoryId ?? null,
                  title: item.title,
                  assignee: item.assignee ?? null,
                  status: item.status ?? "open",
                  dueDate: item.dueDate ?? null,
                  createdAt: new Date(),
                };
                tasksStore.push(newRow);
                return newRow;
              });
              return inserted;
            }
            if (table === memoriesTable) {
              const inserted = items.map((item: any) => {
                const newRow: MemoryRow = {
                  id: 999,
                  projectId: item.projectId,
                  type: item.type,
                  content: item.content,
                  summary: item.summary ?? null,
                  source: item.source ?? null,
                  tags: item.tags ?? null,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                };
                memoriesStore.push(newRow);
                return newRow;
              });
              return inserted;
            }
            return [];
          },
        };
      },
    };
  };

  // Mock db.update
  (db as any).update = (table: any) => {
    return {
      set: (updateData: any) => ({
        where: (cond: any) => {
          const isMemories = table === memoriesTable;
          const queryObj = (isMemories
            ? origUpdate(memoriesTable).set(updateData).where(cond)
            : origUpdate(tasksTable).set(updateData).where(cond)) as any;
          const { sql, params } = queryObj.toSQL();

          return {
            returning: async () => {
              if (isMemories) {
                // Must have id and projectId
                assert.ok(
                  sql.includes('"memories"."id" = $') && sql.includes('"memories"."project_id" = $'),
                  "UPDATE memories query must include BOTH id and project_id in WHERE clause"
                );
                const memoryId = params[params.length - 2];
                const projectId = params[params.length - 1];
                const idx = memoriesStore.findIndex((m) => m.id === memoryId && m.projectId === projectId);
                if (idx === -1) return [];
                memoriesStore[idx] = { ...memoriesStore[idx], ...updateData, updatedAt: new Date() };
                return [memoriesStore[idx]];
              } else {
                // Must have id and projectId
                assert.ok(
                  sql.includes('"tasks"."id" = $') && sql.includes('"tasks"."project_id" = $'),
                  "UPDATE tasks query must include BOTH id and project_id in WHERE clause"
                );
                const taskId = params[params.length - 2];
                const projectId = params[params.length - 1];
                const idx = tasksStore.findIndex((t) => t.id === taskId && t.projectId === projectId);
                if (idx === -1) return [];
                tasksStore[idx] = { ...tasksStore[idx], ...updateData };
                return [tasksStore[idx]];
              }
            },
          };
        },
      }),
    };
  };

  // Mock db.delete
  (db as any).delete = (table: any) => {
    return {
      where: (cond: any) => {
        const isMemories = table === memoriesTable;
        const queryObj = (isMemories
          ? origDelete(memoriesTable).where(cond)
          : origDelete(tasksTable).where(cond)) as any;
        const { sql, params } = queryObj.toSQL();

        return {
          returning: async () => {
            if (isMemories) {
              assert.ok(
                sql.includes('"memories"."id" = $') && sql.includes('"memories"."project_id" = $'),
                "DELETE memories query must include BOTH id and project_id in WHERE clause"
              );
              const memoryId = params[0];
              const projectId = params[1];
              const idx = memoriesStore.findIndex((m) => m.id === memoryId && m.projectId === projectId);
              if (idx === -1) return [];
              const [deleted] = memoriesStore.splice(idx, 1);
              return [deleted];
            } else {
              assert.ok(
                sql.includes('"tasks"."id" = $') && sql.includes('"tasks"."project_id" = $'),
                "DELETE tasks query must include BOTH id and project_id in WHERE clause"
              );
              const taskId = params[0];
              const projectId = params[1];
              const idx = tasksStore.findIndex((t) => t.id === taskId && t.projectId === projectId);
              if (idx === -1) return [];
              const [deleted] = tasksStore.splice(idx, 1);
              return [deleted];
            }
          },
        };
      },
    };
  };

  // Start server on ephemeral port
  server = app.listen(0);
  const addr = server.address() as any;
  baseUrl = `http://localhost:${addr.port}/api`;
});

after(() => {
  if (server) server.close();
});

beforeEach(() => {
  insertTasksBatchCalls = 0;
  lastOpenAiCall = null;
  mockOpenAiContent = "[]";

  memoriesStore = [
    {
      id: 10,
      projectId: 1,
      type: "decision",
      content: "Architecture decision for Project 1",
      summary: null,
      source: null,
      tags: ["arch"],
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    },
    {
      id: 11,
      projectId: 1,
      type: "note",
      content: "Regular note for Project 1",
      summary: null,
      source: null,
      tags: ["note"],
      createdAt: new Date("2026-01-02"),
      updatedAt: new Date("2026-01-02"),
    },
    {
      id: 20,
      projectId: 2,
      type: "decision",
      content: "Confidential Project 2 secret memory",
      summary: null,
      source: null,
      tags: ["confidential"],
      createdAt: new Date("2026-01-03"),
      updatedAt: new Date("2026-01-03"),
    },
  ];

  tasksStore = [
    {
      id: 100,
      projectId: 1,
      memoryId: 10,
      title: "Task 1 for Project 1",
      assignee: "Dev1",
      status: "open",
      dueDate: null,
      createdAt: new Date("2026-01-01"),
    },
    {
      id: 101,
      projectId: 1,
      memoryId: 10,
      title: "Task 2 for Project 1",
      assignee: "Dev1",
      status: "done",
      dueDate: null,
      createdAt: new Date("2026-01-02"),
    },
    {
      id: 200,
      projectId: 2,
      memoryId: 20,
      title: "Secret task for Project 2",
      assignee: "Dev2",
      status: "open",
      dueDate: null,
      createdAt: new Date("2026-01-03"),
    },
  ];
});

describe("Security & Correctness Hardening Test Suite", () => {
  // -------------------------------------------------------------
  // MEMORY PROJECT ISOLATION (IDOR)
  // -------------------------------------------------------------
  test("1. Project A can read its own memory", async () => {
    const res = await fetch(`${baseUrl}/projects/1/memories/10`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.id, 10);
    assert.strictEqual(body.projectId, 1);
  });

  test("2. Project A cannot read Project B memory using Project B memoryId (404)", async () => {
    const res = await fetch(`${baseUrl}/projects/1/memories/20`);
    assert.strictEqual(res.status, 404);
    const body = await res.json();
    assert.strictEqual(body.error, "Memory not found");
  });

  test("3. Project A cannot update Project B memory (404)", async () => {
    const res = await fetch(`${baseUrl}/projects/1/memories/20`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Malicious update attempt" }),
    });
    assert.strictEqual(res.status, 404);
    // Ensure content of memory 20 did NOT change
    const target = memoriesStore.find((m) => m.id === 20);
    assert.strictEqual(target?.content, "Confidential Project 2 secret memory");
  });

  test("4. Project A cannot delete Project B memory (404)", async () => {
    const res = await fetch(`${baseUrl}/projects/1/memories/20`, {
      method: "DELETE",
    });
    assert.strictEqual(res.status, 404);
    // Ensure memory 20 was NOT deleted
    assert.ok(memoriesStore.some((m) => m.id === 20));
  });

  test("5. Project A cannot summarize Project B memory (404)", async () => {
    const res = await fetch(`${baseUrl}/projects/1/memories/20/summarize`, {
      method: "POST",
    });
    assert.strictEqual(res.status, 404);
    assert.strictEqual(lastOpenAiCall, null, "OpenAI must not be invoked for cross-project memory");
  });

  // -------------------------------------------------------------
  // TASK PROJECT ISOLATION (IDOR)
  // -------------------------------------------------------------
  test("6. Project A cannot update Project B task (404)", async () => {
    const res = await fetch(`${baseUrl}/projects/1/tasks/200`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Tampered Task" }),
    });
    assert.strictEqual(res.status, 404);
    const target = tasksStore.find((t) => t.id === 200);
    assert.strictEqual(target?.title, "Secret task for Project 2");
  });

  test("7. Project A cannot delete Project B task (404)", async () => {
    const res = await fetch(`${baseUrl}/projects/1/tasks/200`, {
      method: "DELETE",
    });
    assert.strictEqual(res.status, 404);
    assert.ok(tasksStore.some((t) => t.id === 200));
  });

  // -------------------------------------------------------------
  // TASK EXTRACTION SCOPING
  // -------------------------------------------------------------
  test("8. Project A cannot extract tasks from Project B memory (404)", async () => {
    const res = await fetch(`${baseUrl}/projects/1/extract-tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memoryId: 20 }),
    });
    assert.strictEqual(res.status, 404);
    assert.strictEqual(lastOpenAiCall, null, "OpenAI must not be invoked for cross-project task extraction");
  });

  // -------------------------------------------------------------
  // AI DATA ISOLATION
  // -------------------------------------------------------------
  test("9. Ask AI only receives memories from the requested project", async () => {
    mockOpenAiContent = "Answer\nRELEVANT_IDS: 10";
    const res = await fetch(`${baseUrl}/projects/1/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "What decisions were made?" }),
    });
    assert.strictEqual(res.status, 200);
    const userPrompt = lastOpenAiCall.messages.find((m: any) => m.role === "user").content;
    assert.ok(userPrompt.includes("Architecture decision for Project 1"));
    assert.ok(!userPrompt.includes("Confidential Project 2 secret memory"), "Project 2 memory must NOT be sent to Ask AI");
  });

  test("10. Insights only receives memories from the requested project", async () => {
    mockOpenAiContent = JSON.stringify({
      summary: "Overview",
      keyDecisions: ["Decision 1"],
      actionItems: ["Action 1"],
      risks: ["Risk 1"],
    });
    const res = await fetch(`${baseUrl}/projects/1/insights`);
    assert.strictEqual(res.status, 200);
    const userPrompt = lastOpenAiCall.messages.find((m: any) => m.role === "user").content;
    assert.ok(userPrompt.includes("Architecture decision for Project 1"));
    assert.ok(!userPrompt.includes("Confidential Project 2 secret memory"), "Project 2 memory must NOT be sent to Insights");
  });

  // -------------------------------------------------------------
  // AI JSON & TASK EXTRACTION ROBUSTNESS
  // -------------------------------------------------------------
  test("11. Valid JSON works in task extraction", async () => {
    mockOpenAiContent = JSON.stringify([
      { title: "Set up CI/CD", assignee: "Alex" },
    ]);
    const res = await fetch(`${baseUrl}/projects/1/extract-tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memoryId: 10 }),
    });
    assert.strictEqual(res.status, 200);
    const tasks = await res.json();
    assert.strictEqual(tasks.length, 1);
    assert.strictEqual(tasks[0].title, "Set up CI/CD");
    assert.strictEqual(tasks[0].assignee, "Alex");
    assert.strictEqual(tasks[0].status, "open");
    assert.strictEqual(tasks[0].projectId, 1);
  });

  test("12. Markdown-fenced JSON works in task extraction", async () => {
    mockOpenAiContent = "```json\n[\n  {\"title\": \"Fenced Action Item\", \"assignee\": null}\n]\n```";
    const res = await fetch(`${baseUrl}/projects/1/extract-tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memoryId: 10 }),
    });
    assert.strictEqual(res.status, 200);
    const tasks = await res.json();
    assert.strictEqual(tasks.length, 1);
    assert.strictEqual(tasks[0].title, "Fenced Action Item");
    assert.strictEqual(tasks[0].assignee, null);
  });

  test("13. Malformed JSON returns controlled failure (502)", async () => {
    mockOpenAiContent = "I could not generate valid json for this request.";
    const countBefore = tasksStore.length;
    const res = await fetch(`${baseUrl}/projects/1/extract-tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memoryId: 10 }),
    });
    assert.strictEqual(res.status, 502);
    const body = await res.json();
    assert.strictEqual(body.error, "Failed to parse AI response as valid JSON");
    assert.strictEqual(tasksStore.length, countBefore, "No tasks should be inserted on failure");
  });

  test("14. Malformed task objects are rejected (502)", async () => {
    // Missing title or empty title
    mockOpenAiContent = JSON.stringify([
      { title: "", assignee: "Alex" },
    ]);
    const countBefore = tasksStore.length;
    const res = await fetch(`${baseUrl}/projects/1/extract-tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memoryId: 10 }),
    });
    assert.strictEqual(res.status, 502);
    const body = await res.json();
    assert.strictEqual(body.error, "AI response did not match expected task structure");
    assert.strictEqual(tasksStore.length, countBefore, "No partial or invalid tasks should be inserted");
  });

  test("15. Multiple extracted tasks are batch inserted correctly", async () => {
    mockOpenAiContent = JSON.stringify([
      { title: "Task 1", assignee: "Alex" },
      { title: "Task 2", assignee: "Sam" },
      { title: "Task 3", assignee: null },
    ]);
    const res = await fetch(`${baseUrl}/projects/1/extract-tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memoryId: 10 }),
    });
    assert.strictEqual(res.status, 200);
    const tasks = await res.json();
    assert.strictEqual(tasks.length, 3);
    assert.strictEqual(insertTasksBatchCalls, 1, "Must execute exactly ONE batch insert call, not N sequential calls");
  });

  // -------------------------------------------------------------
  // SQL FILTERING
  // -------------------------------------------------------------
  test("16. Memory type filter works", async () => {
    const res = await fetch(`${baseUrl}/projects/1/memories?type=decision`);
    assert.strictEqual(res.status, 200);
    const memories = await res.json();
    assert.strictEqual(memories.length, 1);
    assert.strictEqual(memories[0].id, 10);
    assert.strictEqual(memories[0].type, "decision");
  });

  test("17. Task status filter works", async () => {
    const res = await fetch(`${baseUrl}/projects/1/tasks?status=open`);
    assert.strictEqual(res.status, 200);
    const tasks = await res.json();
    assert.strictEqual(tasks.length, 1);
    assert.strictEqual(tasks[0].id, 100);
    assert.strictEqual(tasks[0].status, "open");
  });
});
