-- KEYS[1]: delayed queue (delayed:queueName)
-- KEYS[2]: target queue (queue:queueName)
-- KEYS[3]: last check timestamp key
-- ARGV[1]: current timestamp
-- ARGV[2]: minimum interval between checks (in ms)
local now = tonumber(ARGV[1])
local minInterval = tonumber(ARGV[2] or "0")
local lastCheckKey = KEYS[3]

-- Check if we've run too recently
local lastCheck = tonumber(redis.call("GET", lastCheckKey) or "0")
if now < (lastCheck + minInterval) then
    return {
        moved = 0,
        skipped = true,
        nextAllowedRun = lastCheck + minInterval
    }
end

-- Set the last check timestamp
redis.call("SET", lastCheckKey, now)
redis.call("EXPIRE", lastCheckKey, 86400) -- 24 hour TTL to prevent stale keys

-- Get and move eligible jobs
local jobIds = redis.call("ZRANGEBYSCORE", KEYS[1], "-inf", now)

for _, jobId in ipairs(jobIds) do
    redis.call("LPUSH", KEYS[2], jobId) -- Move job to the queue
    redis.call("ZREM", KEYS[1], jobId) -- Remove from delayed set

    -- Update status back to waiting
    local jobKey = "job:" .. jobId
    if redis.call("HEXISTS", jobKey, "status") == 1 then
        redis.call("HSET", jobKey, "status", "waiting")
    end
end

return {
    moved = #jobIds,
    skipped = false,
    jobIds = jobIds
}
