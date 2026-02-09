# LeetFlix

A full-stack web application that combines the concept of TV show binge-watching with coding quizzes. Test your knowledge of TV show plots through interactive quizzes organized by show and season.

## Table of Contents

- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [System Prerequisites](#system-prerequisites)
- [Project Structure](#project-structure)
- [Setup Instructions](#setup-instructions)
- [Running the Project](#running-the-project)
- [Environment Configuration](#environment-configuration)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## Project Overview

LeetFlix is a quiz application where users can:
- Sign up and log in to their accounts
- Browse TV shows and their seasons
- Answer quiz questions about TV show plots
- Track their scores and view leaderboards (global and per-show)
- Admins can upload and manage quiz questions in bulk

The application features:
- **User authentication** with password hashing
- **Firebase Firestore** backend for storing user data and quizzes
- **React-based frontend** with a modern UI and dark mode support
- **Admin panel** for managing quiz content
- **Responsive design** for desktop and mobile devices

---

## Tech Stack

### Frontend
- **React 19.1.1** - Modern UI framework
- **React Scripts 5.0.1** - Build and development tooling
- **React DOM 19.1.1** - React rendering engine
- **Testing Library** - React component testing utilities
- **CSS** - Custom styling with dark mode support

### Backend
- **Node.js** - JavaScript runtime
- **Express 5.1.0** - Web framework and API server
- **Firebase Admin SDK 13.5.0** - Cloud database (Firestore) and authentication
- **CORS 2.8.5** - Cross-origin resource sharing support
- **bcryptjs 3.0.2** - Password hashing for security

### Database
- **Firebase Firestore** - Cloud-hosted NoSQL database

---

## System Prerequisites

Before setting up the project, ensure you have the following installed on your machine:

### Required
- **Node.js 18.0.0 or higher** - [Download here](https://nodejs.org/)
  - Includes npm (Node Package Manager)
  - Verify installation: `node --version` and `npm --version`
- **Git** - [Download here](https://git-scm.com/)

### For Windows Batch Script (Optional)
- **Windows 10/11** (if using `start-prod.bat`)
- **PowerShell 5.0+** (if using `start-prod.ps1`)

### Firebase Configuration (Required)
- A Google Cloud project with Firestore enabled
- A service account key JSON file from Firebase Console

### Recommended
- **Visual Studio Code** or your preferred code editor
- **npm or yarn** as package managers

---

## Project Structure

```
LeetFlix/
├── README.md                        # This file
├── start-prod.bat                   # Windows batch script to build and start the app
├── start-prod.ps1                   # PowerShell script to build and start the app
│
├── leetflix-backend/                # Express.js backend server
│   ├── server.js                    # Main server file (PORT 3000)
│   ├── package.json                 # Backend dependencies and scripts
│   ├── serviceAccountKey.json       # Firebase credentials (NOT in git)
│   ├── data.js                      # Sample quiz data structure
│   ├── insertData.js                # Script to upload quiz data to Firebase
│   ├── e2e_test.js                  # End-to-end testing script
│   ├── test_requests.js             # Manual API endpoint testing
│   ├── node_modules/                # Installed dependencies
│   └── build/                       # Production frontend build (served by backend)
│
└── leetflix-frontend/               # React frontend application
    ├── src/                         # React source code
    │   ├── App.js                   # Main app component
    │   ├── Login.js                 # Login/signup component
    │   ├── mockApi.js               # API client functions
    │   ├── App.css                  # App styling
    │   ├── index.js                 # React entry point
    │   └── components/              # Reusable components
    │       ├── QuestionForm.js       # Single question quiz
    │       ├── BulkQuestionForm.js   # Bulk question upload (admin)
    │       ├── Leaderboard.js        # Show-specific leaderboard
    │       ├── GlobalLeaderboard.js  # Global user rankings
    │       └── SeasonSelection.js    # Season picker for shows
    ├── public/                      # Static assets
    ├── package.json                 # Frontend dependencies and scripts
    ├── build/                       # Production build folder (generated)
    └── node_modules/                # Installed dependencies

```

---

## Setup Instructions

Follow these step-by-step instructions to set up the project on your local machine.

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd LeetFlix
```

Replace `<repository-url>` with the actual URL of the GitHub repository.

### Step 2: Set Up Firebase Credentials

1. **Create or log in to your Firebase project:**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project or select an existing one

2. **Enable Firestore Database:**
   - Go to **Firestore Database** in the left sidebar
   - Click **Create Database** and select **Start in production mode**
   - Choose a region and confirm

3. **Create a Service Account:**
   - Go to **Project Settings** → **Service Accounts**
   - Click **Generate New Private Key**
   - Save the downloaded JSON file as `serviceAccountKey.json`

4. **Place the credentials file:**
   ```bash
   cp <path-to-downloaded-key>.json leetflix-backend/serviceAccountKey.json
   ```
   **IMPORTANT:** Never commit `serviceAccountKey.json` to version control. It's already in `.gitignore`.

### Step 3: Install Backend Dependencies

```bash
cd leetflix-backend
npm install
cd ..
```

This installs:
- Express.js server framework
- Firebase Admin SDK
- CORS support
- Password hashing library (bcryptjs)

### Step 4: Install Frontend Dependencies

```bash
cd leetflix-frontend
npm install
cd ..
```

This installs:
- React and React DOM
- React testing libraries
- React scripts (build tools)

---

## Running the Project

### Option 1: Using the Quick Start Script (Recommended for Windows)

#### Using PowerShell:
```powershell
powershell -ExecutionPolicy Bypass -File start-prod.ps1
```

**Advanced options:**
```powershell
# Run in background
powershell -ExecutionPolicy Bypass -File start-prod.ps1 -Background

# Add Windows Firewall rule (requires admin)
powershell -ExecutionPolicy Bypass -File start-prod.ps1 -AddFirewallRule
```

#### Using Batch File:
Simply double-click `start-prod.bat` in Windows Explorer, or run:
```bash
start-prod.bat
```

**What the scripts do:**
1. Build the React frontend
2. Stop any running Node processes
3. Start the backend server on port 3000
4. The backend serves both the API and the built frontend

### Option 2: Manual Setup (All Platforms)

#### Terminal 1 - Start the Backend:
```bash
cd leetflix-backend
npm start
```

Server starts on `http://localhost:3000`

#### Terminal 2 - Start the Frontend (Development Mode):
```bash
cd leetflix-frontend
npm start
```

Frontend runs on `http://localhost:3000` (in development, it proxies API calls to the backend)

### Option 3: Production Build + Backend Only

```bash
# Build the frontend (creates optimized production build)
cd leetflix-frontend
npm run build
cd ../

# Start the backend (serves the built frontend)
cd leetflix-backend
npm start
```

The backend at `http://localhost:3000` will serve both the API and the frontend build.

---

## Environment Configuration

### Backend Configuration

Edit `leetflix-backend/server.js` to customize settings:

```javascript
// Default port (can be overridden)
const PORT = process.env.PORT || 3000;

// Admin key for protected endpoints (CHANGE THIS!)
const ADMIN_KEY = "your-secret-admin-key";
```

### Setting the PORT Environment Variable

#### Windows (Command Prompt):
```cmd
set PORT=3001
node server.js
```

#### Windows (PowerShell):
```powershell
$env:PORT = 3001
node server.js
```

#### macOS/Linux:
```bash
PORT=3001 npm start
```

### Frontend Proxy Configuration

The frontend (`leetflix-frontend/package.json`) proxies API calls to the backend:
```json
"proxy": "http://localhost:3001"
```

If you change the backend PORT, update this proxy setting to match.

---

## Uploading Initial Quiz Data

The project includes a script to populate Firestore with initial quiz data:

```bash
cd leetflix-backend
node insertData.js
```

This reads quiz data from `data.js` and uploads it to your Firestore database.

**Note:** Only run this once when setting up. Running it again will create duplicate data.

---

## Testing

### Backend Testing

Run API tests:
```bash
cd leetflix-backend
node e2e_test.js
```

Or manually test endpoints:
```bash
node test_requests.js
```

### Frontend Testing

Run React component tests:
```bash
cd leetflix-frontend
npm test
```

This launches the test runner in interactive watch mode. Press `q` to quit.

---

## Default Ports & URLs

| Service | URL | Purpose |
|---------|-----|---------|
| Backend API | `http://localhost:3000` | REST API endpoints |
| Frontend Dev | `http://localhost:3000` | React dev server (when running separately) |
| Firestore | Cloud-hosted | Database (no direct URL) |

### Available API Endpoints

**Fetch all shows:**
```bash
GET http://localhost:3000/shows
```

**Fetch quiz for a show and season:**
```bash
GET http://localhost:3000/quizzes/:showName/:seasonName
```

**User signup:**
```bash
POST http://localhost:3000/signup
```

**User login:**
```bash
POST http://localhost:3000/login
```

---

## Troubleshooting

### Common Setup Errors

#### Error: `serviceAccountKey.json not found`
**Solution:**
1. Verify the file exists in `leetflix-backend/serviceAccountKey.json`
2. Ensure you downloaded the file from Firebase Console
3. Check file name spelling (case-sensitive)

#### Error: `Port 3000 already in use`
**Solution (Windows):**
```bash
taskkill /IM node.exe /F
```

**Solution (macOS/Linux):**
```bash
lsof -ti:3000 | xargs kill -9
```

Or change the PORT:
```bash
PORT=3001 npm start
```

#### Error: `npm: command not found`
**Solution:**
1. Install Node.js from [nodejs.org](https://nodejs.org/)
2. Restart your terminal
3. Verify: `node --version` and `npm --version`

#### Error: `Firebase initialization failed`
**Possible causes:**
- `serviceAccountKey.json` is missing or corrupted
- Firebase project doesn't have Firestore enabled
- The service account doesn't have proper permissions

**Solution:**
1. Re-download `serviceAccountKey.json` from Firebase Console
2. Verify Firestore Database is created in your Firebase project
3. Check that the JSON file is valid (not corrupted)

#### Error: `CORS policy: blocked request`
**Solution:**
- The backend is running Express with CORS enabled
- Ensure you're accessing from `http://localhost:3000` (not `http://127.0.0.1:3000`)
- Verify the backend is running

#### Frontend not loading or shows 404
**Solution:**
1. Ensure frontend is built: `cd leetflix-frontend && npm run build`
2. Restart the backend server
3. Clear browser cache (Ctrl+Shift+Delete or Cmd+Shift+Delete)

#### Tests fail or hang
**Solution:**
1. Stop any running servers first
2. Ensure Firebase credentials are valid
3. Check internet connectivity (Firebase requires cloud access)
4. Run: `npm install` to ensure all test dependencies are installed

### Development Tips

- **Hot Reload:** When using `npm start` for frontend development, changes auto-reload in the browser
- **Browser DevTools:** Open DevTools to inspect network requests and debug frontend code
- **Backend Logs:** Backend logs appear in the terminal where you ran `npm start`
- **Clear Dependencies:** If you encounter module errors, delete `node_modules` and `package-lock.json`, then run `npm install` again

### Performance Tips

- **Production Build:** Always use `npm run build` and serve the backend for deployed versions
- **Firestore Indexes:** If queries are slow, check Firestore Console for suggested indexes
- **Environment:** Ensure your machine has sufficient RAM (4GB+) for Node.js and npm operations

---

## Next Steps

Once everything is running:

1. **Access the app:** Open `http://localhost:3000` in your browser
2. **Create an account:** Use the signup form
3. **Browse quizzes:** Select a show and season to start answering questions
4. **Admin features:** Log in as admin to upload bulk quiz questions (if admin key is configured)
5. **Check leaderboards:** View your scores compared to other users

---

## Additional Resources

- [Node.js Documentation](https://nodejs.org/docs/)
- [Express.js Guide](https://expressjs.com/)
- [React Documentation](https://react.dev/)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Guide](https://firebase.google.com/docs/firestore)

---

## License

This project is provided as-is. Check the LICENSE file for more details.

---

## Support

If you encounter issues not covered in the troubleshooting section:

1. Check that all prerequisites are installed
2. Verify Firebase credentials and Firestore setup
3. Review backend logs for error messages
4. Ensure both backend and frontend servers are running
5. Try clearing `node_modules` and reinstalling dependencies

---

**Happy quizzing! 🎬📝**
