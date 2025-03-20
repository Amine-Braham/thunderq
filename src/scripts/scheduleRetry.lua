-- Schedule a job for retry
-- KEYS[1]: jobKey (job:jobId)
-- KEYS[2]: delayedKey (delayed:queueName)
-- KEYS[3]: processingKey (processing:queueName)
-- ARGV[1]: jobId
-- ARGV[2]: attempts
-- ARGV[3]: lastError
-- ARGV[4]: retryAt
-- ARGV[5]: status (usually "delayed")
-- Update job with retry information
redis.call('HSET', KEYS[1], 'attempts', ARGV[2], 'lastError', ARGV[3], 'retryAt', ARGV[4], 'status', ARGV[5])

-- Add job to delayed queue for retry
redis.call('ZADD', KEYS[2], ARGV[4], ARGV[1])

-- Remove from processing set
redis.call('HDEL', KEYS[3], ARGV[1])

return 1
