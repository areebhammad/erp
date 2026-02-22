# Event System Architecture

## Pub/Sub Mechanism
We utilize Redis Pub/Sub for an event-driven architecture that allows modules to react without tight coupling.

## Event Payloads
All payloads strictly type-checked via Pydantic (`BaseEvent`). Includes `event_type`, `tenant_id`, and a payload schema.

## Workers
Subscribers run as asynchronous workers that listen to the Redis stream and route jobs or emails (like welcome emails).
