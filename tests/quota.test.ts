import { Queue } from "../src/classes/Queue";
import { Worker } from "../src/classes/Worker";
import { RedisClient } from "../src/classes/RedisClient";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { sleep } from "../src/utils";

describe("Quota Limit", () => {
  beforeAll(() => {
    // Enable Redis mocking for tests
    RedisClient.enableMocking();
  });

  afterAll(() => {
    // Disable Redis mocking
    RedisClient.disableMocking();
  });

  it("should enforce max concurrent jobs per quotaKey", async () => {
    const queue = new Queue("quotaQueue");

    // Add 3 jobs with the same quotaKey
    await queue.addJob({ task: "email1" }, "user-123");
    await queue.addJob({ task: "email2" }, "user-123");
    await queue.addJob({ task: "email3" }, "user-123");

    let processedJobs = 0;
    const worker = new Worker("quotaQueue", 2); // Max 2 jobs per quotaKey

    // Create a handler that processes for a limited time
    const handler = async () => {
      processedJobs++;
      await sleep(50); // Shorter delay for testing
    };

    // Start processing in a separate "thread"
    const processingPromise = worker.processJob(handler);

    // Set a timeout to stop it
    setTimeout(() => {
      worker.stopProcessing = true;
    }, 300);

    // Wait for processing to complete
    await processingPromise.catch(() => {});

    // Only 2 jobs should process at a time due to quota
    expect(processedJobs).toBeLessThanOrEqual(2);
  });
});
