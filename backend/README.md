================================================================================
                    BARANGAY RABON - BACKEND API
================================================================================
Stack: Express + MongoDB + TypeScript
================================================================================

TABLE OF CONTENTS
  1. Overview
  2. Tech Stack
  3. Project Structure
  4. Getting Started
  5. Environment Variables
  6. API Endpoints
  7. Development

================================================================================
1. OVERVIEW
================================================================================

This is the backend API server for the Barangay Information Management System
(BIMS) for Barangay Rabon. It provides RESTful APIs for managing residents,
officials, document requests, service requests, business registrations, and
community analytics.

================================================================================
2. TECH STACK
================================================================================

- Runtime: Node.js
- Framework: Express 5.1
- Language: TypeScript
- Database: MongoDB (Mongoose 8.15)
- Authentication: JWT (jsonwebtoken) + bcrypt
- File Upload: Multer → Cloudinary
- Email: Nodemailer (Gmail SMTP)
- AI: Google Generative AI (Gemini)
- SMS: Semaphore API

================================================================================
3. PROJECT STRUCTURE
================================================================================

  .
  ├── controller/         # Express route handlers (thin layer)
  ├── services/           # Business logic & database queries
  ├── model/              # Mongoose schemas & models
  ├── routes/             # Express Router definitions
  ├── types/              # TypeScript interfaces / types
  ├── middleware/         # Express middleware (auth, validation, etc.)
  ├── utils/              # Utility functions & configuration modules
  ├── scripts/            # Database seed scripts
  ├── data/               # Seed data JSON files
  ├── uploads/            # Temporary local file storage (gitignored)
  ├── index.ts            # Application entry point
  ├── agent.md            # Coding rules & architecture guide
  ├── package.json
  └── tsconfig.json

================================================================================
4. GETTING STARTED
================================================================================

Prerequisites:
  - Node.js (v18 or higher)
  - MongoDB (local or Atlas)
  - npm or yarn

Installation:

  npm install

Development:

  npm run dev

Build:

  npm run build

Start (production):

  npm start

================================================================================
5. ENVIRONMENT VARIABLES
================================================================================

Create a .env file in the root directory with the following variables:

  PORT=5000
  MONGODB_URI_LIVE=your_mongodb_connection_string
  JWT_SECRET=your_jwt_secret_key

  # Cloudinary
  cloud_name=your_cloudinary_cloud_name
  api_key=your_cloudinary_api_key
  api_secret=your_cloudinary_api_secret

  # SMTP (Email)
  SMTP_USER=your_email@gmail.com
  SMTP_PASS=your_app_password

  # AI (Google Gemini)
  GEMINI_API_KEY=your_gemini_api_key

  # SMS (Semaphore)
  SEMAPHORE_API_KEY=your_semaphore_api_key

================================================================================
6. API ENDPOINTS
================================================================================

Base URL: http://localhost:5000

Authentication:
  POST   /api/auth/login          - Login and receive JWT token
  POST   /api/auth/register       - Register new account

Accounts:
  GET    /api/account              - Get all accounts
  GET    /api/account/:id          - Get account by ID
  PUT    /api/account/:id          - Update account
  DELETE /api/account/:id          - Delete account

Officials:
  GET    /api/officials            - Get all officials
  POST   /api/officials            - Create official
  PUT    /api/officials/:id        - Update official
  DELETE /api/officials/:id        - Delete official

Puroks:
  GET    /api/puroks               - Get all puroks
  POST   /api/puroks               - Create purok
  PUT    /api/puroks/:id           - Update purok
  DELETE /api/puroks/:id           - Delete purok

Document Requests:
  GET    /api/documents            - Get all document requests
  GET    /api/documents/:id        - Get document request by ID
  POST   /api/documents            - Create document request
  PUT    /api/documents/:id        - Update document request status

Service Requests:
  GET    /api/services             - Get all service requests
  POST   /api/services             - Create service request
  PUT    /api/services/:id         - Update service request

Business:
  GET    /api/business             - Get all businesses
  POST   /api/business             - Register business
  PUT    /api/business/:id         - Update business

Resident Census:
  GET    /api/census               - Get census data
  POST   /api/census               - Add census record

Community Analytics:
  GET    /api/analytics            - Get analytics data

Barangay Settings:
  GET    /api/settings             - Get barangay settings
  PUT    /api/settings             - Update settings

================================================================================
7. DEVELOPMENT
================================================================================

Coding Rules:
  See agent.md for detailed architecture and coding conventions.

Key Conventions:
  - All methods are static (no class instantiation)
  - Controllers are thin — delegate to services
  - Services handle business logic and database queries
  - JWT authentication for protected routes
  - File uploads: multer (temp) → Cloudinary (cloud) → cleanup

Seed Scripts:

  npm run seed:census          # Seed resident census data
  npm run seed:rules           # Seed recommendation rules
  npm run create:secretary     # Create default secretary account

================================================================================
END OF README
================================================================================