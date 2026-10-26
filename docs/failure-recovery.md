# Failure & Recovery Guide

| Failure                                        | Detection                          | Automatic response                                                                                                                            | Operator action                                      |
| ---------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Transient step error (5xx, 429, timeout)       | Step runner throws                 | Retry with exponential backoff (default 3 attempts, 500ms x2, cap 10s), per-node `data.retry` override                                        | none                                                 |
| Permanent step error (4xx / retries exhausted) | Saga catches                       | State -> COMPENSATING; completed steps' compensations run in reverse order; -> ROLLED_BACK; entry written to DeadLetter + `dead-letter` queue | Inspect in DLQ, fix cause, `POST /api/dlq/:id/retry` |
| Compensation itself fails                      | `COMPENSATION_FAILED` event        | Logged, remaining compensations continue                                                                                                      | Manual cleanup using execution step log              |
| Worker crash mid-run                           | BullMQ stalled-job detection       | Job re-delivered, up to 3 attempts, exponential backoff                                                                                       | Steps should be idempotent                           |
| Infra failure after all attempts               | Worker `failed` handler            | Execution marked FAILED, sent to DLQ                                                                                                          | Fix infra, replay from DLQ                           |
| Runaway user script                            | Worker-thread timeout / memory cap | Thread terminated, step fails (retry/rollback applies)                                                                                        | none                                                 |
| Tenant over quota                              | Checked at enqueue                 | HTTP 402                                                                                                                                      | Raise quota                                          |
| Redis / Mongo outage                           | Health checks, ECS restarts        | API returns 5xx; queued jobs persist in Redis                                                                                                 | Restore service; jobs resume                         |

## State machine

PENDING -> RUNNING -> COMPLETED | (FAILED ->) COMPENSATING -> ROLLED_BACK. Illegal transitions throw.

## Multi-tenancy

Strategy chosen: discriminator key (`tenantId`, indexed on every collection). Chosen over per-tenant DB connection pools because pools grow linearly with tenants (connection exhaustion). Trade-off: stricter query discipline - every query must include tenantId (enforced by `tenantContext` + scoped queries in routes).

##This is all about failure recovery
