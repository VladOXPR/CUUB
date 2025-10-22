# Station Management API Documentation

## Overview
This API allows you to manage battery rental station locations. All endpoints require JSON content type and return JSON responses.

**Base URL**: `http://your-domain.com/api/admin/stations`

---

## Endpoints

### 1. Get All Stations

Retrieve a list of all deployed stations.

**Endpoint**: `GET /api/admin/stations`

**Request**:
```bash
curl http://localhost:3000/api/admin/stations
```

**Response**: `200 OK`
```json
[
  {
    "id": "DTN00872",
    "name": "DePaul LP Student Center",
    "address": "LP Student Center, 1st Floor, Chicago, IL",
    "coordinates": [-87.65415, 41.92335]
  },
  {
    "id": "DTN00971",
    "name": "DePaul University Loop",
    "address": "DePaul University Loop, Chicago, IL",
    "coordinates": [-87.6298, 41.8776]
  }
]
```

---

### 2. Add New Station

Create a new station location.

**Endpoint**: `POST /api/admin/stations`

**Headers**:
- `Content-Type: application/json`

**Request Body**:
```json
{
  "id": "DTN00873",
  "name": "New Station Name",
  "address": "123 Main Street, Chicago, IL",
  "coordinates": [-87.6500, 41.9000]
}
```

**Field Descriptions**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier for the station (e.g., DTN00873, BJH09884) |
| `name` | string | Yes | Display name for the station |
| `address` | string | Yes | Full address including city and state |
| `coordinates` | array[number] | Yes | [longitude, latitude] - Note: longitude first, then latitude |

**cURL Example**:
```bash
curl -X POST http://localhost:3000/api/admin/stations \
  -H "Content-Type: application/json" \
  -d '{
    "id": "DTN00873",
    "name": "DePaul New Building",
    "address": "456 University Ave, Chicago, IL 60614",
    "coordinates": [-87.6550, 41.9100]
  }'
```

**JavaScript Example**:
```javascript
const response = await fetch('http://localhost:3000/api/admin/stations', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    id: 'DTN00873',
    name: 'DePaul New Building',
    address: '456 University Ave, Chicago, IL 60614',
    coordinates: [-87.6550, 41.9100]
  })
});

const result = await response.json();
console.log(result);
```

**Success Response**: `201 Created`
```json
{
  "message": "Station added successfully",
  "station": {
    "id": "DTN00873",
    "name": "DePaul New Building",
    "address": "456 University Ave, Chicago, IL 60614",
    "coordinates": [-87.6550, 41.9100]
  }
}
```

**Error Responses**:

`400 Bad Request` - Missing required fields:
```json
{
  "error": "Missing required fields: id, name, address, coordinates"
}
```

`400 Bad Request` - Invalid coordinates format:
```json
{
  "error": "Coordinates must be an array with [longitude, latitude]"
}
```

`409 Conflict` - Station ID already exists:
```json
{
  "error": "Station with this ID already exists"
}
```

---

### 3. Update Station

Update an existing station's information.

**Endpoint**: `PUT /api/admin/stations/:id`

**URL Parameters**:
- `id` (required): The station ID to update

**Headers**:
- `Content-Type: application/json`

**Request Body** (all fields optional):
```json
{
  "name": "Updated Station Name",
  "address": "789 New Address, Chicago, IL",
  "coordinates": [-87.6600, 41.9200]
}
```

**cURL Example**:
```bash
curl -X PUT http://localhost:3000/api/admin/stations/DTN00873 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "DePaul Updated Name",
    "address": "789 New Street, Chicago, IL 60614"
  }'
```

**JavaScript Example**:
```javascript
const response = await fetch('http://localhost:3000/api/admin/stations/DTN00873', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'DePaul Updated Name',
    address: '789 New Street, Chicago, IL 60614'
  })
});

const result = await response.json();
console.log(result);
```

**Success Response**: `200 OK`
```json
{
  "message": "Station updated successfully",
  "station": {
    "id": "DTN00873",
    "name": "DePaul Updated Name",
    "address": "789 New Street, Chicago, IL 60614",
    "coordinates": [-87.6550, 41.9100]
  }
}
```

**Error Responses**:

`404 Not Found` - Station doesn't exist:
```json
{
  "error": "Station not found"
}
```

`400 Bad Request` - Invalid coordinates format:
```json
{
  "error": "Coordinates must be an array with [longitude, latitude]"
}
```

---

### 4. Delete Station

Remove a station from the system.

**Endpoint**: `DELETE /api/admin/stations/:id`

**URL Parameters**:
- `id` (required): The station ID to delete

**cURL Example**:
```bash
curl -X DELETE http://localhost:3000/api/admin/stations/DTN00873
```

**JavaScript Example**:
```javascript
const response = await fetch('http://localhost:3000/api/admin/stations/DTN00873', {
  method: 'DELETE'
});

const result = await response.json();
console.log(result);
```

**Success Response**: `200 OK`
```json
{
  "message": "Station deleted successfully"
}
```

**Error Response**:

`404 Not Found` - Station doesn't exist:
```json
{
  "error": "Station not found"
}
```

---

## Coordinate Format

**Important**: Coordinates must be provided as `[longitude, latitude]` in that order.

- **Longitude** comes first (horizontal position, -180 to 180)
- **Latitude** comes second (vertical position, -90 to 90)

**Example for Chicago**:
```json
"coordinates": [-87.6298, 41.8776]
```
- Longitude: -87.6298 (West)
- Latitude: 41.8776 (North)

### Finding Coordinates

You can find coordinates for a location using:
1. **Google Maps**: Right-click on a location → Click the coordinates
2. **Apple Maps**: Right-click on a location → Copy Coordinates
3. **Online Tools**: https://www.latlong.net/

---

## Complete Workflow Example

### Adding a New Station (Complete Process)

1. **Get current stations** to check for conflicts:
```bash
curl http://localhost:3000/api/admin/stations
```

2. **Add the new station**:
```bash
curl -X POST http://localhost:3000/api/admin/stations \
  -H "Content-Type: application/json" \
  -d '{
    "id": "BJH09884",
    "name": "Lincoln Park Library",
    "address": "1150 W Fullerton Ave, Chicago, IL 60614",
    "coordinates": [-87.6570, 41.9250]
  }'
```

3. **Verify the station was added**:
```bash
curl http://localhost:3000/api/admin/stations
```

### Deleting a Station (Complete Process)

1. **Check current stations**:
```bash
curl http://localhost:3000/api/admin/stations
```

2. **Delete the station**:
```bash
curl -X DELETE http://localhost:3000/api/admin/stations/BJH09884
```

3. **Confirm deletion**:
```bash
curl http://localhost:3000/api/admin/stations
```

---

## Error Handling

All errors follow this format:
```json
{
  "error": "Error message description"
}
```

### Common HTTP Status Codes:
- `200 OK` - Request successful
- `201 Created` - Station created successfully
- `400 Bad Request` - Invalid request data
- `404 Not Found` - Station not found
- `409 Conflict` - Station ID already exists
- `500 Internal Server Error` - Server error

---

## Best Practices

1. **Always validate coordinates** before submitting
2. **Use unique Station IDs** - Check existing stations first
3. **Include full addresses** with city and state
4. **Test in development** before production changes
5. **Backup location data** before bulk deletions

---

## Integration Notes

### Automatic Updates
When you add, update, or delete a station via the API:
- ✅ Changes are immediately reflected in the centralized `locations.js`
- ✅ Map displays update automatically on next load
- ✅ Station lists refresh across all pages
- ✅ No manual configuration needed

### Web Interface
You can also manage stations through the Admin Dashboard:
- Visit: `http://localhost:3000/admin.html`
- Scroll to "Station Management" section
- Use the visual interface to add/edit/delete stations

---

## Rate Limiting

Currently, there are no rate limits on these endpoints. However, it's recommended to:
- Batch station updates when possible
- Avoid rapid successive API calls
- Implement client-side throttling for production use

---

## Support

For issues or questions about the Station Management API:
1. Check this documentation first
2. Review `LOCATION_MANAGEMENT.md` for system architecture
3. Verify your request format matches the examples
4. Check server logs for detailed error messages

---

## Version

**API Version**: 1.0  
**Last Updated**: October 2025  
**Base System**: Centralized Location Management System
