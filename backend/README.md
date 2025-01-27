# Portfolio Backend

Backend server for the portfolio website view counter.

## Features

- View counter API
- Unique visitor tracking
- Persistent storage using JSON file
- CORS enabled for frontend integration

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file with the following variables:
```
PORT=5000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000,https://mohamaddirieh.netlify.app
```

3. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## API Endpoints

- `GET /api/views` - Get current view count
- `POST /api/views` - Increment view count
- `GET /api/stats` - Get detailed statistics

## Deployment

### Render
1. Create a new Web Service
2. Connect your GitHub repository
3. Set the following:
   - Build Command: `npm install`
   - Start Command: `npm start`
4. Add environment variables in the dashboard

### Railway
1. Create a new project
2. Connect your GitHub repository
3. Add environment variables in the Variables section
4. Deploy the service

## Environment Variables

- `PORT` - Server port (default: 5000)
- `NODE_ENV` - Environment mode (development/production)
- `ALLOWED_ORIGINS` - Comma-separated list of allowed frontend URLs

## Requirements

- Node.js >= 18.0.0 