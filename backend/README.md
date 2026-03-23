# Backend API Setup

## Prerequisites
- Node.js (v14 or higher)
- MySQL Server (v8.0 or higher)
- MySQL Workbench (or any MySQL client)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file from `.env.example`:
```bash
cp .env.example .env
```

3. Update `.env` with your MySQL database credentials:
```
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=institute
DB_PORT=3306
```

4. Make sure your MySQL database `institute` is created and all tables are set up (run the SQL script provided).

## Running the Server

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

The server will run on `http://localhost:3000`

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with username and password
  - Body: `{ "username": "admin", "password": "admin123" }`
  - Returns: `{ success: true, data: { token, user } }`
- `GET /api/auth/verify` - Verify token and get current user
  - Headers: `Authorization: Bearer <token>`
  - Returns: `{ success: true, data: { user } }`
- `POST /api/auth/logout` - Logout (client-side token removal)

### Users (Students/Staff)
- `GET /api/users` - Get all users (with optional filters: role, course_id, is_active, search)
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user (soft delete)

### Courses
- `GET /api/courses` - Get all courses (with optional filters: batch_id, is_active, search)
- `GET /api/courses/:id` - Get course by ID
- `POST /api/courses` - Create new course
- `PUT /api/courses/:id` - Update course
- `DELETE /api/courses/:id` - Delete course (soft delete)

### Batches
- `GET /api/batches` - Get all batches (with optional search filter)
- `GET /api/batches/:id` - Get batch by ID
- `POST /api/batches` - Create new batch
- `PUT /api/batches/:id` - Update batch
- `DELETE /api/batches/:id` - Delete batch (soft delete)

### Transactions
- `GET /api/transactions` - Get all transactions (with optional filters: user_id, transtype, start_date, end_date, search)
- `GET /api/transactions/:id` - Get transaction by ID
- `POST /api/transactions` - Create new transaction
- `PUT /api/transactions/:id` - Update transaction
- `DELETE /api/transactions/:id` - Delete transaction (soft delete)

## Database Schema

The API expects the following database structure:
- `attachment` - File storage (must have `deleted_by`, `deleted_date` for organisation image soft-delete; run `scripts/add-attachment-soft-delete.sql` if missing)
- `organization` - Organization details
- `user_role` - User roles (Admin, Student, Staff)
- `batch` - Batches
- `course` - Courses
- `user` - Users (Students/Staff)
- `user_profile` - User login credentials
- `transactions` - Financial transactions

Make sure to run the SQL script to create all tables before starting the server.

## Creating Admin User

After setting up the database, create an admin user:

```bash
npm run create-admin
```

This will create:
- Username: `admin`
- Password: `admin123`

**⚠️ Important:** Change the password after first login!

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-token>
```

To protect routes, use the `authenticate` middleware. Example:

```javascript
const { authenticate } = require('./middleware/auth');
router.get('/protected', authenticate, (req, res) => {
  // req.user contains user info
  res.json({ user: req.user });
});
```
