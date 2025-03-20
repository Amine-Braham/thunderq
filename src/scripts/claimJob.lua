-- Atomically move a job from the queue to the processing list
-- KEYS[1]: The queue key (list)
-- KEYS[2]: The processing key (hash)
-- ARGV[1]: Worker ID
local jobId = redis.call("RPOP", KEYS[1])

if not jobId then
    return nil
end

-- Check if job is already being processed (shouldn't happen, but let's be safe)
if redis.call("HEXISTS", KEYS[2], jobId) == 1 then
    -- Job is already being processed by another worker
    -- Push it back to the head of the queue
    redis.call("RPUSH", KEYS[1], jobId)
    return nil
end

-- Check if job is scheduled for retry
local jobKey = "jobs:" .. jobId
local retryAt = redis.call("HGET", jobKey, "retryAt")
local now = redis.call("TIME")[1] * 1000 -- Current time in milliseconds

if retryAt and tonumber(retryAt) > now then
    -- Job is scheduled for retry in the future
    -- Add it to the delayed queue instead
    local delayedKey = string.gsub(KEYS[1], "queue:", "delayed:")
    redis.call("ZADD", delayedKey, retryAt, jobId)
    return nil
end

-- Mark job as being processed
redis.call("HSET", KEYS[2], jobId, ARGV[1])

-- Clear retryAt if it exists and update status to active
if retryAt then
    redis.call("HDEL", jobKey, "retryAt")
    redis.call("HSET", jobKey, "status", "processing")
end

return jobId
