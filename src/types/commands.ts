// Update src/types/commands.ts
export const COMMANDS = {
  claimjobs: { name: "claimJob", keys: 2 },
  enforceQuota: { name: "enforceQuota", keys: 1 },
  moveDelayedJobs: { name: "moveDelayedJobs", keys: 3 },
  markJobFailed: { name: "markJobFailed", keys: 2 },
  markJobCompleted: { name: "markJobCompleted", keys: 2 },
  requeuejobs: { name: "requeueJob", keys: 2 },
  scheduleRetry: { name: "scheduleRetry", keys: 3 },
};
