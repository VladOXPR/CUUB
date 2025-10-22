# API Requirements for New Battery Rental Supplier

## Overview
This document outlines all the API endpoints and functionality your new supplier needs to provide to replace the current ChargeNow API integration.

---

## Current API Usage Summary

Your application currently uses **2 main API endpoints** from ChargeNow:

1. **Station/Cabinet Query** - Get real-time availability data
2. **Battery Order List** - Get rental/order information

---

## Required API Endpoints

### 1. Station/Cabinet Status Query

**Purpose**: Get real-time information about battery stations (charging cabinets)

**Current ChargeNow Endpoint**:
```
GET https://developer.chargenow.top/cdb-open-api/v1/rent/cabinet/query?deviceId={stationId}
```

#### **What We Need from New Supplier:**

**Endpoint**: Query station status by station/device ID

**Request Parameters**:
- `deviceId` or `stationId` - Unique identifier for the station

**Required Response Data**:
```json
{
  "stationId": "DTN00872",
  "emptySlots": 5,        // Available slots for battery returns
  "busySlots": 3,         // Occupied slots with batteries
  "totalSlots": 8,        // Total slots in the station
  "status": "online",     // Station operational status
  "lastUpdated": "2024-10-15T10:30:00Z"
}
```

**Key Fields Needed**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `stationId` | string | ✅ Yes | Unique station identifier |
| `emptySlots` | number | ✅ Yes | Number of available slots |
| `busySlots` | number | ✅ Yes | Number of occupied slots |
| `totalSlots` | number | ⚠️ Optional | Total capacity (can calculate from empty + busy) |
| `status` | string | ⚠️ Optional | Online/offline/maintenance status |
| `lastUpdated` | timestamp | ⚠️ Optional | Last update time |

**Usage in App**:
- Displays available battery slots on map
- Shows station capacity in real-time
- Polled every 30 seconds in background
- Used in `/api/stations` endpoint

---

### 2. Battery Order/Rental List

**Purpose**: Get list of all battery rentals/orders to track individual battery status

**Current ChargeNow Endpoint**:
```
GET https://developer.chargenow.top/cdb-open-api/v1/order/list?page=1&limit=100
```

#### **What We Need from New Supplier:**

**Endpoint**: Get list of battery rentals/orders with pagination

**Request Parameters**:
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 100)

**Required Response Data**:
```json
{
  "data": [
    {
      "batteryId": "FECB06E557",
      "orderId": "ORD123456",
      "borrowTime": "2024-10-15T10:30:00Z",
      "returnTime": null,
      "status": "borrowed",
      "stationId": "DTN00872"
    }
  ],
  "pagination": {
    "current": 1,
    "size": 100,
    "total": 245,
    "pages": 3
  }
}
```

**Key Fields Needed**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `batteryId` | string | ✅ Yes | Unique battery identifier |
| `orderId` | string | ⚠️ Optional | Order/rental ID |
| `borrowTime` | timestamp | ✅ Yes | When battery was borrowed |
| `returnTime` | timestamp | ✅ Yes | When battery was returned (null if still borrowed) |
| `status` | string | ⚠️ Optional | borrowed/returned/maintenance |
| `stationId` | string | ⚠️ Optional | Where battery was borrowed from |

**Pagination Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `current` | number | ✅ Yes | Current page number |
| `size` | number | ✅ Yes | Results per page |
| `total` | number | ✅ Yes | Total number of records |
| `pages` | number | ⚠️ Optional | Total pages (can calculate) |

**Usage in App**:
- Track individual battery rental status
- Display rental duration to users
- Calculate rental costs
- Polled every 60 seconds in background
- Used in `/api/battery/:batteryId` endpoint

---

## Additional API Features Needed

### 3. Authentication

**Current Method**: Basic Authentication with username/password

**Required from New Supplier**:
- Authentication method (Basic Auth, API Key, OAuth, JWT, etc.)
- Credentials or API keys
- Authentication header format
- Token refresh mechanism (if applicable)

**Example Formats**:
```javascript
// Option 1: Basic Auth
headers: {
  "Authorization": "Basic [base64_encoded_credentials]"
}

// Option 2: API Key
headers: {
  "X-API-Key": "your_api_key_here"
}

// Option 3: Bearer Token
headers: {
  "Authorization": "Bearer your_token_here"
}
```

---

### 4. Rate Limiting Information

**What We Need to Know**:
- Maximum requests per second/minute/hour
- Rate limit headers in responses
- What happens when limit is exceeded
- Recommended polling intervals

**Our Current Usage**:
- Station data: Poll every 30 seconds (2 requests/minute)
- Battery orders: Poll every 60 seconds (1 request/minute)
- On-demand queries: ~10-50 per hour depending on traffic

---

### 5. Error Handling

**Required Error Response Format**:
```json
{
  "error": true,
  "code": "ERROR_CODE",
  "message": "Human readable error message",
  "timestamp": "2024-10-15T10:30:00Z"
}
```

**HTTP Status Codes to Use**:
- `200` - Success
- `400` - Bad request (invalid parameters)
- `401` - Unauthorized (authentication failed)
- `404` - Not found (station/battery not found)
- `429` - Too many requests (rate limit exceeded)
- `500` - Server error
- `503` - Service unavailable

---

### 6. API Health/Status Endpoint

**Purpose**: Check if API is operational

**Recommended Endpoint**:
```
GET /api/health or /api/status
```

**Response**:
```json
{
  "status": "ok",
  "version": "1.0",
  "timestamp": "2024-10-15T10:30:00Z"
}
```

**Usage**: We check health on server startup before beginning background polling

---

## Optional but Recommended Endpoints

### 7. Single Battery Query (Optional)

**Purpose**: Get specific battery information directly without searching through order list

**Recommended Endpoint**:
```
GET /api/battery/{batteryId}
```

**Benefit**: Faster than searching through entire order list

---

### 8. Bulk Station Query (Optional)

**Purpose**: Get multiple station statuses in one request

**Recommended Endpoint**:
```
POST /api/stations/bulk
Body: {
  "stationIds": ["DTN00872", "DTN00971", "BJH09881"]
}
```

**Benefit**: Reduces number of API calls from 5 to 1

**Current Behavior**: We make 5 parallel requests for 5 stations

---

### 9. Webhooks/Real-time Updates (Optional)

**Purpose**: Push notifications for status changes instead of polling

**Options**:
- Webhooks for battery return events
- WebSocket connection for real-time data
- Server-Sent Events (SSE)

**Benefit**: Eliminates need for constant polling, reduces API calls by 90%

---

## Technical Requirements

### Request Format
- **Method**: GET (for queries) or POST (for bulk operations)
- **Content-Type**: `application/json`
- **Encoding**: UTF-8
- **Timeout**: Should respond within 5 seconds

### Response Format
- **Content-Type**: `application/json`
- **Encoding**: UTF-8
- **Compression**: GZIP support recommended

### Security Requirements
- **HTTPS**: All endpoints must use HTTPS
- **CORS**: Allow requests from our domain
- **Authentication**: Secure credential management

---

## Data Mapping Guide

Your new supplier will need to provide data that maps to these fields:

### Station Data Mapping
| Our Field | ChargeNow Field | New Supplier Needs to Provide |
|-----------|-----------------|-------------------------------|
| `id` | `deviceId` | Station unique identifier |
| `available` | `emptySlots` | Available battery slots |
| `occupied` | `busySlots` | Occupied battery slots |

### Battery Order Data Mapping
| Our Field | ChargeNow Field | New Supplier Needs to Provide |
|-----------|-----------------|-------------------------------|
| Battery ID | `pBatteryid` | Battery unique identifier |
| Borrow Time | `pBorrowtime` | Rental start timestamp |
| Return Time | `pGhtime` | Rental end timestamp (null if active) |

---

## Testing Requirements

### What We Need for Testing

1. **Test API Endpoint/Environment**
   - Sandbox/staging API URL
   - Test credentials
   - Test station IDs
   - Test battery IDs

2. **Test Data**
   - At least 3 test stations
   - Mix of available/occupied slots
   - Sample battery orders (active and completed)

3. **Documentation**
   - API endpoint URLs
   - Authentication details
   - Request/response examples
   - Error code reference

---

## Integration Timeline

### Phase 1: Testing (Week 1)
- Receive API documentation
- Test endpoints in sandbox
- Verify data structure
- Test authentication

### Phase 2: Development (Week 2)
- Update `chargenowApi.js` to use new API
- Adjust data mapping
- Update authentication
- Test all functions

### Phase 3: Deployment (Week 3)
- Test in production with real data
- Monitor for issues
- Fine-tune polling intervals
- Optimize performance

---

## Critical Questions for New Supplier

### Must Answer Before Integration:

1. **What is your API base URL?**
   - Production: `https://api.newsupplier.com/v1`
   - Staging: `https://sandbox.api.newsupplier.com/v1`

2. **What authentication method do you use?**
   - Example: API Key, OAuth 2.0, JWT

3. **What are your rate limits?**
   - Requests per minute/hour
   - Consequences of exceeding limits

4. **What are the exact endpoint URLs for:**
   - Station status query
   - Battery order list
   - Health check (if available)

5. **What is your response data structure?**
   - Provide JSON examples
   - Field names and types
   - Nested structure

6. **How do you handle pagination?**
   - Page-based or cursor-based
   - Maximum results per page

7. **What timezone are timestamps in?**
   - UTC, local time, or other

8. **Do you provide webhooks or real-time updates?**
   - If yes, how to set up

9. **What is your API versioning strategy?**
   - How do you handle breaking changes

10. **What support do you provide?**
    - Documentation
    - Technical support contact
    - SLA/uptime guarantee

---

## API Specification Template for Supplier

Please fill out and provide this information:

```markdown
### Station Status Query

**Endpoint**: [URL]
**Method**: [GET/POST]
**Authentication**: [Method]

**Request**:
- Parameters: [List]
- Headers: [List]
- Example: [Provide curl command]

**Response**:
- Status Code: [200]
- Body: [JSON structure]
- Example: [Actual example response]

**Error Responses**:
- [List error codes and meanings]

### Battery Order List

**Endpoint**: [URL]
**Method**: [GET/POST]
**Authentication**: [Method]

**Request**:
- Parameters: [List]
- Headers: [List]
- Example: [Provide curl command]

**Response**:
- Status Code: [200]
- Body: [JSON structure]
- Example: [Actual example response]

**Error Responses**:
- [List error codes and meanings]
```

---

## Files to Update After Integration

When switching to new supplier, these files need updates:

1. **`chargenowApi.js`** - Main API module
   - Update base URL
   - Update authentication
   - Update data parsing
   - Update field mappings

2. **`server.js`** - Minimal changes
   - Import statement (if renaming module)
   - Possibly polling intervals

3. **Environment Variables** (if using)
   - API credentials
   - Base URL

4. **Documentation**
   - API documentation
   - Update supplier name

---

## Summary Checklist

Before integration can begin, ensure new supplier provides:

- ✅ API base URL (production and staging)
- ✅ Authentication credentials and method
- ✅ Endpoint for station status (with examples)
- ✅ Endpoint for battery orders (with examples)
- ✅ Response data structure documentation
- ✅ Error codes and handling
- ✅ Rate limits and restrictions
- ✅ Test environment access
- ✅ Sample test data
- ✅ Technical support contact
- ✅ API health/status endpoint (recommended)
- ✅ Pagination details
- ✅ Timestamp format and timezone

---

## Contact Information

When sending this document to your new supplier, include:

**Current Usage Statistics**:
- Number of stations: 5 (expandable)
- API calls per hour: ~90-120
- Peak usage: Business hours (9 AM - 6 PM)
- Geographic location: Chicago, IL, USA
- Expected growth: +2-3 stations per month

**Technical Contact**:
- Your name/email for technical questions
- Timeline expectations
- Priority level

---

## Appendix: Current API Examples

### Example 1: ChargeNow Station Query

**Request**:
```bash
curl https://developer.chargenow.top/cdb-open-api/v1/rent/cabinet/query?deviceId=DTN00872 \
  -H "Authorization: Basic [credentials]" \
  -H "Content-Type: application/json"
```

**Response**:
```json
{
  "data": {
    "cabinet": {
      "emptySlots": 5,
      "busySlots": 3,
      "totalSlots": 8,
      "deviceId": "DTN00872"
    }
  }
}
```

### Example 2: ChargeNow Order List

**Request**:
```bash
curl https://developer.chargenow.top/cdb-open-api/v1/order/list?page=1&limit=100 \
  -H "Authorization: Basic [credentials]" \
  -H "Content-Type: application/json"
```

**Response**:
```json
{
  "page": {
    "records": [
      {
        "pBatteryid": "FECB06E557",
        "pBorrowtime": "2024-10-15T10:30:00.000+08:00",
        "pGhtime": null,
        "pOrderno": "ORD123456"
      }
    ],
    "current": 1,
    "size": 100,
    "total": 245,
    "pages": 3
  }
}
```

---

**Document Version**: 1.0  
**Last Updated**: October 2025  
**Author**: CUUB Battery Rental System
