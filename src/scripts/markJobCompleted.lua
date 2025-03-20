-- KEYS[1]: job key (jobs:jobId)
-- KEYS[2]: processing key (processing:queueName)
-- ARGV[1]: jobId
-- Mark the job as completed
redis.call('HSET', KEYS[1], 'status', 'completed')

-- Remove the job from processing set
redis.call('HDEL', KEYS[2], ARGV[1])

return 1
