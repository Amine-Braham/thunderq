import { generateId } from "../utils";

export interface JobData {
  id: string;
  quotaKey?: string;
  payload: any;
  status: "waiting" | "active" | "failed" | "completed" | "delayed";
  createdAt: number;
  attempts?: number;
  lastError?: string;
  retryAt?: number;
}

export class Job {
  id: string;
  quotaKey?: string;
  payload: any;
  status: JobData["status"];
  createdAt: number;
  attempts: number;
  lastError?: string;
  retryAt?: number;

  constructor(payload: any, quotaKey?: string) {
    this.id = generateId(4);
    this.quotaKey = quotaKey;
    this.payload = payload;
    this.status = "waiting";
    this.createdAt = Date.now();
    this.attempts = 0;
  }
}
