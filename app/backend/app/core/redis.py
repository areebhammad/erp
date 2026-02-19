"""Redis connection and utilities."""

import json
from typing import Any

import redis.asyncio as aioredis

from app.core.config import settings


class RedisClient:
    """Async Redis client wrapper."""

    def __init__(self) -> None:
        self._client: aioredis.Redis | None = None

    async def connect(self) -> None:
        """Connect to Redis."""
        if self._client is None:
            self._client = aioredis.from_url(
                settings.redis_url,
                encoding="utf-8",
                decode_responses=True,
            )

    async def disconnect(self) -> None:
        """Disconnect from Redis."""
        if self._client:
            await self._client.close()
            self._client = None

    @property
    def client(self) -> aioredis.Redis:
        """Get Redis client."""
        if self._client is None:
            raise RuntimeError("Redis client not connected. Call connect() first.")
        return self._client

    async def get(self, key: str) -> Any | None:
        """Get value from Redis."""
        value = await self.client.get(key)
        if value is None:
            return None
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value

    async def set(
        self,
        key: str,
        value: Any,
        ttl: int | None = None,
    ) -> bool:
        """Set value in Redis with optional TTL."""
        if isinstance(value, (dict, list)):
            value = json.dumps(value)
        ttl = ttl or settings.redis_cache_ttl
        return await self.client.set(key, value, ex=ttl)

    async def delete(self, key: str) -> int:
        """Delete key from Redis."""
        return await self.client.delete(key)

    async def exists(self, key: str) -> bool:
        """Check if key exists in Redis."""
        return bool(await self.client.exists(key))

    async def expire(self, key: str, ttl: int) -> bool:
        """Set TTL on a key."""
        return await self.client.expire(key, ttl)

    async def ttl(self, key: str) -> int:
        """Get TTL of a key."""
        return await self.client.ttl(key)

    async def incr(self, key: str) -> int:
        """Increment a counter."""
        return await self.client.incr(key)

    async def incrby(self, key: str, amount: int) -> int:
        """Increment a counter by amount."""
        return await self.client.incrby(key, amount)

    async def decr(self, key: str) -> int:
        """Decrement a counter."""
        return await self.client.decr(key)

    # Hash operations
    async def hget(self, name: str, key: str) -> Any | None:
        """Get hash field value."""
        value = await self.client.hget(name, key)
        if value is None:
            return None
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value

    async def hset(
        self,
        name: str,
        key: str,
        value: Any,
    ) -> int:
        """Set hash field value."""
        if isinstance(value, (dict, list)):
            value = json.dumps(value)
        return await self.client.hset(name, key, value)

    async def hgetall(self, name: str) -> dict[str, Any]:
        """Get all hash fields."""
        data = await self.client.hgetall(name)
        result = {}
        for key, value in data.items():
            try:
                result[key] = json.loads(value)
            except json.JSONDecodeError:
                result[key] = value
        return result

    async def hdel(self, name: str, key: str) -> int:
        """Delete hash field."""
        return await self.client.hdel(name, key)

    # List operations
    async def lpush(self, key: str, value: Any) -> int:
        """Push to list head."""
        if isinstance(value, (dict, list)):
            value = json.dumps(value)
        return await self.client.lpush(key, value)

    async def rpush(self, key: str, value: Any) -> int:
        """Push to list tail."""
        if isinstance(value, (dict, list)):
            value = json.dumps(value)
        return await self.client.rpush(key, value)

    async def lpop(self, key: str) -> Any | None:
        """Pop from list head."""
        value = await self.client.lpop(key)
        if value is None:
            return None
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value

    async def rpop(self, key: str) -> Any | None:
        """Pop from list tail."""
        value = await self.client.rpop(key)
        if value is None:
            return None
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value

    async def llen(self, key: str) -> int:
        """Get list length."""
        return await self.client.llen(key)

    async def lrange(
        self,
        key: str,
        start: int = 0,
        end: int = -1,
    ) -> list[Any]:
        """Get list range."""
        values = await self.client.lrange(key, start, end)
        result = []
        for value in values:
            try:
                result.append(json.loads(value))
            except json.JSONDecodeError:
                result.append(value)
        return result

    # Pub/Sub operations
    async def publish(self, channel: str, message: Any) -> int:
        """Publish message to channel."""
        if isinstance(message, (dict, list)):
            message = json.dumps(message)
        return await self.client.publish(channel, message)

    def pubsub(self) -> aioredis.client.PubSub:
        """Get pubsub object."""
        return self.client.pubsub()

    async def subscribe(self, *channels: str) -> None:
        """Subscribe to channels."""
        pubsub = self.pubsub()
        await pubsub.subscribe(*channels)
        return pubsub

    # Cache utilities
    async def cache_get(self, key: str) -> Any | None:
        """Get cached value."""
        return await self.get(f"cache:{key}")

    async def cache_set(
        self,
        key: str,
        value: Any,
        ttl: int | None = None,
    ) -> bool:
        """Set cached value."""
        return await self.set(f"cache:{key}", value, ttl)

    async def cache_delete(self, key: str) -> int:
        """Delete cached value."""
        return await self.delete(f"cache:{key}")

    # Token blacklist utilities
    async def blacklist_token(
        self,
        token_jti: str,
        ttl: int,
    ) -> bool:
        """Add token to blacklist."""
        return await self.set(f"blacklist:{token_jti}", "1", ttl)

    async def is_token_blacklisted(self, token_jti: str) -> bool:
        """Check if token is blacklisted."""
        return await self.exists(f"blacklist:{token_jti}")


# Global Redis client instance
redis_client = RedisClient()


async def check_redis_connection() -> bool:
    """Check if Redis connection is healthy."""
    try:
        await redis_client.connect()
        await redis_client.client.ping()
        return True
    except Exception:
        return False