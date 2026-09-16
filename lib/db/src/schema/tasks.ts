import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";
import { memoriesTable } from "./memories";

export const tasksTable = pgTable(
  "tasks",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
    memoryId: integer("memory_id").references(() => memoriesTable.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    assignee: text("assignee"),
    status: text("status").notNull().default("open"),
    dueDate: timestamp("due_date"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("tasks_project_id_status_idx").on(table.projectId, table.status),
    index("tasks_project_id_created_at_idx").on(table.projectId, table.createdAt),
  ]
);

export const insertTaskSchema = createInsertSchema(tasksTable).omit({ id: true, createdAt: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;
