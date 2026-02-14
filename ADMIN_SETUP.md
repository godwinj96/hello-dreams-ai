# Admin and Superuser Account Setup Guide

This guide explains how to create your first superuser and admin accounts, and how to promote existing users.

## Creating Your First Superuser

The first superuser account must be created using a database script since there are no existing superusers to create one via the API.

### Option 1: Create a New Superuser Account

```bash
npm run create-superuser <email> <password> [name]
```

**Example:**
```bash
npm run create-superuser admin@example.com SecurePassword123! "Admin User"
```

This will:
- Create a new user with the superuser role if the email doesn't exist
- OR update an existing user to superuser if the email already exists

### Option 2: Promote an Existing User to Superuser

If you already have a user account and want to make it a superuser:

```bash
npm run promote-user <email> superuser
```

**Example:**
```bash
npm run promote-user your-email@example.com superuser
```

## Creating Admin Accounts

Once you have a superuser account, you can create admin accounts in multiple ways:

### Option 1: Using the API - Create New Admin/Superuser (Recommended)

1. Log in as a superuser to get your JWT token
2. Use the `POST /users/admins` endpoint:

```bash
# Create an admin
curl -X POST http://localhost:3000/users/admins \
  -H "Authorization: Bearer YOUR_SUPERUSER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "SecurePassword123!",
    "name": "Admin User",
    "role": "admin"
  }'

# Create a superuser (superuser only)
curl -X POST http://localhost:3000/users/admins \
  -H "Authorization: Bearer YOUR_SUPERUSER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "superuser@example.com",
    "password": "SecurePassword123!",
    "name": "Superuser",
    "role": "superuser"
  }'
```

**Note:** The `role` field is optional and defaults to `admin`. Only superusers can create other superusers.

### Option 2: Using the API - Promote Existing User (Recommended)

1. Log in as a superuser to get your JWT token
2. Use the `PATCH /users/:id/promote` endpoint:

```bash
# Promote user to admin
curl -X PATCH http://localhost:3000/users/USER_ID/promote \
  -H "Authorization: Bearer YOUR_SUPERUSER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "admin"
  }'

# Promote user to superuser
curl -X PATCH http://localhost:3000/users/USER_ID/promote \
  -H "Authorization: Bearer YOUR_SUPERUSER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "superuser"
  }'
```

### Option 3: Using the Script (Command Line)

```bash
npm run promote-user <email> admin
```

**Example:**
```bash
npm run promote-user admin@example.com admin
```

## Promoting Existing Users

You can promote existing users via API or script:

### Via API (Recommended for Frontend)

```bash
# Promote to admin
curl -X PATCH http://localhost:3000/users/USER_ID/promote \
  -H "Authorization: Bearer YOUR_SUPERUSER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "admin"}'

# Promote to superuser
curl -X PATCH http://localhost:3000/users/USER_ID/promote \
  -H "Authorization: Bearer YOUR_SUPERUSER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "superuser"}'
```

### Via Script (Command Line)

```bash
npm run promote-user <email> <role>
```

Where `<role>` is either:
- `admin` - Grants admin privileges
- `superuser` - Grants superuser privileges (highest level)

**Examples:**
```bash
# Promote to admin
npm run promote-user user@example.com admin

# Promote to superuser
npm run promote-user user@example.com superuser
```

## Role Hierarchy

- **Superuser**: Can do everything, including:
  - Create/remove admin and superuser accounts
  - Delete users
  - Access all admin features
  
- **Admin**: Can manage regular users, including:
  - View all users
  - Activate/deactivate users
  - Update user profiles
  - Access admin dashboard
  - Cannot create/remove admins or superusers
  - Cannot delete users
  - Cannot modify superuser accounts

- **User**: Regular user with standard access

## Quick Start Checklist

1. **Create your first superuser:**
   ```bash
   npm run create-superuser your-email@example.com YourPassword123!
   ```

2. **Log in with your superuser account** to get a JWT token

3. **Create admin accounts via API** (using your superuser token):
   ```bash
   # Create new admin
   curl -X POST http://localhost:3000/users/admins \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"email": "admin@example.com", "password": "Pass123!", "name": "Admin", "role": "admin"}'
   
   # Or promote existing user to admin
   curl -X PATCH http://localhost:3000/users/USER_ID/promote \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"role": "admin"}'
   ```

4. **Or use the script to promote existing users:**
   ```bash
   npm run promote-user existing-user@example.com admin
   ```

## API Endpoints Summary

All endpoints require authentication (JWT token in Authorization header):

- **POST `/users/admins`** - Create new admin/superuser account (Superuser only)
  - Body: `{ email, password, name, role? }` (role defaults to "admin")
  
- **PATCH `/users/:id/promote`** - Promote existing user to admin/superuser (Superuser only)
  - Body: `{ role: "admin" | "superuser" }`
  
- **DELETE `/users/admins/:id`** - Remove admin role (demote to user) (Superuser only)
  
- **PATCH `/users/:id/status`** - Activate/deactivate user account (Admin+)
  - Body: `{ isActive: boolean }`
  
- **PUT `/users/:id`** - Update user profile (Self or Admin+)
  - Body: `{ email?, name? }`
  
- **DELETE `/users/:id`** - Delete user account (Superuser only)
  
- **GET `/users`** - List all users with filters (Admin+)
  
- **GET `/users/:id`** - Get user details (Self or Admin+)
  
- **GET `/users/stats`** - Get user statistics (Admin+)

## Important Notes

- Superusers can create other superusers, but this should be done carefully
- A superuser cannot remove their own superuser role
- A superuser cannot delete their own account
- Users cannot deactivate their own accounts
- All scripts require database access (configured via `.env` file)

## Troubleshooting

If you encounter issues:

1. **Database connection errors**: Ensure your `.env` file has correct `DATABASE_URL` or database credentials
2. **User not found**: Verify the email address is correct
3. **Permission errors**: Make sure you're running the scripts with proper database access

For API-based operations, ensure:
- You have a valid JWT token
- Your account has the required role (superuser for creating admins)
- The token hasn't expired

