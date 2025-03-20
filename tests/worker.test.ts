import { Queue } from "../src/classes/Queue";
import { RedisClient } from "../src/classes/RedisClient";
import { describe, expect, it, beforeAll, afterAll } from "vitest";

describe("Queue", () => {
  beforeAll(() => {
    // Enable Redis mocking for tests
    RedisClient.enableMocking();
  });

  afterAll(() => {
    // Disable Redis mocking
    RedisClient.disableMocking();
  });

  it("should add a job to the queue", async () => {
    const queue = new Queue("testQueue");
    const jobId = await queue.addJob({ foo: "bar" });
    expect(jobId).toBeDefined();

    // Verify job was added
    const job = await queue.getJob(jobId);
    expect(job).not.toBeNull();
    expect(job?.payload).toEqual({ foo: "bar" });
    expect(job?.status).toBe("waiting");
  });
});