import { Queue, Worker, sleep } from "../src";

async function runDemo() {
  console.log("Starting job queue demo...");

  // Create a queue
  const taskQueue = new Queue("tasks");

  // Create a worker with concurrency of 2
  // Parameters: (queueName, maxQuota, concurrency)
  const worker = new Worker("tasks", 2, 2);

  // Set up error handler
  worker.on("error", (error, jobId) => {
    console.error(`Error processing job ${jobId || "unknown"}:`, error);
  });

  // Define job handler
  const processTask = async (payload: any) => {
    console.log(`Processing task: ${payload.name}`);

    // Simulate work
    await sleep(payload.duration || 1000);

    console.log(`Completed task: ${payload.name}`);
  };

  // Start worker in background
  console.log("Starting worker...");
  const workerPromise = worker.processJob(processTask);

  // Add some jobs with different characteristics
  console.log("Adding jobs to queue...");

  // Regular job
  await taskQueue.addJob({ name: "Task 1", duration: 500 });

  // Jobs with quota key
  await taskQueue.addJob({ name: "User Task 1", duration: 800 }, "user-1");
  await taskQueue.addJob({ name: "User Task 2", duration: 600 }, "user-1");
  await taskQueue.addJob({ name: "User Task 3", duration: 700 }, "user-1");

  // Delayed job
  await taskQueue.addJob(
    { name: "Delayed Task", duration: 300 },
    undefined,
    3000
  );

  // Check for delayed jobs
  console.log("Waiting for delayed jobs...");
  await sleep(3500);
  const movedJobs = await taskQueue.moveDelayedJobs();
  console.log(`Moved ${movedJobs.length} delayed jobs to queue`);

  // Let the worker process all jobs
  console.log("Waiting for jobs to complete...");
  await sleep(5000);

  // Stop worker
  console.log("Stopping worker...");
  worker.stopProcessing = true;
  await workerPromise;

  console.log("Demo completed!");
}

runDemo().catch((error) => {
  console.error("Demo error:", error);
  process.exit(1);
});
