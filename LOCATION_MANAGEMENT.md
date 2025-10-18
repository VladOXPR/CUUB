# Location Management System

## Overview
The location management system has been centralized to make it easy to add, remove, or modify battery rental station locations. All location data is now stored in a single file: `locations.js`.

## How to Add a New Location

1. Open `locations.js`
2. Add a new entry to the `locations` object:

```javascript
const locations = {
    // ... existing locations ...
    'NEW_STATION_ID': {
        id: 'NEW_STATION_ID',
        name: 'Station Display Name',
        address: 'Full address, City, State',
        coordinates: [longitude, latitude]  // Note: longitude first, then latitude
    }
};
```

3. Save the file - no other changes needed!

## How to Remove a Location

1. Open `locations.js`
2. Delete the entire entry for the station you want to remove
3. Save the file - the location will be automatically removed from all parts of the application

## How to Update a Location

1. Open `locations.js`
2. Modify the fields you want to change (name, address, coordinates)
3. Save the file - changes will be reflected everywhere automatically

## Location Data Structure

Each location entry contains:
- `id`: Unique identifier for the station (used in API calls)
- `name`: Display name shown to users
- `address`: Full address for the location
- `coordinates`: [longitude, latitude] array for map positioning

## Files That Use Location Data

The centralized location data is automatically used by:
- `server.js` - API endpoints for stations and locations
- `public/map.html` - Interactive map display
- `public/index-backup.html` - Backup interface

## API Endpoints

- `GET /api/locations` - Returns all location data formatted for frontend use
- `GET /api/stations` - Returns station data with location information included

## Helper Functions

The `locationManager` object provides these utility functions:
- `getAllIds()` - Get array of all station IDs
- `getAll()` - Get array of all location objects
- `getById(id)` - Get specific location by ID
- `getForMap()` - Get locations formatted for map display
- `getForServer()` - Get locations formatted for server API
- `add(id, data)` - Add a new location
- `remove(id)` - Remove a location
- `update(id, data)` - Update an existing location

## Example Usage

```javascript
const { locationManager } = require('./locations.js');

// Get all station IDs
const stationIds = locationManager.getAllIds();

// Get a specific location
const location = locationManager.getById('DTN00872');

// Add a new location
locationManager.add('NEW001', {
    name: 'New Station',
    address: '123 Main St, Chicago, IL',
    coordinates: [-87.6298, 41.8781]
});
```
