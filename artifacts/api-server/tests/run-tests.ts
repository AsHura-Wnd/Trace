process.env.DATABASE_URL = "postgres://mock:mock@localhost:5432/mock";
process.env.AI_INTEGRATIONS_OPENAI_BASE_URL = "https://mock.openai.com/v1";
process.env.AI_INTEGRATIONS_OPENAI_API_KEY = "mock-key";
process.env.PORT = "8080";

await import("./security-correctness.test.js");
