import { Scheduler, Worker, sleep } from "../src";

async function run() {
  // Create a worker for the email queue
  // Parameters: (queueName, maxQuota, concurrency)
  // maxQuota: max concurrent jobs per quota key (2)
  // concurrency: max parallel jobs this worker can process (4)
  const worker = new Worker("my_queue");

  console.log("Starting email worker...");

  // Set up error handler
  worker.on("error", (error, jobId) => {
    if (jobId) {
      console.error(`Error processing job ${jobId}:`, error);
    } else {
      console.error("Worker error:", error);
    }
  });

  // Define job processing function that just prints email details
  const processEmail = async (payload: any) => {
    // console.log("---------------------------------------");
    // console.log(`Processing email:`);
    console.log(`${payload.to}`);
    // console.log(`Subject: ${payload.subject}`);
    // console.log(`Template: ${payload.template}`);
    // console.log("---------------------------------------");
    // Simulate actual email sending with a delay
    // const processingTime = Math.random() * 1000 + 500; // 500-1500ms
    return new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        console.log("5 seconds have passed");
        // Comment this out to test successful processing
        reject(new Error("Failed to send email"));

        // Or resolve for success
        // resolve();
      }, 5000);
    });
  };

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log("Gracefully shutting down worker...");
    worker.stopProcessing = true;
    // Give it some time to finish current job
    setTimeout(() => process.exit(0), 1000);
  });

  // Generate a worker ID to distinguish between multiple instances
  const workerId = Math.floor(Math.random() * 1000);
  console.log(`Worker #${workerId} is now listening for jobs...`);
  const scheduler = Scheduler.getInstance();
  scheduler.startBackground(60000);
  // Start processing jobs (this will run until the process is stopped)
  await worker.processJob(processEmail);
}

run().catch((error) => {
  console.error("Fatal worker error:", error);
  process.exit(1);
});
