================================================================================
                    BARANGAY RABON - FRONTEND
================================================================================
Stack: Next.js + TypeScript + shadcn/ui
================================================================================

TABLE OF CONTENTS
  1. Overview
  2. Tech Stack
  3. Project Structure
  4. Getting Started
  5. Environment Variables
  6. Pages & Routes
  7. Development

================================================================================
1. OVERVIEW
================================================================================

This is the frontend application for the Barangay Information Management System
(BIMS) for Barangay Rabon. It provides a web interface for residents to request
documents, manage services, and interact with barangay officials. The secretary
portal enables officials to manage resident verification, document processing,
and community analytics.

================================================================================
2. TECH STACK
================================================================================

- Framework: Next.js 16 (App Router)
- Language: TypeScript + React 19
- UI Library: shadcn/ui (radix-nova style)
- Styling: Tailwind CSS 4
- State Management: Zustand (persisted stores)
- Data Fetching: Axios + @tanstack/react-query
- Charts: Recharts
- Maps: Leaflet + react-leaflet
- Payments: Stripe + PayMongo (test mode)
- Document Generation: pdf-lib, docxtemplater, pizzip
- Icons: Lucide React
- Notifications: SweetAlert2, Sonner (toast)

================================================================================
3. PROJECT STRUCTURE
================================================================================

  .
  ├── app/                        # Next.js App Router directory
  │   ├── api/                    # Next.js API routes (route.ts)
  │   ├── guest/                  # Public pages (sign in, sign up)
  │   ├── pages/                  # Application pages
  │   │   ├── resident/           # Resident portal
  │   │   └── secretary/          # Secretary/admin portal
  │   ├── store/                  # Zustand state stores
  │   ├── template/               # Template/reference components
  │   ├── types/                  # TypeScript interfaces
  │   ├── utils/                  # Utility/helper functions
  │   ├── globals.css             # Global styles + Tailwind theme
  │   ├── layout.tsx              # Root layout (providers)
  │   └── page.tsx                # Landing/public page
  ├── components/
  │   └── ui/                     # Shared/reusable UI components (shadcn + custom)
  ├── hooks/                      # App-level hooks
  ├── lib/                        # Utility libraries (cn/utils)
  ├── public/
  │   ├── assets/                 # Static assets (images)
  │   └── documents/              # PDF document templates
  ├── AGENTS.md                   # Coding style guide
  ├── components.json             # shadcn/ui configuration
  ├── package.json
  ├── postcss.config.mjs
  ├── tailwind.config.ts
  └── tsconfig.json

================================================================================
4. GETTING STARTED
================================================================================

Prerequisites:
  - Node.js (v18 or higher)
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

Create a .env.local file in the root directory with the following variables:

  # Backend API
  NEXT_PUBLIC_API_URL=http://localhost:5000

  # Stripe (Test Mode)
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
  STRIPE_SECRET_KEY=sk_test_...

  # PayMongo (Test Mode)
  NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY=pk_test_...
  PAYMONGO_SECRET_KEY=sk_test_...

================================================================================
6. PAGES & ROUTES
================================================================================

Public Routes:
  /                           - Landing page
  /guest/signIn               - Sign in page
  /guest/signUp               - Sign up page

Resident Portal (/pages/resident):
  /home                       - Resident dashboard
  /profile                    - View/edit profile
  /documentRequest            - Request documents
  /myDocuments                - View requested documents
  /serviceRequests            - Request services
  /workRequest                - Request work opportunities
  /business                   - Register business
  /myBusiness                 - View registered businesses
  /contracts                  - View contracts
  /residentSkills             - View/add skills
  /activity                   - Activity log
  /aiChatBot                  - AI chatbot assistant

Secretary Portal (/pages/secretary):
  /home                       - Secretary dashboard
  /verifyResident             - Verify resident registrations
  /verifyBusiness             - Verify business registrations
  /documentRequest            - Manage document requests
  /requestHistory             - View request history
  /residentCensus             - Manage resident census
  /communityAnalytics         - View community analytics
  /recommendationRules        - Manage recommendation rules
  /residentSkills             - Manage resident skills
  /aiContext                   - Configure AI context
  /barangaySettings           - Barangay settings
    /officials                - Manage officials
    /puroks                   - Manage puroks
    /account                  - Account settings
    /audit                    - Audit logs
    /logo                     - Upload barangay logo
    /sms                      - SMS settings
    /templates                - Document templates

================================================================================
7. DEVELOPMENT
================================================================================

Coding Rules:
  See AGENTS.md for detailed coding style guide and conventions.

Key Conventions:
  - Use "use client" directive for client-side components
  - Named exports for components (not default)
  - Page components use "export default function Page()"
  - Page-specific components in components/ folder within page directory
  - Shared UI components in components/ui/
  - Zustand stores in app/store/ (one file per store)
  - Utility functions in app/utils/
  - TypeScript interfaces in app/types/

UI Philosophy:
  - Functional first, minimal styling, polish later
  - Use shadcn/ui default styling
  - Minimal Tailwind classes for layout only
  - Avoid decorative CSS (shadows, gradients, animations)

================================================================================
END OF README
================================================================================