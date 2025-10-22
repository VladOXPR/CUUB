// Centralized location management for CUUB battery rental stations
// This file contains all location data in one place for easy management

const locations = {
    'DTN00872': {
        id: 'DTN00872',
        name: 'DePaul LP Student Center',
        address: 'LP Student Center, 1st Floor, Chicago, IL',
        coordinates: [-87.65415, 41.92335],
        hours: {
            monday: { open: '08:00', close: '22:00' },
            tuesday: { open: '08:00', close: '22:00' },
            wednesday: { open: '08:00', close: '22:00' },
            thursday: { open: '08:00', close: '22:00' },
            friday: { open: '08:00', close: '22:00' },
            saturday: { open: '10:00', close: '20:00' },
            sunday: { open: '10:00', close: '20:00' }
        }
    },
    'DTN00971': {
        id: 'DTN00971',
        name: 'DePaul University Loop',
        address: 'DePaul University Loop, Chicago, IL',
        coordinates: [-87.6298, 41.8776],
        hours: {
            monday: { open: '08:00', close: '22:00' },
            tuesday: { open: '08:00', close: '22:00' },
            wednesday: { open: '08:00', close: '22:00' },
            thursday: { open: '08:00', close: '22:00' },
            friday: { open: '08:00', close: '22:00' },
            saturday: { open: '10:00', close: '20:00' },
            sunday: { open: '10:00', close: '20:00' }
        }
    },
    'DTN00970': {
        id: 'DTN00970',
        name: 'DePaul Theater School',
        address: 'Theater School, 1st Floor, Chicago, IL',
        coordinates: [-87.65875687443715, 41.92483761368347],
        hours: {
            monday: { open: '08:00', close: '22:00' },
            tuesday: { open: '08:00', close: '22:00' },
            wednesday: { open: '08:00', close: '22:00' },
            thursday: { open: '08:00', close: '22:00' },
            friday: { open: '08:00', close: '22:00' },
            saturday: { open: '10:00', close: '20:00' },
            sunday: { open: '10:00', close: '20:00' }
        }
    },
    'BJH09881': {
        id: 'BJH09881',
        name: 'Parlay Lincoln Park',
        address: 'Parlay Lincoln Park, Chicago, IL',
        coordinates: [-87.65328, 41.92927],
        hours: {
            monday: { open: '11:00', close: '02:00' },
            tuesday: { open: '11:00', close: '02:00' },
            wednesday: { open: '11:00', close: '02:00' },
            thursday: { open: '11:00', close: '02:00' },
            friday: { open: '11:00', close: '02:00' },
            saturday: { open: '11:00', close: '02:00' },
            sunday: { open: '11:00', close: '02:00' }
        }
    },
    'BJH09883': {
        id: 'BJH09883',
        name: "Kelly's Pub",
        address: "Kelly's Pub, Chicago, IL",
        coordinates: [-87.65298, 41.92158],
        hours: {
            monday: { open: '11:00', close: '02:00' },
            tuesday: { open: '11:00', close: '02:00' },
            wednesday: { open: '11:00', close: '02:00' },
            thursday: { open: '11:00', close: '02:00' },
            friday: { open: '11:00', close: '03:00' },
            saturday: { open: '11:00', close: '03:00' },
            sunday: { open: '11:00', close: '02:00' }
        }
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
        coordinates: location.coordinates,
        hours: location.hours
    })),
    
    // Get locations formatted for server API
    getForServer: () => Object.values(locations).map(location => ({
        id: location.id,
        name: location.name,
        coordinates: location.coordinates,
        hours: location.hours
    })),
    
    // Check if a location is currently open
    isOpen: (id) => {
        const location = locations[id];
        if (!location || !location.hours) return true; // Default to open if no hours specified
        
        const now = new Date();
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const currentDay = dayNames[now.getDay()];
        const todayHours = location.hours[currentDay];
        
        if (!todayHours || !todayHours.open || !todayHours.close) return true;
        
        const currentTime = now.getHours() * 60 + now.getMinutes();
        const [openHour, openMin] = todayHours.open.split(':').map(Number);
        const [closeHour, closeMin] = todayHours.close.split(':').map(Number);
        
        let openTime = openHour * 60 + openMin;
        let closeTime = closeHour * 60 + closeMin;
        
        // Handle cases where closing time is after midnight (e.g., 02:00)
        if (closeTime < openTime) {
            // Location closes after midnight
            return currentTime >= openTime || currentTime < closeTime;
        }
        
        return currentTime >= openTime && currentTime < closeTime;
    },
    
    // Get formatted hours string for display
    getHoursDisplay: (id, day = null) => {
        const location = locations[id];
        if (!location || !location.hours) return 'Hours not available';
        
        const now = new Date();
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const currentDay = day || dayNames[now.getDay()];
        const todayHours = location.hours[currentDay];
        
        if (!todayHours) return 'Closed';
        
        return `${todayHours.open} - ${todayHours.close}`;
    },
    
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
