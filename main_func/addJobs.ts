import { Queue } from "../src";

async function run() {
  const numJobs = 2;
  // // Create a new queue
  const queue = new Queue("my_queue");
  // add 10 jobs of quota key "conn1"
  for (let i = 0; i < numJobs; i++) {
    await queue.addJob(
      {
        to: `Conn1--${i}@example.com`,
        subject: `Conn1 notification ${i}`,
        template: "notification",
      },
      "conn1"
    );
  }
  console.log("Added 10 jobs of quota key 'conn1'");
  // add 10 jobs of quota key "conn2"
  for (let i = 0; i < numJobs; i++) {
    await queue.addJob(
      {
        to: `Conn2--${i}@example.com`,
        subject: `Conn2 notification ${i}`,
        template: "notification",
      },
      "conn2"
    );
  }
  console.log("Added 10 jobs of quota key 'conn2'");
}

run().catch((error) => {
  console.error("Error in producer:", error);
  process.exit(1);
});
