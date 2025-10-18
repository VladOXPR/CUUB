// Centralized location management for CUUB battery rental stations
// This file contains all location data in one place for easy management

const locations = {
    'DTN00872': {
        id: 'DTN00872',
        name: 'DePaul LP Student Center',
        address: 'LP Student Center, 1st Floor, Chicago, IL',
        coordinates: [-87.65415, 41.92335]
    },
    'DTN00971': {
        id: 'DTN00971',
        name: 'DePaul University Loop',
        address: 'DePaul University Loop, Chicago, IL',
        coordinates: [-87.6298, 41.8776]
    },
    'DTN00970': {
        id: 'DTN00970',
        name: 'DePaul Theater School',
        address: 'Theater School, 1st Floor, Chicago, IL',
        coordinates: [-87.65875687443715, 41.92483761368347]
    },
    'BJH09881': {
        id: 'BJH09881',
        name: 'Parlay Lincoln Park',
        address: 'Parlay Lincoln Park, Chicago, IL',
        coordinates: [-87.65328, 41.92927]
    },
    'BJH09883': {
        id: 'BJH09883',
        name: "Kelly's Pub",
        address: "Kelly's Pub, Chicago, IL",
        coordinates: [-87.65298, 41.92158]
    },
    'DEMO_STATION_001': {
        id: 'DEMO_STATION_001',
        name: 'Demo Battery Station',
        address: '456 Demo Avenue, Chicago, IL',
        coordinates: [-87.6244, 41.8781]
    }
};

// Helper functions for location management
const locationManager = {
    // Get all location IDs
    getAllIds: () => Object.keys(locations),
    
    // Get all locations
    getAll: () => Object.values(locations),
    
    // Get a specific location by ID
    getById: (id) => locations[id],
    
    // Get locations formatted for map display
    getForMap: () => Object.values(locations).map(location => ({
        id: location.id,
        name: location.name,
        address: location.address,
        coordinates: location.coordinates
    })),
    
    // Get locations formatted for server API
    getForServer: () => Object.values(locations).map(location => ({
        id: location.id,
        name: location.name,
        coordinates: location.coordinates
    })),
    
    // Add a new location
    add: (id, locationData) => {
        locations[id] = {
            id,
            ...locationData
        };
    },
    
    // Remove a location
    remove: (id) => {
        delete locations[id];
    },
    
    // Update a location
    update: (id, locationData) => {
        if (locations[id]) {
            locations[id] = {
                ...locations[id],
                ...locationData
            };
        }
    }
};

module.exports = {
    locations,
    locationManager
};
