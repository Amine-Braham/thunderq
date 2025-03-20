import { Queue } from "../src";
import { sleep } from "../src/utils";

// Create a map to store queues
const queues: Map<string, Queue> = new Map();

// Get or create queue
function getQueue(name: string): Queue {
  if (!queues.has(name)) {
    queues.set(name, new Queue(name));
  }
  return queues.get(name)!;
}

async function checkDelayedJobs() {
  // Process all queues
  for (const [name, queue] of queues.entries()) {
    try {
      const movedJobs = await queue.moveDelayedJobs();
      if (movedJobs.length > 0) {
        console.log(
          `Moved ${movedJobs.length} delayed jobs to queue "${name}"`
        );
      }
    } catch (error) {
      console.error(`Error checking delayed jobs for queue "${name}":`, error);
    }
  }
}

async function run() {
  console.log("Starting job scheduler...");

  // Register queues that need to be checked
  getQueue("emails");
  getQueue("notifications");
  getQueue("reports");

  // Check for delayed jobs periodically
  while (true) {
    await checkDelayedJobs();
    await sleep(1000); // Check every second
  }
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("Shutting down scheduler...");
  process.exit(0);
});

run().catch((error) => {
  console.error("Fatal scheduler error:", error);
  process.exit(1);
});
