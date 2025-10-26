# Bookmark Collection Manager

## Overview

A web-based bookmark management application that allows users to save, organize, and manage their bookmarks with metadata. The application features a clean, Linear-inspired interface with drag-and-drop URL support, automatic metadata extraction, tab-based collections for organizing bookmarks into multiple lists, editable favicon icons, and persistent storage. Users can add bookmarks via URL input, create custom collections (lists), attach personal notes with line break preservation, and manage their bookmarks through an intuitive card-based interface with tab navigation.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React 18 with TypeScript and Vite as the build tool

**UI Component System**: 
- Radix UI primitives for accessible, unstyled components
- shadcn/ui design system configured with "new-york" style
- Tailwind CSS for utility-first styling with custom design tokens
- Component aliases configured for clean imports (`@/components`, `@/lib`, `@/hooks`)

**State Management**:
- TanStack Query (React Query) for server state management and caching
- Session-based authentication state with API queries
- Local component state for UI interactions

**Routing**: 
- Wouter for lightweight client-side routing
- Single-page application with `/` (Home) route

**Design System**:
- Linear-inspired productivity interface with Material Design influences
- Custom color system using HSL values with CSS variables for theming
- Typography using Inter font family (Google Fonts) with SF Mono for code/URLs
- Consistent spacing primitives (Tailwind units: 2, 4, 6, 8, 12, 16)
- Card-based layout with subtle shadows and borders

### Backend Architecture

**Runtime**: Node.js with Express.js framework

**API Design**:
- RESTful API endpoints under `/api` prefix
- Session-based authentication (no token-based auth)
- Express middleware for request logging and JSON parsing
- Raw body capture for webhook/external integrations

**Session Management**:
- express-session with in-memory store (MemoryStore from memorystore package)
- Session cookie configuration with secure flags for production
- 7-day session expiry
- Session data stores userId for authenticated requests

**Authentication Flow**:
- Username/password based registration and login
- Password stored directly (Note: should implement hashing in production)
- Session creation on successful authentication
- `/api/auth/me` endpoint for session validation
- `/api/auth/register`, `/api/auth/login`, `/api/auth/logout` endpoints

**Storage Abstraction**:
- IStorage interface defining data access methods
- MemStorage class implementing in-memory storage
- Designed to be replaceable with database implementation
- Supports User, Collection, and Bookmark entities with CRUD operations
- Collection deletion automatically nullifies associated bookmark collectionIds (preserves bookmarks in "すべて" tab)

### Data Storage Solutions

**Database Schema** (Drizzle ORM with PostgreSQL):

**Users Table**:
- `id`: UUID primary key (generated via `gen_random_uuid()`)
- `username`: Unique text field
- `password`: Text field for credentials

**Collections Table**:
- `id`: UUID primary key (generated via `gen_random_uuid()`)
- `userId`: Foreign key to users (cascade delete)
- `name`: Collection name (e.g., "仕事用", "趣味")
- `createdAt`: Timestamp with default now()

**Bookmarks Table**:
- `id`: UUID primary key (generated via `gen_random_uuid()`)
- `userId`: Foreign key to users (cascade delete)
- `collectionId`: Optional foreign key to collections (nullable, cascade delete)
- `url`: Bookmark URL
- `title`: Page title
- `domain`: Extracted domain name
- `favicon`: Optional favicon URL (editable)
- `memo`: User notes/description (preserves line breaks)
- `createdAt`: Timestamp with default now()

**ORM Configuration**:
- Drizzle Kit for schema migrations
- Schema located at `shared/schema.ts` for sharing between client/server
- Zod validation schemas generated from Drizzle schemas
- Neon serverless driver for PostgreSQL connections
- WebSocket support configured for serverless database access

**Current Implementation**: In-memory storage (MemStorage) used for development/testing, designed to be replaced with Drizzle database implementation.

### Authentication and Authorization

**Strategy**: Session-based authentication with cookie storage

**Flow**:
1. User registers with username/password via `/api/auth/register`
2. User logs in with credentials via `/api/auth/login`
3. Server creates session and returns session cookie
4. Client includes cookie in subsequent requests
5. Protected endpoints verify session via `req.session.userId`

**Security Considerations**:
- HTTP-only cookies prevent XSS attacks
- Secure flag enabled in production for HTTPS-only
- Session secret configurable via environment variable
- CORS and credential handling configured

**Authorization**: User-scoped data access - bookmarks and collections filtered by `userId` from session

## Recent Changes

### October 26, 2025
- **Collections Feature**: Added tab-based collections for organizing bookmarks into multiple lists
  - Schema: Added `collections` table with userId reference
  - Backend: Implemented collection CRUD operations (GET, POST, PATCH, DELETE)
  - Frontend: Index-style tab UI with "すべて" (all) tab and individual collection tabs
  - Data integrity: When a collection is deleted, associated bookmarks have their `collectionId` set to null and remain in the "すべて" tab
- **Settings Dialog**: Centralized configuration interface
  - Collection management: Add, edit, rename, and delete collections
  - Default tab setting: Choose which tab to display on login (persisted in localStorage)
  - Removed inline delete buttons from tabs for cleaner UI
- **Favicon D&D Feature**: Enhanced favicon input with drag-and-drop support
  - FaviconInput component accepts URL text drops, image file drops (converted to base64), and manual URL input
  - Visual feedback during drag-over with upload button fallback
- **Self-Hosted Image Storage**: Eliminated external service dependencies
  - Server-side image download system (fetchImageAsBase64 utility)
  - All images stored as base64 data URIs in database
  - External URLs never persisted - downloaded and converted to base64 on save
  - Failed downloads return error instead of storing external URLs
  - 10-second timeout with content-type validation
  - Bookmarks created with favicon=null by default (no automatic downloads)
- **Tab Design Improvements**: Index-style tabs with bottom border emphasis
  - Active tab highlighted with primary-colored bottom border (2px)
  - Clean, minimalist design without inline action buttons
- **Error Message Display**: Login/registration forms now display error messages directly in the UI
- **Security Fix**: PATCH /api/bookmarks/:id now only allows updating `memo` and `favicon` fields
- **Testing**: Complete E2E test coverage for authentication, collections, bookmark CRUD, favicon editing, settings dialog, default tab persistence, and self-hosted image storage

### External Dependencies

**Database**:
- Neon Serverless PostgreSQL (configured via `DATABASE_URL` environment variable)
- WebSocket connection support for serverless environments
- Connection pooling via `@neondatabase/serverless`

**UI Component Libraries**:
- Radix UI primitives (20+ component packages)
- Lucide React for icons
- cmdk for command palette patterns
- vaul for drawer components
- react-day-picker for date selection

**Development Tools**:
- Replit-specific plugins for development environment
  - `@replit/vite-plugin-runtime-error-modal` for error overlay
  - `@replit/vite-plugin-cartographer` for code mapping
  - `@replit/vite-plugin-dev-banner` for development indicator
- TypeScript for type safety
- ESBuild for production server bundling
- Tailwind CSS with PostCSS for styling

**Validation**:
- Zod for runtime type validation
- zod-validation-error for user-friendly error messages
- Integration with Drizzle ORM for schema validation

**Fonts**:
- Google Fonts (Inter, Architects Daughter, DM Sans, Fira Code, Geist Mono)
- Loaded via HTML link tags in client/index.html

**Build & Development**:
- Vite for frontend development server and production builds
- tsx for TypeScript execution in development
- Hot Module Replacement (HMR) configured
- Separate build outputs: `dist/public` for client, `dist` for server