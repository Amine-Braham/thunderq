-- KEYS[1]: job key (jobs:jobId)
-- KEYS[2]: processing key (processing:queueName)
-- ARGV[1]: jobId
-- ARGV[2]: error name/message
-- ARGV[3]: stack trace
-- ARGV[4]: attempts (optional)
-- Mark the job as failed with error details
local updates = {'status', 'failed', 'error', ARGV[2], 'stackTrace', ARGV[3]}

-- Add attempts if provided
if ARGV[4] then
    table.insert(updates, 'attempts')
    table.insert(updates, ARGV[4])
end

redis.call('HSET', KEYS[1], unpack(updates))

-- Remove the job from processing set
redis.call('HDEL', KEYS[2], ARGV[1])

return 1
