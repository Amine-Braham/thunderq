-- KEYS[1]: queue key (queue:queueName)
-- KEYS[2]: processing key (processing:queueName)
-- ARGV[1]: jobId

-- Re-queue the job
redis.call('LPUSH', KEYS[1], ARGV[1])

-- Remove from processing
redis.call('HDEL', KEYS[2], ARGV[1])

return 1