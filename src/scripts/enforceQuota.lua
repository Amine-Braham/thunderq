-- KEYS[1] - The quota set key
-- ARGV[1] - The maximum quota allowed
-- ARGV[2] - Job ID to add
-- ARGV[3] - TTL for the quota set
local quotaKey = KEYS[1]
local maxQuota = tonumber(ARGV[1])
local jobId = ARGV[2]
local ttl = tonumber(ARGV[3])

-- Get the current count
local currentCount = redis.call("SCARD", quotaKey)

if currentCount < maxQuota then
    -- Add the job to the quota set
    redis.call("SADD", quotaKey, jobId)
    -- Set TTL to avoid leaks
    redis.call("EXPIRE", quotaKey, ttl)
    return 1 -- Success
else
    return 0 -- Quota exceeded
end
