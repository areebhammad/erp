# ERP System Frontend

A modern, AI-first ERP solution built with TanStack Start, React 19, and TypeScript.

## Tech Stack

- **Framework**: TanStack Start (React 19) + TypeScript
- **Routing**: TanStack Router (File-based routing, Type-safe)
- **State Management**: TanStack Query (Server state), Zustand (Client state)
- **Styling**: Tailwind CSS v4, Shadcn/ui (Components), Hugeicons
- **Forms**: TanStack Form + Zod
- **Testing**: Vitest, React Testing Library, Playwright
- **Tooling**: Biome (Linting/Formatting), Vite

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+

### Installation

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

### Build

```bash
pnpm build
```

### Testing

```bash
pnpm test
```

## Project Structure

```
src/
├── components/       # Reusable UI components
│   ├── app/         # Application-specific components
│   └── ui/          # Shadcn/ui components
├── hooks/           # Custom React hooks
├── lib/             # Core libraries and utilities
│   ├── api/         # API client and related utilities
│   ├── query/       # TanStack Query configuration
│   └── ws/          # WebSocket client
├── routes/          # File-based routes
├── server/          # Server-side middleware
├── store/           # Zustand stores
└── integrations/    # Third-party integrations
```

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

```bash
cp .env.example .env.local
```

## Linting & Formatting

```bash
pnpm lint
pnpm format
pnpm check
```

## Adding Components

Add Shadcn/ui components:

```bash
pnpm dlx shadcn@latest add button
```

## Internationalization

This project uses ParaglideJS for i18n:

- Messages live in `messages/`
- URLs are localized through the Paraglide Vite plugin

## Learn More

- [TanStack Router Documentation](https://tanstack.com/router)
- [TanStack Start Documentation](https://tanstack.com/start)
- [Shadcn/ui Documentation](https://ui.shadcn.com/)
