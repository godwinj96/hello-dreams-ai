# Render Deployment Guide

This project includes a Render blueprint (`render.yaml`) that automatically sets up the database and web service with migrations.

## Quick Start

1. **Push your code to GitHub/GitLab/Bitbucket**

2. **Connect your repository to Render:**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New +" → "Blueprint"
   - Connect your repository
   - Render will automatically detect `render.yaml` and create the services

3. **The blueprint will:**
   - Create a PostgreSQL database (`hello-dreams-ai-db`)
   - Create a web service (`hello-dreams-ai-api`)
   - Automatically run migrations during build
   - Configure all environment variables

## Manual Setup (Alternative)

If you prefer to set up services manually:

### 1. Create PostgreSQL Database
- Go to Render Dashboard → "New +" → "PostgreSQL"
- Name: `hello-dreams-ai-db`
- Plan: Starter (or your preferred plan)
- Note the connection details

### 2. Create Web Service
- Go to Render Dashboard → "New +" → "Web Service"
- Connect your repository
- Settings:
  - **Build Command:** `npm install && npm run build && npm run migration:run:prod`
  - **Start Command:** `npm run start:prod`
  - **Environment:** Node
  - **Plan:** Starter (or your preferred plan)

### 3. Set Environment Variables
Add these environment variables in the Render dashboard:
- `NODE_ENV` = `production`
- `DB_HOST` = (from database connection string)
- `DB_PORT` = (from database connection string, usually `5432`)
- `DB_USERNAME` = (from database connection string)
- `DB_PASSWORD` = (from database connection string)
- `DB_NAME` = (from database connection string)

Or use Render's database reference feature to automatically link them.

## Migration Scripts

- `npm run migration:run` - Run migrations in development (uses ts-node)
- `npm run migration:run:prod` - Run migrations in production (uses compiled JS)
- `npm run build:with-migrations` - Build and run migrations

## Troubleshooting

### "No open ports detected"
- Ensure `main.ts` listens on `0.0.0.0` (already configured)
- Check that the start command is `npm run start:prod`
- Verify the app starts successfully (check logs for database connection errors)

### Database Connection Errors
- Verify all `DB_*` environment variables are set correctly
- Check that the database service is running
- Ensure the database is accessible from the web service (should be automatic on Render)

### Migration Errors
- Check that migrations are compiled: `npm run build`
- Verify database connection before running migrations
- Check migration logs in the build output

## Local Development

To test migrations locally:

```bash
# Set up .env file with your local database credentials
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_NAME=hello_dreams_ai

# Run migrations
npm run migration:run
```

## Notes

- Migrations run automatically during the build process on Render
- The `synchronize` option is disabled in production for safety
- All database schema changes should be done through migrations
- The initial migration creates all tables matching your local database structure

