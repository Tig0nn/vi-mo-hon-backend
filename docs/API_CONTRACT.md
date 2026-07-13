# API Contract

This document defines the demo MVP REST contract. Keep this file updated whenever endpoint behavior changes.

The current demo API focuses on quick expense input, AI Anti-Regret Coach, profile personalization, local reminders, challenges, XP/stats, boss progress, and dashboard. Reflection is a future/post-demo feature only. AI provider calls are backend-only; clients must never call Gemini directly or receive provider secrets.

## User identity before authentication

On first launch, the client generates a stable device-scoped `userId` and stores it locally. Every user-scoped request must reuse that value after reloads; the API treats it as an opaque non-empty identifier. The client sends it only to the Express backend.

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

The normal error shape is `success`, `message`, and optional `errors` validation details. `POST /api/coach/chat` is the current documented exception: AI provider failures include `error.code` and optional safe `debug` metadata so the client can distinguish provider and invalid-response failures. Do not assume the `error` object is present for non-Coach errors.

## Error Semantics

- `400 Bad Request`: malformed input, validation failure, or missing required query params
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

Creates or updates a Supabase-backed user profile before authentication exists. The backend also ensures a `user_progress` row exists without resetting existing progress. The current controller always responds `201` with `"Profile created"`, including an update through this upsert path.

Request:

```json
{
  "userId": "vmh-device-generated-id",
  "displayName": "Minh",
  "monthlyBudget": 3000000,
  "mainGoal": "reduce_impulse_shopping",
  "targetAmount": 20000000,
  "targetDate": "2026-12-31",
  "triggers": ["friends", "flash_sale"],
  "preferredTone": "funny"
}
```

Rules:

- `userId` is a required trimmed, non-empty string.
- `displayName` is required, trimmed, non-empty, and at most 80 characters.
- `mainGoal` is required and must be one of `save_money`, `reduce_impulse_shopping`, `reduce_food_drink`, `reduce_sale_spending`, `emergency_fund`, or `other`.
- `monthlyBudget` and `targetAmount` are required positive integer VND amounts.
- `targetDate` is required, must use `YYYY-MM-DD`, must be a real calendar date, and must be in the future.
- `triggers` is required, must contain at least one canonical trigger code, and duplicate values are removed.
- `preferredTone` defaults to `funny`. Onboarding currently must not ask the user to choose it.

`monthlyBudget` is the planned maximum monthly spending amount, not income, current balance, or total assets. `targetAmount` is the amount the user wants to save or achieve.

Response `201`:

```json
{
  "success": true,
  "message": "Profile created",
  "data": {
    "id": "vmh-device-generated-id",
    "userId": "vmh-device-generated-id",
    "displayName": "Minh",
    "monthlyBudget": 3000000,
    "currency": "VND",
    "level": 1,
    "xp": 0,
    "discipline": 0,
    "mainGoal": "reduce_impulse_shopping",
    "targetAmount": 20000000,
    "targetDate": "2026-12-31",
    "triggers": ["friends", "flash_sale"],
    "preferredTone": "funny",
    "createdAt": "2026-07-07T00:00:00.000Z",
    "updatedAt": "2026-07-07T00:00:00.000Z"
  }
}
```

### `GET /api/profile/:userId`

Reads one Supabase-backed profile by user id. Missing profiles return `404`; this endpoint does not silently fall back to mock profile data. `currency` is a backend-computed compatibility field with the default value `"VND"`; it is not selected from the `profiles` table.

Response `200`:

```json
{
  "success": true,
  "message": "Profile retrieved",
  "data": {
    "userId": "vmh-device-generated-id",
    "displayName": "Minh",
    "monthlyBudget": 3000000,
    "currency": "VND",
    "level": 1,
    "xp": 40,
    "discipline": 0,
    "mainGoal": "reduce_impulse_shopping",
    "targetAmount": 20000000,
    "targetDate": "2026-12-31",
    "triggers": ["friends", "flash_sale"],
    "preferredTone": "funny"
  }
}
```

### `PATCH /api/profile/:userId`

Partially updates only supplied profile fields. Each supplied field follows the same validation rules as POST; omitted fields stay unchanged rather than becoming `null` or `undefined`. `userId` cannot be changed through this endpoint, an empty body returns `400`, and a missing profile returns `404`.

Request:

```json
{
  "displayName": "Minh Anh",
  "monthlyBudget": 3500000,
  "mainGoal": "reduce_impulse_shopping",
  "triggers": ["emotional_spending"],
  "preferredTone": "strict-but-kind"
}
```

Response `200`:

```json
{
  "success": true,
  "message": "Profile updated",
  "data": {
    "userId": "vmh-device-generated-id",
    "displayName": "Minh Anh",
    "monthlyBudget": 3500000,
    "currency": "VND",
    "level": 1,
    "xp": 40,
    "discipline": 0,
    "mainGoal": "reduce_impulse_shopping",
    "targetAmount": 20000000,
    "targetDate": "2026-12-31",
    "triggers": ["emotional_spending"],
    "preferredTone": "strict-but-kind"
  }
}
```
### Goal and trigger codes

The API may carry stable codes, but clients must map them to Vietnamese user-facing labels and never display raw codes as UI copy. Supported goal examples in this contract are `save_money`, `reduce_impulse_shopping`, `reduce_food_drink`, `reduce_sale_spending`, `emergency_fund`, and `other`.

Canonical trigger taxonomy:

| API code | User-facing label | Mapping intent |
| --- | --- | --- |
| `flash_sale` | Giảm giá hoặc voucher | Sale, deal, voucher, discount |
| `fomo` | Sợ bỏ lỡ | Trend, fear of missing out |
| `friends` | Bạn bè rủ rê | Bạn bè rủ, áp lực xã hội |
| `emotional_spending` | Chi tiêu theo cảm xúc | Căng thẳng, buồn, chán, mệt |
| `social_media` | Mạng xã hội | Nội dung quảng cáo hoặc người ảnh hưởng |
| `payday` | Vừa nhận lương | Có tiền về và muốn chi ngay |
| `social_comparison` | So sánh xã hội | Muốn mua để không thua kém người khác |
| `food_craving` | Thèm ăn uống | Thèm đồ ăn hoặc thức uống |
| `self_reward` | Tự thưởng | Muốn tự thưởng sau một việc |
| `other` | Lý do khác | Không khớp taxonomy trên |

Profile onboarding enforces these canonical trigger codes. Anti-Regret Coach currently has a narrower legacy enum; extending Coach to the full taxonomy requires a separate task.

## Expenses

Expense writes are persisted through a backend-only Supabase RPC so creating the expense and awarding its 5 XP succeed or fail together. List and dashboard reads come from `expenses`; API currency remains the computed value `VND`. Category inputs may be uppercase or lowercase canonical values, while responses preserve the existing uppercase convention.

### `POST /api/expenses/quick-input`

Creates an expense from a fast text or structured input, then updates XP progression.

Request:

```json
{
  "userId": "vmh-device-generated-id",
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

Dashboard data is Supabase-backed: profile/progress, current UTC-month expenses, up to five newest expenses, user boss progress, and active user challenges. It contains no Reflection data.

`activeChallenges` remains in the response for backward compatibility. At most one item is active. `todayChallenge` is the same active challenge with sequence metadata. After a challenge is completed, the next challenge is not assigned until the following `Asia/Ho_Chi_Minh` business day.

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
      "name": "Boss Trà Sữa",
      "currentHp": 80,
      "maxHp": 100,
      "status": "active",
      "completedChallenges": 1,
      "totalChallenges": 5
    },
    "todayChallenge": {
      "id": "challenge-2",
      "title": "Ghi lại mọi khoản mua đồ uống",
      "description": "Ghi lại mọi khoản tiền dùng để mua đồ uống.",
      "rewardXp": 30,
      "bossDamage": 20,
      "disciplineReward": 5,
      "difficulty": "easy",
      "sequenceOrder": 2,
      "assignedDate": "2026-07-14",
      "status": "active",
      "totalChallenges": 5
    },
    "nextChallengeAvailableOn": null,
    "challengeMessage": null,
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

When today's challenge has been completed and the boss is still active, dashboard returns:

```json
{
  "todayChallenge": null,
  "nextChallengeAvailableOn": "2026-07-14",
  "challengeMessage": "Đã hoàn thành thử thách hôm nay"
}
```

When the boss is defeated, dashboard returns `todayChallenge: null`, `nextChallengeAvailableOn: null`, and `challengeMessage: "Bạn đã đánh bại boss này"`.

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
- `trigger` is optional. When supplied, it must use the canonical trigger taxonomy above.
- If `trigger` is provided, the API uses it as `detectedTrigger`.
- `mode` is optional and can be `BEFORE_PURCHASE` or `AFTER_PURCHASE`.
- The user profile must already exist so the response can use `mainGoal`, `triggers`, and `preferredTone`.
- If `trigger` is omitted, `detectedTrigger` is selected from matching profile triggers first, then from the canonical mapping rules above.
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
    "coachMessage": "Món này đang hấp dẫn vì giảm giá. Hãy tạm dừng, xem lại nhu cầu và so với mục tiêu tiết kiệm trước khi quyết định.",
    "suggestedAction": "PAUSE_AND_REVIEW",
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
  "userId": "vmh-device-generated-id",
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
- Invalid Gemini output returns `502` with an `error.code` indicating an invalid AI response.
- Gemini provider failures return `502` or `503` with an `error.code` indicating a provider failure.

Response `200`:

```json
{
  "success": true,
  "message": "Coach chat response generated",
  "data": {
    "reply": "Đồng hồ 1 triệu là khoản không nhỏ, nhất là nếu bạn đang có mục tiêu tiết kiệm. Nếu lý do chính là sale, hãy tạm dừng và xem món này có thật sự cần ngay không. Nếu vẫn muốn mua, đặt trước một mức giá tối đa để tránh chốt vì cảm xúc sale.",
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
  "userId": "vmh-device-generated-id",
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

Active challenges and completion results are persisted. Completion is an atomic backend-only RPC operation: it can award XP/discipline and apply boss damage only once, and a repeated completion returns `409`.

### `GET /api/challenges?userId=mock-user`

Lists the user's single active challenge. An unfinished challenge remains active across business days. Items include `sequenceOrder`, `assignedDate`, and `disciplineReward`; the existing fields remain unchanged.

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
        "disciplineReward": 5,
        "difficulty": "easy",
        "sequenceOrder": 1,
        "assignedDate": "2026-07-13",
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
      "disciplineReward": 5,
      "difficulty": "easy",
      "sequenceOrder": 1,
      "assignedDate": "2026-07-13",
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

## Planned / Final MVP Milestone: Remote Push Notifications

Remote push notifications are a planned final MVP milestone, not part of the current API. The following endpoint names are provisional and must not be implemented in this docs-only task:

- `POST /api/notifications/register-device`
- `PATCH /api/notifications/preferences/:userId`
- `POST /api/notifications/test`

An Expo push token or device token must be sent to the Express backend. The frontend must not hold backend notification credentials. The backend will be responsible for storing tokens and sending notifications when this milestone begins.
