/**
 * Utility functions for the job queue
 */

/**
 * Sleep for a specified number of milliseconds
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Generate a unique ID (alternative to nanoid if needed)
 */
export const generateId = (length: number = 8): string => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Format error message for better logging
 */
export const formatError = (error: Error): string => {
  return `${error.name}: ${error.message}\n${error.stack}`;
};
