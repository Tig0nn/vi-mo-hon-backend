# API Contract

This document defines the demo MVP REST contract. Keep this file updated whenever endpoint behavior changes.

The current demo API focuses on quick expense input, AI Anti-Regret Coach, profile personalization, local reminders, challenges, XP/stats, boss progress, and dashboard. Reflection is a future/post-demo feature only. AI provider calls are backend-only; clients must never call Gemini directly or receive provider secrets.

## Demo User IDs

During local development, `mock-user` can be used.

For the 5-person external demo, use assigned user IDs:

- `test-user-1`
- `test-user-2`
- `test-user-3`
- `test-user-4`
- `test-user-5`

The API should accept these IDs the same way it accepts `mock-user`.

## Shared Response Shape

Success:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {}
}
```

## Error Semantics

- `400 Bad Request`: malformed input or missing required query params
- `404 Not Found`: resource does not exist
- `409 Conflict`: duplicate or state conflict
- `422 Unprocessable Entity`: valid JSON but semantically invalid fields
- `500 Internal Server Error`: unexpected server error

Do not expose stack traces or third-party provider details to clients.

## Health

### `GET /api/health`

Checks whether the backend is running.

Response `200`:

```json
{
  "success": true,
  "message": "Server is healthy",
  "data": {
    "status": "ok",
    "timestamp": "2026-07-07T00:00:00.000Z"
  }
}
```

## Profile

### `POST /api/profile`

Creates a mock user profile. Use this before authentication exists.

Request:

```json
{
  "userId": "mock-user",
  "displayName": "Minh",
  "monthlyBudget": 3000000,
  "currency": "VND",
  "mainGoal": "Tiết kiệm 20 triệu",
  "triggers": ["trà sữa", "flash sale", "shopee"],
  "preferredTone": "funny"
}
```

Response `201`:

```json
{
  "success": true,
  "message": "Profile created",
  "data": {
    "id": "profile_001",
    "userId": "mock-user",
    "displayName": "Minh",
    "monthlyBudget": 3000000,
    "currency": "VND",
    "level": 1,
    "xp": 0,
    "discipline": 0,
    "mainGoal": "Tiết kiệm 20 triệu",
    "triggers": ["trà sữa", "flash sale", "shopee"],
    "preferredTone": "funny",
    "createdAt": "2026-07-07T00:00:00.000Z",
    "updatedAt": "2026-07-07T00:00:00.000Z"
  }
}
```

### `GET /api/profile/:userId`

Returns one profile by user id.

Response `200`:

```json
{
  "success": true,
  "message": "Profile retrieved",
  "data": {
    "userId": "mock-user",
    "displayName": "Minh",
    "monthlyBudget": 3000000,
    "currency": "VND",
    "level": 1,
    "xp": 40,
    "discipline": 0,
    "mainGoal": "Tiết kiệm 20 triệu",
    "triggers": ["trà sữa", "flash sale", "shopee"],
    "preferredTone": "funny"
  }
}
```

### `PATCH /api/profile/:userId`

Partially updates profile fields. Omitted fields stay unchanged.

Request:

```json
{
  "displayName": "Minh Anh",
  "monthlyBudget": 3500000,
  "mainGoal": "Mua laptop không nợ",
  "triggers": ["stress", "sale"],
  "preferredTone": "strict-but-kind"
}
```

Response `200`:

```json
{
  "success": true,
  "message": "Profile updated",
  "data": {
    "userId": "mock-user",
    "displayName": "Minh Anh",
    "monthlyBudget": 3500000,
    "currency": "VND",
    "level": 1,
    "xp": 40,
    "discipline": 0,
    "mainGoal": "Mua laptop không nợ",
    "triggers": ["stress", "sale"],
    "preferredTone": "strict-but-kind"
  }
}
```

## Expenses

### `POST /api/expenses/quick-input`

Creates an expense from a fast text or structured input, then updates XP progression.

Request:

```json
{
  "userId": "mock-user",
  "text": "tra sua 55000",
  "amount": 55000,
  "category": "FOOD_DRINK",
  "occurredAt": "2026-07-07T12:00:00.000Z"
}
```

Rules:

- `userId` is required.
- Either `text` or `amount` is required.
- `amount` must be a positive number when provided.
- `category` is optional and can be inferred later.
- `occurredAt` defaults to server time when omitted.

Response `201`:

```json
{
  "success": true,
  "message": "Expense recorded",
  "data": {
    "expense": {
      "id": "expense_001",
      "userId": "mock-user",
      "text": "tra sua 55000",
      "amount": 55000,
      "currency": "VND",
      "category": "FOOD_DRINK",
      "occurredAt": "2026-07-07T12:00:00.000Z"
    },
    "progression": {
      "xpGained": 5,
      "totalXp": 50,
      "level": 1
    }
  }
}
```

### `GET /api/expenses?userId=mock-user&page=1&pageSize=20`

Lists expenses for a user. Pagination should be supported from the first implementation.

Response `200`:

```json
{
  "success": true,
  "message": "Expenses retrieved",
  "data": {
    "items": [
      {
        "id": "expense_001",
        "userId": "mock-user",
        "amount": 55000,
        "currency": "VND",
        "category": "FOOD_DRINK",
        "occurredAt": "2026-07-07T12:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "totalItems": 1,
      "totalPages": 1
    }
  }
}
```

## Dashboard

### `GET /api/dashboard/:userId`

Returns the main home/dashboard state for the mobile app. The demo dashboard does not include recent reflections.

Response `200`:

```json
{
  "success": true,
  "message": "Dashboard retrieved",
  "data": {
    "profile": {
      "userId": "mock-user",
      "displayName": "Minh",
      "level": 1,
      "xp": 50,
      "discipline": 0,
      "monthlyBudget": 3000000,
      "monthlySpent": 55000,
      "mainGoal": "Tiết kiệm 20 triệu",
      "triggers": ["trà sữa", "flash sale", "shopee"],
      "preferredTone": "funny"
    },
    "boss": {
      "bossId": "impulse-boss",
      "name": "Impulse Boss",
      "currentHp": 100,
      "maxHp": 100
    },
    "recentExpenses": [],
    "activeChallenges": [
      {
        "id": "challenge-1",
        "title": "Không uống trà sữa hôm nay",
        "description": "Skip bubble tea for today.",
        "rewardXp": 30,
        "bossDamage": 20,
        "difficulty": "easy",
        "status": "active"
      }
    ]
  }
}
```

## Anti-Regret Coach

### `POST /api/coach/anti-regret`

Creates a mock spending urge and returns a short Vietnamese coaching response before or after a purchase. When `GEMINI_API_KEY` is configured, the backend uses Gemini to generate `coachMessage`; otherwise, or if Gemini fails, it returns the rule-based fallback.

Request:

```json
{
  "userId": "mock-user",
  "itemName": "tai nghe mới",
  "amount": 1200000,
  "trigger": "flash_sale",
  "reason": "Mình thấy flash sale nên hơi muốn chốt đơn",
  "mode": "BEFORE_PURCHASE"
}
```

Rules:

- `userId`, `itemName`, `amount`, and `reason` are required.
- `amount` must be a positive integer VND amount.
- `trigger` is optional. Valid values are `flash_sale`, `fomo`, `friends`, `emotional`, `self_reward`, and `other`.
- If `trigger` is provided, the API uses it as `detectedTrigger`.
- `mode` is optional and can be `BEFORE_PURCHASE` or `AFTER_PURCHASE`.
- The user profile must already exist so the response can use `mainGoal`, `triggers`, and `preferredTone`.
- If `trigger` is omitted, `detectedTrigger` is selected from matching profile triggers first, then simple fallback rules such as `flash_sale`, `emotional`, `fomo`, `friends`, `self_reward`, or `other`.
- Gemini prompts include the user's `mainGoal`, `triggers`, `preferredTone`, item details, detected trigger, suggested action, and recent spending summary when available.
- Gemini errors are logged server-side without exposing API keys or provider internals. If the fallback succeeds, the endpoint still returns `200`.
- Non-production responses include `debug.provider` with `gemini` or `fallback`. Production responses omit `debug`.

Response `200`:

```json
{
  "success": true,
  "message": "Coach response generated",
  "data": {
    "urgeId": "urge_001",
    "coachMessage": "Deal có vẻ thơm, nhưng trigger \"flash sale\" đang kéo bạn đó. Đợi 24h rồi chốt tai nghe mới; 1.200.000đ nên phục vụ goal \"Tiết kiệm 20 triệu\" nha.",
    "suggestedAction": "WAIT_24_HOURS",
    "detectedTrigger": "flash_sale"
  },
  "debug": {
    "provider": "gemini"
  }
}
```

### `POST /api/coach/chat`

Returns a short Vietnamese chat reply for the Coach tab. This endpoint is backend-only for AI provider calls: the mobile client sends the user message to the backend, and only the backend may call Gemini. This endpoint does not use rule-based or deterministic fallback replies. If Gemini is unavailable or returns invalid output after one retry, the backend returns an AI error.

Request:

```json
{
  "userId": "mock-user",
  "message": "Tôi muốn mua đồng hồ 1 triệu vì đang sale, có nên mua không?"
}
```

Rules:

- `userId` and `message` are required.
- `message` must be non-empty and at most 500 characters.
- The user profile must already exist so the response can use `mainGoal`, `triggers`, `preferredTone`, `monthlyBudget`, and current monthly spending.
- Gemini prompts include recent expenses when available.
- Gemini must return valid JSON only with `reply` and exactly 3 `suggestedQuestions`.
- Replies must be Vietnamese only, helpful, non-shaming, and 2-4 complete sentences.
- Replies must be at least 120 characters.
- Replies must contain at least 2 complete sentences and must not end with unfinished fragments.
- Replies must not mention Gemini, mock data, system prompts, or internal logic.
- Short reaction fragments such as `"U là trời, đồng hồ"` are rejected.
- The coach does not provide legal, investment, or medical advice.
- Purchase questions should help the user pause and compare the purchase with their goal.
- General finance questions should be answered simply and practically.
- If the first Gemini output is invalid, the backend retries once with a repair prompt.
- Successful responses include `debug.provider` with `gemini` and `debug.retryCount`.
- Invalid Gemini output returns `502` with `error.code = "AI_RESPONSE_INVALID"`.
- Gemini provider failures return `502` or `503` with `error.code = "AI_PROVIDER_ERROR"`.

Response `200`:

```json
{
  "success": true,
  "message": "Coach chat response generated",
  "data": {
    "reply": "Đồng hồ 1 triệu là khoản không nhỏ, nhất là nếu bạn đang có mục tiêu tiết kiệm. Nếu lý do chính là sale, hãy chờ 24 giờ rồi xem bạn còn muốn mua không. Nếu vẫn muốn mua, đặt trước một mức giá tối đa để tránh chốt vì cảm xúc.",
    "suggestedQuestions": [
      "Nếu không mua món này thì tôi tiết kiệm được bao nhiêu?",
      "Có lựa chọn nào rẻ hơn không?",
      "Món này có thật sự cần trong tuần này không?"
    ]
  },
  "debug": {
    "provider": "gemini",
    "retryCount": 0
  }
}
```

Invalid Gemini output response `502`:

```json
{
  "success": false,
  "message": "Coach chưa trả lời ổn định, thử lại nha.",
  "error": {
    "code": "AI_RESPONSE_INVALID"
  },
  "debug": {
    "provider": "gemini",
    "retryCount": 1,
    "reason": "invalid_short_reply"
  }
}
```

Gemini provider error response `502` or `503`:

```json
{
  "success": false,
  "message": "Coach đang hơi lag, thử lại sau nha.",
  "error": {
    "code": "AI_PROVIDER_ERROR"
  },
  "debug": {
    "provider": "gemini"
  }
}
```

### `PATCH /api/coach/urges/:urgeId`

Updates the result of a spending urge.

Request:

```json
{
  "userId": "test-user-1",
  "status": "DELAYED"
}
```

Response `200`:

```json
{
  "success": true,
  "message": "Spending urge updated",
  "data": {
    "urgeId": "urge_001",
    "status": "DELAYED",
    "xpGained": 50
  }
}
```

## Challenges

### `GET /api/challenges?userId=mock-user`

Lists active challenges.

Response `200`:

```json
{
  "success": true,
  "message": "Challenges retrieved",
  "data": {
    "items": [
      {
        "id": "challenge-1",
        "title": "Không uống trà sữa hôm nay",
        "description": "Skip bubble tea for today.",
        "rewardXp": 30,
        "bossDamage": 20,
        "difficulty": "easy",
        "status": "active"
      }
    ]
  }
}
```

### `POST /api/challenges/:challengeId/complete`

Marks a challenge as complete, grants XP, increases discipline, damages the boss, and removes the challenge from the active list.

Request:

```json
{
  "userId": "mock-user"
}
```

Response `200`:

```json
{
  "success": true,
  "message": "Challenge completed",
  "data": {
    "challenge": {
      "id": "challenge-1",
      "title": "Không uống trà sữa hôm nay",
      "description": "Skip bubble tea for today.",
      "rewardXp": 30,
      "bossDamage": 20,
      "difficulty": "easy",
      "status": "completed"
    },
    "progression": {
      "xpGained": 30,
      "totalXp": 30,
      "level": 1,
      "disciplineGained": 5,
      "discipline": 5
    },
    "boss": {
      "bossId": "impulse-boss",
      "name": "Impulse Boss",
      "currentHp": 80,
      "maxHp": 100
    }
  }
}
```

## Future / Post-demo: Reflections

Reflection is not part of the current demo API. Do not implement `POST /api/reflections`, `GET /api/reflections`, recent reflection dashboard data, or reflection XP rewards for the demo.
