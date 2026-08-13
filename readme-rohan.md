Rohan's Contributions

## Overview
This document outlines the work completed by **Rohan** for the GI Smart project.

---

## ✅ What I Built

### 1. Project Setup
- Initialized the **Next.js 16** project with App Router and TypeScript
- Configured **Tailwind CSS v3** for styling
- Set up project folder structure (`app/`, `components/`, `lib/`, `prisma/`)
- Created all **shadcn/ui** components manually (Button, Input, Card, Label, Select, Alert, Badge, Separator)

### 2. Database — Neon PostgreSQL
- Created a free **Neon PostgreSQL** database
- Configured **Prisma ORM** with the Neon connection string
- Designed and pushed the database schema (`prisma/schema.prisma`) including:
  - `User` model
  - `Session` model
  - `Account` model
  - `Verification` model
- Ran `prisma db push` and `prisma generate` to initialise the database

### 3. Authentication System (Better Auth)
- Integrated **Better Auth** for full authentication
- Implemented:
  - ✅ User Registration (`/register`)
  - ✅ User Login (`/login`)
  - ✅ User Logout
  - ✅ Session management with cookie caching
  - ✅ Persistent login state across page refresh
- Created the auth API handler at `app/api/auth/[...all]/route.ts`
- Built `lib/auth.ts` (server config) and `lib/auth-client.ts` (client config)
- Created Prisma singleton in `lib/prisma.ts` for efficient DB connections

### 4. Route Protection (Proxy/Middleware)
- Implemented `proxy.ts` to protect private routes
- Protected routes: `/dashboard`, `/meal-plan`, `/tracking`, `/user`
- Unauthenticated users are automatically redirected to `/login`
- Auth state persists across browser refresh via session cookies

### 5. UI Pages Built
| Page | Route | Protected |
|---|---|---|
| Landing / Home | `/` | No |
| Login | `/login` | No |
| Register | `/register` | No |
| Dashboard | `/dashboard` | ✅ Yes |
| Food Database | `/foods` | No |
| Weekly Meal Plan | `/meal-plan` | ✅ Yes |
| Daily Tracking | `/tracking` | ✅ Yes |
| Health Profile | `/user/profile` | ✅ Yes |
| Graph Explorer | `/graph` | ✅ Yes |

### 6. AI Chatbot
- Built the floating **GI Smart Assistant** chatbot (`components/Chatbot.tsx`)
- Integrated with the **Anthropic Claude API** (`app/api/chat/route.ts`)
- Features:
  - Floating orange chat bubble visible on every page
  - Quick suggestion buttons for common questions
  - Keyword-based fallback answers when API credits are unavailable
  - Smooth scroll, loading indicator, typing animation
- Topics covered: GI index, meal ideas, blood sugar, weight loss, hydration, exercise

### 7. Food Categories UI
- Redesigned the **Foods page** category filter
- Replaced raw scattered Neo4j category tags with a clean **grouped dropdown**
- Categories organised into 4 groups:
  - 🌿 Plant Based
  - 🥩 Animal Products
  - 🥫 Packaged Foods
  - 💪 Health & Diet
- Active filter tags with one-click removal

---

## 🛠 Tech Stack Used
- **Next.js 16** (App Router)
- **TypeScript**
- **Tailwind CSS v3**
- **shadcn/ui** (custom components)
- **Better Auth** (authentication)
- **Prisma ORM** (database layer)
- **Neon PostgreSQL** (cloud database)
- **Anthropic Claude API** (AI chatbot)
- **Neo4j** (graph database — shared with Big Data course)