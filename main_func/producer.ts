import { Queue } from "../src";

async function run() {
  // Create a queue instance
  const emailQueue = new Queue("emails");

  console.log("Adding jobs to the queue...");

  // // Add regular jobs
  // const job1Id = await emailQueue.addJob({
  //   to: "user1@example.com",
  //   subject: "Welcome to our service!",
  //   template: "welcome",
  // });
  // console.log(`Added regular jobs: ${job1Id}`);

  // // Add job with quota key (to limit concurrent jobs for the same user)
  // const job2Id = await emailQueue.addJob(
  //   {
  //     to: "user2@example.com",
  //     subject: "Your monthly report",
  //     template: "report",
  //   },
  //   "user2"
  // ); // Using user2 as the quota key
  // console.log(`Added job with quota: ${job2Id}`);

  // // Add delayed job (will be executed after 10 seconds)
  // const job3Id = await emailQueue.addJob(
  //   {
  //     to: "user3@example.com",
  //     subject: "Your trial is expiring soon",
  //     template: "trial-expiring",
  //   },
  //   undefined,
  //   10000
  // ); // 10 second delay
  // console.log(`Added delayed jobs: ${job3Id}`);

  // Add multiple jobs with the same quota key
  // Only 2 will process concurrently if using maxQuota=2 in worker
  for (let i = 0; i < 10; i++) {
    const jobId = await emailQueue.addJob(
      {
        to: `batch${i}@example.com`,
        subject: `Batch notification ${i}`,
        template: "notification",
      },
      "batch-user"
    );
    console.log(`Added batch jobs: ${jobId}`);
  }
}

run().catch((error) => {
  console.error("Error in producer:", error);
  process.exit(1);
});
