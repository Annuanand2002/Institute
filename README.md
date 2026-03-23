# Full Stack Application

This project contains both an Angular 14 frontend and a Node.js backend.

## Project Structure

```
.
├── frontend/          # Angular 14 frontend application
└── backend/           # Node.js backend API
```

## Getting Started

### Frontend (Angular 14)

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

The frontend will be available at `http://localhost:4200`

### Backend (Node.js)

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file:
```bash
cp .env.example .env
```

4. Start the server:
```bash
npm run dev
```

The backend API will be available at `http://localhost:3000`

## Development

- Frontend runs on port `4200`
- Backend runs on port `3000`

Make sure both servers are running for full-stack development.

## Technologies

- **Frontend**: Angular 14, TypeScript
- **Backend**: Node.js, Express.js
- **Package Managers**: npm
