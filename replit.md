# Bookmark Collection Manager

## Overview

A web-based bookmark management application designed for saving, organizing, and managing bookmarks with rich metadata. It offers a Linear-inspired interface, drag-and-drop URL support, automatic metadata extraction, and tab-based collections for organization. Key features include editable favicons, persistent storage, custom notes with line break preservation, and an intuitive card-based interface. The project aims to provide a clean, efficient tool for personal bookmark management with a focus on user experience and data integrity.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

**Framework**: React 18 with TypeScript and Vite.
**UI/UX**: Linear-inspired interface with Material Design influences. Utilizes Radix UI for accessible components, shadcn/ui for design, and Tailwind CSS for styling. Custom color system with CSS variables, Inter font family, and consistent spacing.
**State Management**: TanStack Query for server state and caching; local component state for UI.
**Routing**: Wouter for client-side routing, handling home, email verification, and password reset routes.

### Backend

**Runtime**: Node.js with Express.js.
**API Design**: RESTful API under `/api` with session-based authentication.
**Session Management**: `express-session` with in-memory store, 7-day expiry, and secure cookie configuration.
**Authentication**: Username/email/password registration and login, bcrypt for password hashing, email verification, and password reset flows. CSRF protection is implemented.
**Storage Abstraction**: An `IStorage` interface with a `MemStorage` in-memory implementation, designed to be replaceable with a database. Supports User, Collection, and Bookmark entities with CRUD operations.

### Data Storage

**Database**: PostgreSQL via Drizzle ORM (configured with Neon serverless driver).
**Schema**:
- **Users**: `id`, `username`, `email`, `password` (hashed), `emailVerified`, `verificationToken`, `resetToken`, `resetTokenExpiry`.
- **Collections**: `id`, `userId`, `name`, `createdAt`.
- **Bookmarks**: `id`, `userId`, `collectionId` (nullable), `url`, `title`, `domain`, `favicon`, `memo`, `createdAt`.
**ORM Configuration**: Drizzle Kit for migrations, Zod for validation, shared schema between client/server. In-memory storage is used for development, with a planned transition to Drizzle for production.

### Security

**Authentication**: Session-based with `httpOnly`, `secure`, `sameSite: "lax"` cookies.
**Features**:
- Password hashing with bcrypt (SALT_ROUNDS=10).
- Session regeneration on login/register to prevent session fixation.
- CSRF protection via session-based tokens.
- SSRF defenses for image fetching: size limits (5MB), protocol/host whitelisting, private IP blocking, redirect prevention, content-type validation.
- User-scoped data access for bookmarks and collections.
- Collection ownership validation during bookmark creation.
- Robust error handling to prevent crashes and avoid logging sensitive data.

## External Dependencies

**Database**:
- Neon Serverless PostgreSQL (`@neondatabase/serverless` driver).

**UI Component Libraries**:
- Radix UI primitives.
- Lucide React (icons).
- cmdk (command palette).
- vaul (drawer components).
- react-day-picker (date selection).

**Development Tools**:
- Replit-specific plugins: `@replit/vite-plugin-runtime-error-modal`, `@replit/vite-plugin-cartographer`, `@replit/vite-plugin-dev-banner`.
- TypeScript.
- ESBuild (server bundling).
- Tailwind CSS with PostCSS.
- Zod for runtime validation and `zod-validation-error`.

**Email Service**:
- Resend (via resend package) for email verification and password reset emails.
- API key stored in RESEND_API_KEY environment variable.

**Fonts**:
- Google Fonts (Inter, Architects Daughter, DM Sans, Fira Code, Geist Mono).

**Build & Development**:
- Vite (frontend).
- tsx (TypeScript execution in development).