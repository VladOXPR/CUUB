# Location Management API Endpoints

## Overview
The CUUB battery rental system now includes API endpoints for managing station locations. These endpoints require API key authentication.

## Production Domain
- **Production URL**: `https://battery.cuub.tech`
- **Local Development**: `http://localhost:3000`

## Authentication
- **API Key**: `cuubisgoated123`
- **Header**: Include the API key in the request header as `x-api-key` or `api-key`

## Endpoints

### 1. Get All Locations
**GET** `/api/locations`

Returns all available locations (no authentication required).

**Response:**
```json
[
  {
    "id": "DTN00872",
    "name": "DePaul LP Student Center",
    "address": "LP Student Center, 1st Floor, Chicago, IL",
    "coordinates": [-87.65415, 41.92335]
  }
]
```

### 2. Add New Location
**POST** `/api/locations`

Adds a new station location (authentication required).

**Headers:**
- `Content-Type: application/json`
- `x-api-key: cuubisgoated123`

**Request Body:**
```json
{
  "id": "UNIQUE_STATION_ID",
  "name": "Station Display Name",
  "address": "Full address, City, State",
  "coordinates": [longitude, latitude]
}
```

**Success Response (201):**
```json
{
  "message": "Location added successfully",
  "location": {
    "id": "UNIQUE_STATION_ID",
    "name": "Station Display Name",
    "address": "Full address, City, State",
    "coordinates": [longitude, latitude]
  }
}
```

**Error Responses:**
- `400` - Missing required fields
- `401` - API key required
- `403` - Invalid API key
- `409` - Location ID already exists
- `500` - Internal server error

### 3. Remove Location
**DELETE** `/api/locations/:id`

Removes a station location (authentication required).

**Headers:**
- `x-api-key: cuubisgoated123`

**URL Parameters:**
- `id` - The station ID to remove

**Success Response (200):**
```json
{
  "message": "Location 'STATION_ID' removed successfully"
}
```

**Error Responses:**
- `401` - API key required
- `403` - Invalid API key
- `404` - Location not found
- `500` - Internal server error

## Usage Examples

### Add a New Location (Local Development)
```bash
curl -X POST http://localhost:3000/api/locations \
  -H "Content-Type: application/json" \
  -H "x-api-key: cuubisgoated123" \
  -d '{
    "id": "NEW001",
    "name": "New Battery Station",
    "address": "123 Main St, Chicago, IL",
    "coordinates": [-87.6298, 41.8781]
  }'
```

### Add a New Location (Production)
```bash
curl -X POST https://battery.cuub.tech/api/locations \
  -H "Content-Type: application/json" \
  -H "x-api-key: cuubisgoated123" \
  -d '{
    "id": "NEW001",
    "name": "New Battery Station",
    "address": "123 Main St, Chicago, IL",
    "coordinates": [-87.6298, 41.8781]
  }'
```

### Remove a Location (Local Development)
```bash
curl -X DELETE http://localhost:3000/api/locations/NEW001 \
  -H "x-api-key: cuubisgoated123"
```

### Remove a Location (Production)
```bash
curl -X DELETE https://battery.cuub.tech/api/locations/NEW001 \
  -H "x-api-key: cuubisgoated123"
```

### Get All Locations (Local Development)
```bash
curl http://localhost:3000/api/locations
```

### Get All Locations (Production)
```bash
curl https://battery.cuub.tech/api/locations
```

## Field Requirements

### Required Fields for Adding Locations:
- `id` - Unique identifier (string)
- `name` - Display name (string)
- `address` - Full address (string)
- `coordinates` - Array with exactly 2 numbers [longitude, latitude]

### Coordinate Format:
- First element: Longitude (west/east position)
- Second element: Latitude (north/south position)
- Example: `[-87.6298, 41.8781]` for Chicago

## Notes
- Location changes are immediately reflected across the entire application
- The system validates coordinate format and required fields
- Duplicate IDs are not allowed
- All endpoints return JSON responses
