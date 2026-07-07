# API Contract

This document defines the MVP REST contract. Keep this file updated whenever endpoint behavior changes.

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
  "currency": "VND"
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
    "xp": 40
  }
}
```

### `PATCH /api/profile/:userId`

Partially updates profile fields. Omitted fields stay unchanged.

Request:

```json
{
  "displayName": "Minh Anh",
  "monthlyBudget": 3500000
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
    "xp": 40
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

Returns the main home/dashboard state for the mobile app. In the first backend slice, boss progress means the initial boss state shown in this dashboard response. Challenge completion is not required yet.

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
      "monthlyBudget": 3000000,
      "monthlySpent": 55000
    },
    "boss": {
      "bossId": "impulse-boss",
      "name": "Impulse Boss",
      "currentHp": 100,
      "maxHp": 100
    },
    "recentExpenses": [],
    "activeChallenges": []
  }
}
```

## Anti-Regret Coach

### `POST /api/coach/anti-regret`

Creates a spending urge and returns a short coaching response before or after a purchase. Start rule-based; switch to AI only after the flow works.

Request:

```json
{
  "userId": "mock-user",
  "itemName": "new headphones",
  "amount": 1200000,
  "reason": "I saw a discount",
  "mode": "BEFORE_PURCHASE"
}
```

Response `200`:

```json
{
  "success": true,
  "message": "Coach response generated",
  "data": {
    "urgeId": "urge_001",
    "riskLevel": "MEDIUM",
    "coachMessage": "Wait 24 hours and compare this purchase with your monthly goal.",
    "suggestedAction": "WAIT_24_HOURS"
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

## Reflections

### `POST /api/reflections`

Creates a short post-purchase reflection.

Request:

```json
{
  "userId": "mock-user",
  "expenseId": "expense_001",
  "mood": "REGRET",
  "note": "I bought it too quickly."
}
```

Response `201`:

```json
{
  "success": true,
  "message": "Reflection created",
  "data": {
    "id": "reflection_001",
    "userId": "mock-user",
    "expenseId": "expense_001",
    "mood": "REGRET",
    "note": "I bought it too quickly.",
    "createdAt": "2026-07-07T00:00:00.000Z"
  }
}
```

### `GET /api/reflections?userId=mock-user&page=1&pageSize=20`

Lists reflections for a user.

## Challenges

Challenge endpoints are planned for a later slice. Do not implement challenge completion in the first backend slice.

### `GET /api/challenges?userId=mock-user`

Lists active challenges.

### `POST /api/challenges/:challengeId/complete`

Marks a challenge as complete and grants XP.

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
    "challengeId": "challenge_001",
    "xpGained": 30,
    "totalXp": 80
  }
}
```
