# Deployment Notes for battery.cuub.tech

## Production API Endpoints

The centralized location management system is now deployed and ready for use on the production domain.

### API Base URL
- **Production**: `https://battery.cuub.tech`
- **Local Development**: `http://localhost:3000`

### Key Endpoints
- `GET https://battery.cuub.tech/api/locations` - Get all locations
- `POST https://battery.cuub.tech/api/locations` - Add new location
- `DELETE https://battery.cuub.tech/api/locations/:id` - Remove location

### Authentication
- **API Key**: `cuubisgoated123`
- **Header**: `x-api-key: cuubisgoated123`

### Testing Production API

You can test the production API using:

```bash
# Test production API
curl https://battery.cuub.tech/api/locations

# Add location to production
curl -X POST https://battery.cuub.tech/api/locations \
  -H "Content-Type: application/json" \
  -H "x-api-key: cuubisgoated123" \
  -d '{
    "id": "PROD_TEST",
    "name": "Production Test Station",
    "address": "Test Address, Chicago, IL",
    "coordinates": [-87.6298, 41.8781]
  }'
```

### Files Deployed
- `locations.js` - Centralized location data
- `server.js` - Updated with API endpoints
- `public/map.html` - Updated to use API
- `public/index-backup.html` - Updated to use API
- `api.js` - Test suite (configured for both local and production)
- Documentation files

### Environment Configuration
The API automatically detects the environment:
- `NODE_ENV=production` → Uses `https://battery.cuub.tech`
- `NODE_ENV=development` or undefined → Uses `http://localhost:3000`

### Vercel Configuration
The `vercel.json` file is configured to:
- Build the Node.js server
- Route all requests to `server.js`
- Support the production domain

## Next Steps
1. Verify deployment on battery.cuub.tech
2. Test API endpoints in production
3. Update any frontend applications to use the new centralized system
4. Monitor API usage and performance
