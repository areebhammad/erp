---
name: TanStack Start Development
description: Comprehensive guide for building full-stack React applications with TanStack Start, including routing, server functions, SSR, deployment, and best practices.
---

# TanStack Start Development Skill

## Overview

TanStack Start is a full-stack React framework (currently in Release Candidate stage) that provides:
- **Full-document SSR** with streaming support
- **Type-safe routing** powered by TanStack Router
- **Server functions** for seamless client-server communication
- **File-based routing** with automatic code-splitting
- **Server routes & API routes** for backend endpoints
- **Middleware & context** for request/response handling
- **Universal deployment** to any Vite-compatible hosting provider
- **End-to-end type safety** across the entire stack

### Core Dependencies
- [TanStack Router](https://tanstack.com/router): Type-safe routing with advanced features
- [Vite](https://vite.dev/): Fast development and optimized production builds

### When to Use TanStack Start vs TanStack Router Alone

**Use TanStack Start if you need:**
- Full-document SSR and SEO optimization
- Streaming for progressive page loading
- Server functions for type-safe RPCs
- API routes and backend endpoints
- Middleware for request handling
- Full-stack bundling and deployment

**Use TanStack Router alone if:**
- Building a pure SPA (no SSR needed)
- Don't need server-side features
- Already have a separate backend

## Project Structure

```
project-root/
├── src/
│   ├── routes/              # File-based routes
│   │   ├── __root.tsx      # Root route (required)
│   │   ├── index.tsx       # Homepage (/)
│   │   ├── about.tsx       # /about
│   │   ├── posts.tsx       # /posts
│   │   └── posts/$postId.tsx  # /posts/:postId
│   ├── router.tsx          # Router configuration
│   ├── utils/
│   │   ├── *.functions.ts  # Server function wrappers
│   │   ├── *.server.ts     # Server-only code
│   │   └── schemas.ts      # Shared validation schemas
│   └── app.css             # Global styles
├── .env                     # Environment variables
├── vite.config.ts          # Vite configuration
└── app.config.ts           # TanStack Start configuration
```

## Getting Started

### 1. Create a New Project

**Using CLI (Recommended):**
```bash
# With pnpm
pnpm create @tanstack/start@latest

# With npm
npm create @tanstack/start@latest
```

This will prompt you to configure:
- Project name
- Tailwind CSS
- ESLint
- Other options

**Clone an Example:**
```bash
npx gitpick TanStack/router/tree/main/examples/react/start-basic my-app
cd my-app
npm install
npm run dev
```

### 2. Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run type checking
npm run type-check
```

## Core Concepts

### 1. File-Based Routing

Routes are defined in the `src/routes` directory. The file structure determines the URL structure.

**Key Files:**
- `__root.tsx` - Root route (always rendered, contains document shell)
- `index.tsx` - Homepage `/`
- `about.tsx` - `/about`
- `posts/$postId.tsx` - `/posts/:postId` (dynamic parameter)
- `_layout.tsx` - Layout route (doesn't affect URL)

**Root Route Example (`__root.tsx`):**
```tsx
import { Outlet, createRootRoute, HeadContent, Scripts } from '@tanstack/react-router'
import type { ReactNode } from 'react'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'My App' },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
```

**Regular Route Example:**
```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/posts')({
  loader: async () => {
    const posts = await fetchPosts()
    return { posts }
  },
  component: PostsPage,
})

function PostsPage() {
  const { posts } = Route.useLoaderData()
  return (
    <div>
      <h1>Posts</h1>
      <ul>
        {posts.map(post => (
          <li key={post.id}>{post.title}</li>
        ))}
      </ul>
    </div>
  )
}
```

**Dynamic Route Example:**
```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params }) => {
    const post = await fetchPost(params.postId)
    return { post }
  },
  component: PostPage,
})

function PostPage() {
  const { post } = Route.useLoaderData()
  return (
    <div>
      <h1>{post.title}</h1>
      <p>{post.content}</p>
    </div>
  )
}
```

### 2. Server Functions

Server functions enable type-safe communication between client and server. They run only on the server but can be called from anywhere.

**Creating Server Functions:**
```tsx
import { createServerFn } from '@tanstack/react-start'

// GET request (default)
export const getServerTime = createServerFn().handler(async () => {
  // This runs only on the server
  return new Date().toISOString()
})

// POST request
export const saveData = createServerFn({ method: 'POST' })
  .handler(async (data: { title: string }) => {
    // Server-only logic - database access, env vars, etc.
    await db.insert(data)
    return { success: true }
  })
```

**With Validation (Zod):**
```tsx
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
})

export const createUser = createServerFn({ method: 'POST' })
  .validator(userSchema)
  .handler(async ({ data }) => {
    // data is now type-safe and validated
    await db.users.create(data)
    return { success: true }
  })
```

**Calling Server Functions:**

From route loaders:
```tsx
export const Route = createFileRoute('/posts')({
  loader: () => getPosts(),
})
```

From components:
```tsx
import { useServerFn } from '@tanstack/react-start'

function MyComponent() {
  const getPosts = useServerFn(getServerPosts)
  
  const handleClick = async () => {
    const posts = await getPosts()
    console.log(posts)
  }
  
  return <button onClick={handleClick}>Load Posts</button>
}
```

**File Organization Best Practice:**
```
src/utils/
├── users.functions.ts  # Server function wrappers (safe to import anywhere)
├── users.server.ts     # Server-only helpers (only import in server contexts)
└── schemas.ts          # Shared validation schemas (client-safe)
```

**Error Handling:**
```tsx
import { createServerFn } from '@tanstack/react-start'
import { redirect, notFound } from '@tanstack/react-router'

export const getPost = createServerFn()
  .handler(async (id: string) => {
    const post = await db.posts.findById(id)
    
    if (!post) {
      throw notFound() // Returns 404
    }
    
    if (!hasAccess(post)) {
      throw redirect({ to: '/login' }) // Redirects
    }
    
    return post
  })
```

### 3. Router Configuration

The `router.tsx` file configures TanStack Router behavior:

```tsx
// src/router.tsx
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent', // Preload on hover/focus
    defaultPreloadDelay: 100,
    defaultStaleTime: 5000,
  })
  
  return router
}
```

**Key Configuration Options:**
- `scrollRestoration`: Automatically restore scroll position on navigation
- `defaultPreload`: When to preload routes ('intent', 'viewport', or false)
- `defaultPreloadDelay`: Delay before preloading (ms)
- `defaultStaleTime`: How long data is considered fresh (ms)

### 4. Data Loading

**Route Loaders:**
Loaders fetch data before rendering the route.

```tsx
export const Route = createFileRoute('/posts')({
  loader: async ({ params, context, abortController }) => {
    // Access to:
    // - params: Route parameters
    // - context: Router context
    // - abortController: For cancellation
    
    const posts = await fetchPosts({ signal: abortController.signal })
    return { posts }
  },
  // Access data in component
  component: PostsPage,
})

function PostsPage() {
  const { posts } = Route.useLoaderData()
  // Use posts...
}
```

**With Search Params:**
```tsx
export const Route = createFileRoute('/posts')({
  validateSearch: z.object({
    page: z.number().default(1),
    limit: z.number().default(10),
  }),
  loaderDeps: ({ search }) => ({ page: search.page, limit: search.limit }),
  loader: async ({ deps }) => {
    const posts = await fetchPosts(deps.page, deps.limit)
    return { posts }
  },
})
```

**Stale-While-Revalidate Caching:**
```tsx
export const Route = createFileRoute('/posts')({
  loader: () => fetchPosts(),
  staleTime: 10000, // Data is fresh for 10 seconds
  gcTime: 30000,    // Garbage collect after 30 seconds
})
```

**With React Query (External Caching):**
```tsx
import { createFileRoute } from '@tanstack/react-router'
import { queryOptions, useQuery } from '@tanstack/react-query'

const postsQueryOptions = queryOptions({
  queryKey: ['posts'],
  queryFn: () => fetchPosts(),
})

export const Route = createFileRoute('/posts')({
  loader: ({ context }) => {
    // Prefetch in loader
    return context.queryClient.ensureQueryData(postsQueryOptions)
  },
  component: PostsPage,
})

function PostsPage() {
  // Use query in component
  const { data: posts } = useQuery(postsQueryOptions)
  return <div>{/* ... */}</div>
}
```

### 5. Middleware

Middleware customizes behavior of server routes and server functions.

**Request Middleware:**
```tsx
import { createMiddleware } from '@tanstack/react-start'

const authMiddleware = createMiddleware()
  .server(async ({ next, request, data }) => {
    const session = await getSession(request.headers.get('cookie'))
    
    if (!session) {
      throw redirect({ to: '/login' })
    }
    
    // Pass session to next middleware/route
    return next({
      context: { session },
    })
  })
```

**Server Function Middleware:**
```tsx
const loggingMiddleware = createMiddleware()
  .client(async ({ next, data }) => {
    console.log('Calling server function with:', data)
    return next()
  })
  .server(async ({ next, data, context }) => {
    const start = Date.now()
    const result = await next()
    console.log(`Took ${Date.now() - start}ms`)
    return result
  })
```

**Using Middleware:**
```tsx
export const getProtectedData = createServerFn()
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    // context.session is available here
    return db.query({ userId: context.session.userId })
  })
```

**Global Middleware:**
Configure in `router.tsx`:
```tsx
export function getRouter() {
  const router = createRouter({
    routeTree,
    context: {
      // Initial context
    },
    Wrap: ({ children }) => {
      // Apply global middleware
      return <>{children}</>
    },
  })
  
  return router
}
```

### 6. Authentication

**Implementation Pattern:**

1. **Session Management:**
```tsx
// utils/session.server.ts
import { createServerFn } from '@tanstack/react-start'
import { setCookie, getCookie } from 'vinxi/http'

export const getSession = createServerFn()
  .handler(async () => {
    const sessionId = getCookie('sessionId')
    if (!sessionId) return null
    
    return await db.sessions.findById(sessionId)
  })

export const login = createServerFn({ method: 'POST' })
  .handler(async (credentials: { email: string; password: string }) => {
    const user = await db.users.findByEmail(credentials.email)
    if (!user || !await verifyPassword(credentials.password, user.hash)) {
      throw new Error('Invalid credentials')
    }
    
    const session = await db.sessions.create({ userId: user.id })
    setCookie('sessionId', session.id, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    })
    
    return { user }
  })
```

2. **Protected Routes:**
```tsx
// routes/dashboard.tsx
export const Route = createFileRoute('/dashboard')({
  beforeLoad: async ({ context }) => {
    const session = await getSession()
    if (!session) {
      throw redirect({ to: '/login' })
    }
    return { session }
  },
  component: DashboardPage,
})
```

3. **Auth Context:**
```tsx
// Use router context to share auth state
export function getRouter() {
  const router = createRouter({
    routeTree,
    context: {
      auth: null as Session | null,
    },
    beforeLoad: async () => {
      const session = await getSession()
      return { auth: session }
    },
  })
  
  return router
}
```

**Popular Auth Solutions:**
- [Clerk](https://clerk.dev) - Complete auth platform with UI components
- [WorkOS](https://workos.com) - Enterprise SSO and compliance
- [Better Auth](https://www.better-auth.com/) - Open-source TypeScript library
- [Auth.js](https://authjs.dev/) - OAuth library (80+ providers)

### 7. Environment Variables

**Setup:**
```bash
# .env
DATABASE_URL=postgresql://user:pass@localhost:5432/mydb
VITE_APP_NAME=My TanStack Start App
VITE_API_URL=https://api.example.com
```

**Usage:**

Server-side (all variables accessible):
```tsx
const getUsers = createServerFn().handler(async () => {
  // Access any environment variable
  const db = await connect(process.env.DATABASE_URL)
  return db.users.findMany()
})
```

Client-side (only `VITE_` prefixed):
```tsx
export function AppHeader() {
  // Only VITE_ prefixed variables exposed to client
  return <h1>{import.meta.env.VITE_APP_NAME}</h1>
}
```

**TypeScript Declarations:**
```tsx
// env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME: string
  readonly VITE_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

**Security Best Practices:**
- ✅ Never expose secrets to client (no `VITE_` prefix for secrets)
- ✅ Use `process.env` only in server functions/API routes
- ✅ Validate required variables at startup
- ❌ Don't use sensitive keys with `VITE_` prefix

### 8. Static Prerendering

Generate static HTML files for improved performance and SEO.

**Configuration (`vite.config.ts`):**
```tsx
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    tanstackStart({
      prerender: {
        enabled: true,
        autoSubfolderIndex: true,     // `/page/index.html` vs `/page.html`
        autoStaticPathsDiscovery: true, // Auto-discover static routes
        concurrency: 14,               // Parallel prerender jobs
        crawlLinks: true,              // Follow links to find more pages
        filter: ({ path }) => !path.startsWith('/admin'), // Skip admin pages
        retryCount: 2,
        retryDelay: 1000,
        failOnError: true,
        onSuccess: ({ page }) => {
          console.log(`Rendered ${page.path}!`)
        },
      },
      // Manually specify pages to prerender
      pages: [
        { path: '/about', prerender: { enabled: true } },
      ],
    }),
    viteReact(),
  ],
})
```

**What Gets Prerendered:**
- ✅ Static routes (no parameters)
- ✅ Linked pages (when `crawlLinks: true`)
- ❌ Dynamic routes (e.g., `/posts/$postId`) unless linked
- ❌ Layout routes (prefixed with `_`)
- ❌ API routes (routes without components)

### 9. API Routes

Create REST API endpoints alongside your frontend.

**Example:**
```tsx
// routes/api/users.ts
import { createAPIRoute } from '@tanstack/react-start'

export const Route = createAPIRoute({
  GET: async ({ request }) => {
    const users = await db.users.findMany()
    return Response.json(users)
  },
  POST: async ({ request }) => {
    const data = await request.json()
    const user = await db.users.create(data)
    return Response.json(user, { status: 201 })
  },
})
```

**With Authentication:**
```tsx
export const Route = createAPIRoute({
  GET: async ({ request }) => {
    const session = await getSession(request.headers.get('cookie'))
    if (!session) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const data = await db.getData(session.userId)
    return Response.json(data)
  },
})
```

### 10. Forms & Mutations

**Using TanStack Form:**
```tsx
import { useForm } from '@tanstack/react-form'
import { createServerFn } from '@tanstack/react-start'

const submitForm = createServerFn({ method: 'POST' })
  .handler(async (data: FormData) => {
    const result = await db.insert(data)
    return result
  })

function MyForm() {
  const form = useForm({
    defaultValues: {
      name: '',
      email: '',
    },
    onSubmit: async ({ value }) => {
      await submitForm(value)
    },
  })
  
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
    >
      <form.Field name="name">
        {(field) => (
          <input
            value={field.state.value}
            onChange={(e) => field.handleChange(e.target.value)}
          />
        )}
      </form.Field>
      <button type="submit">Submit</button>
    </form>
  )
}
```

**Progressive Enhancement:**
Forms work even without JavaScript using standard HTML form submission.

```tsx
const handleForm = createServerFn({ method: 'POST' })
  .handler(async (formData: FormData) => {
    const name = formData.get('name')
    // Process form...
    return redirect({ to: '/success' })
  })

function MyForm() {
  return (
    <form action={handleForm.url} method="post">
      <input name="name" />
      <button type="submit">Submit</button>
    </form>
  )
}
```

## Deployment

### Build for Production

```bash
npm run build
```

This creates:
- `.output/` directory with compiled server and client code
- Static assets in `.output/public/`

### Hosting Options

**Recommended Partners:**
1. **Cloudflare Workers** - Edge computing, global CDN
2. **Netlify** - Git-based deployment, serverless functions
3. **Railway** - Full-stack platform, built-in databases

**Other Options:**
- Vercel
- Node.js / Docker
- Bun
- Nitro (universal deployment)
- Appwrite Sites

**Deployment Configuration:**

Cloudflare Workers:
```bash
npm run build
# Files in .output/ ready to deploy
```

Netlify:
```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = ".output/public"
  functions = ".output/server"
```

Node.js:
```bash
npm run build
node .output/server/index.mjs
```

Docker:
```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --production

COPY .output .output

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
```

## Best Practices

### 1. File Organization

```
src/
├── routes/              # Route definitions
├── components/          # Reusable UI components
├── utils/
│   ├── *.functions.ts  # Server function wrappers
│   ├── *.server.ts     # Server-only code
│   └── api.ts          # API client helpers
├── hooks/               # Custom React hooks
├── lib/                 # Third-party integrations
└── styles/              # Global styles
```

### 2. Server Function Organization

**DO:**
```tsx
// utils/users.functions.ts (safe to import anywhere)
export const getUser = createServerFn()
  .handler(async (id: string) => {
    return getUserFromDB(id) // Import server helper here
  })
```

**DON'T:**
```tsx
// DON'T import server-only code at module level in .functions.ts
import { db } from './db.server' // ❌ Will leak to client

export const getUser = createServerFn()
  .handler(async (id: string) => {
    return db.users.find(id)
  })
```

**INSTEAD:**
```tsx
// utils/users.functions.ts
export const getUser = createServerFn()
  .handler(async (id: string) => {
    // Import server code inside handler
    const { getUserFromDB } = await import('./users.server')
    return getUserFromDB(id)
  })
```

### 3. Type Safety

**Route Parameters:**
```tsx
export const Route = createFileRoute('/posts/$postId')({
  params: {
    parse: (params) => ({
      postId: z.string().parse(params.postId),
    }),
    stringify: (params) => ({
      postId: String(params.postId),
    }),
  },
})
```

**Search Params:**
```tsx
import { z } from 'zod'

const searchSchema = z.object({
  page: z.number().int().positive().default(1),
  sort: z.enum(['asc', 'desc']).default('desc'),
})

export const Route = createFileRoute('/posts')({
  validateSearch: searchSchema,
})
```

### 4. Error Handling

**Route-level Error Boundaries:**
```tsx
export const Route = createFileRoute('/posts')({
  loader: () => fetchPosts(),
  errorComponent: ({ error }) => {
    return (
      <div>
        <h1>Error loading posts</h1>
        <p>{error.message}</p>
      </div>
    )
  },
})
```

**Global Error Boundary:**
```tsx
// __root.tsx
export const Route = createRootRoute({
  errorComponent: ({ error, reset }) => {
    return (
      <div>
        <h1>Something went wrong</h1>
        <pre>{error.message}</pre>
        <button onClick={reset}>Try again</button>
      </div>
    )
  },
})
```

### 5. Performance Optimization

**Lazy Loading Components:**
```tsx
import { lazy } from 'react'

const HeavyComponent = lazy(() => import('./HeavyComponent'))

export const Route = createFileRoute('/heavy')({
  component: () => (
    <Suspense fallback={<div>Loading...</div>}>
      <HeavyComponent />
    </Suspense>
  ),
})
```

**Preloading:**
```tsx
import { Link } from '@tanstack/react-router'

// Preload on hover
<Link to="/posts" preload="intent">
  View Posts
</Link>

// Preload on viewport
<Link to="/posts" preload="viewport">
  View Posts
</Link>
```

**Image Optimization:**
```tsx
// Use Vite's asset handling
import logoUrl from './logo.png'

<img src={logoUrl} alt="Logo" />
```

### 6. CSS & Styling

**Supported Solutions:**
- TailwindCSS (configure during project setup)
- CSS Modules
- Vanilla CSS
- Styled Components / Emotion
- UnoCSS

**Example with Tailwind:**
```tsx
function Button({ children }: { children: ReactNode }) {
  return (
    <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
      {children}
    </button>
  )
}
```

**Global Styles:**
```tsx
// __root.tsx
import './app.css'

export const Route = createRootRoute({
  component: RootComponent,
})
```

### 7. SEO

**Meta Tags:**
```tsx
export const Route = createFileRoute('/about')({
  head: () => ({
    meta: [
      { title: 'About Us - My Company' },
      { name: 'description', content: 'Learn about our company...' },
      { property: 'og:title', content: 'About Us' },
      { property: 'og:image', content: '/og-image.png' },
    ],
  }),
  component: AboutPage,
})
```

**Dynamic Meta Tags:**
```tsx
export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params }) => {
    const post = await fetchPost(params.postId)
    return { post }
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData.post.title} - Blog` },
      { name: 'description', content: loaderData.post.excerpt },
      { property: 'og:title', content: loaderData.post.title },
    ],
  }),
})
```

## Common Patterns

### 1. Protected Routes

```tsx
// middleware/auth.ts
export const authMiddleware = createMiddleware()
  .server(async ({ next, request }) => {
    const session = await getSession(request)
    if (!session) {
      throw redirect({ to: '/login' })
    }
    return next({ context: { session } })
  })

// routes/dashboard.tsx
export const Route = createFileRoute('/dashboard')({
  beforeLoad: async () => {
    // Apply auth check
    const session = await getSession()
    if (!session) {
      throw redirect({ to: '/login' })
    }
    return { session }
  },
})
```

### 2. Pagination

```tsx
export const Route = createFileRoute('/posts')({
  validateSearch: z.object({
    page: z.number().default(1),
  }),
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: async ({ deps }) => {
    const result = await fetchPosts({ page: deps.page, limit: 10 })
    return result
  },
  component: PostsList,
})

function PostsList() {
  const { posts, total } = Route.useLoaderData()
  const navigate = useNavigate()
  const search = Route.useSearch()
  
  return (
    <div>
      {posts.map(post => <Post key={post.id} {...post} />)}
      
      <button
        onClick={() => navigate({ search: { page: search.page - 1 } })}
        disabled={search.page === 1}
      >
        Previous
      </button>
      
      <button
        onClick={() => navigate({ search: { page: search.page + 1 } })}
        disabled={search.page * 10 >= total}
      >
        Next
      </button>
    </div>
  )
}
```

### 3. Loading States

```tsx
export const Route = createFileRoute('/posts')({
  loader: () => fetchPosts(),
  pendingComponent: () => <div>Loading posts...</div>,
  pendingMs: 1000, // Show pending component after 1s
  component: PostsPage,
})
```

### 4. Optimistic Updates

```tsx
import { useRouter } from '@tanstack/react-router'

function ToggleLike({ postId }: { postId: string }) {
  const router = useRouter()
  const [optimisticLiked, setOptimisticLiked] = useState(false)
  
  const handleLike = async () => {
    // Optimistically update UI
    setOptimisticLiked(true)
    
    try {
      await likePost(postId)
      // Invalidate and refetch
      router.invalidate()
    } catch (error) {
      // Revert on error
      setOptimisticLiked(false)
    }
  }
  
  return <button onClick={handleLike}>Like</button>
}
```

### 5. File Uploads

```tsx
const uploadFile = createServerFn({ method: 'POST' })
  .handler(async (formData: FormData) => {
    const file = formData.get('file') as File
    const buffer = await file.arrayBuffer()
    
    // Save file
    const path = await saveFile(buffer, file.name)
    return { url: path }
  })

function FileUpload() {
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const result = await uploadFile(formData)
    console.log('Uploaded:', result.url)
  }
  
  return (
    <form onSubmit={handleSubmit}>
      <input type="file" name="file" />
      <button type="submit">Upload</button>
    </form>
  )
}
```

## Troubleshooting

### Common Issues

**1. Server functions not working:**
- ✅ Ensure you're using `createServerFn()` correctly
- ✅ Check that handler is defined with `.handler()`
- ✅ Verify you're calling the function (not just referencing it)

**2. Environment variables undefined:**
- ✅ Server: Use `process.env.VAR_NAME`
- ✅ Client: Use `import.meta.env.VITE_VAR_NAME` (must be prefixed with `VITE_`)
- ✅ Restart dev server after changing `.env`

**3. Type errors:**
- ✅ Run `npm run type-check` to see full errors
- ✅ Ensure route tree is generated: `routeTree.gen.ts`
- ✅ Check TypeScript version compatibility

**4. Build failures:**
- ✅ Check for server-only imports in client code
- ✅ Verify all dependencies are installed
- ✅ Clear `.output/` and rebuild

**5. Hydration mismatches:**
- ✅ Ensure server and client render the same HTML
- ✅ Avoid using browser APIs during SSR
- ✅ Use `useEffect` for client-only logic

## Resources

### Official Documentation
- [TanStack Start Docs](https://tanstack.com/start/latest)
- [TanStack Router Docs](https://tanstack.com/router/latest)
- [Vite Documentation](https://vite.dev/)

### Examples
- [Official Examples](https://github.com/TanStack/router/tree/main/examples/react)
- Basic: `start-basic`
- Auth: `start-basic-auth`
- React Query: `start-basic-react-query`
- Clerk: `start-clerk-basic`
- Supabase: `start-supabase-basic`

### Community
- [GitHub Discussions](https://github.com/TanStack/router/discussions)
- [Discord Community](https://tlinz.com/discord)
- [Twitter @tan_stack](https://twitter.com/tan_stack)

## Migration Guides

### From Next.js

Key differences:
- File-based routing syntax differs (use `$param` instead of `[param]`)
- Server functions replace API routes + server components pattern
- Middleware works differently
- No `.next` directory (uses `.output`)

### From Remix

Similarities:
- Both use file-based routing
- Loader pattern is similar
- Form handling concepts similar

Differences:
- TanStack uses `createServerFn()` instead of action/loader exports
- Different file naming conventions
- Middleware system is different

## Version Information

**Current Status:** Release Candidate (RC)
- API is considered stable
- Feature-complete
- May have bugs or issues (report on GitHub)
- Road to v1.0 is expected to be quick

**Limitations:**
- React Server Components (RSC) not yet supported (coming soon)

## When Using This Skill

1. **Always check the current version** - TanStack Start is rapidly evolving
2. **Prefer server functions over API routes** for type safety
3. **Use file-based routing conventions** strictly
4. **Implement proper error boundaries** at route and app level
5. **Use TypeScript** for full type safety benefits
6. **Follow security best practices** especially for env vars and auth
7. **Test both client and server code** separately
8. **Optimize for production** with prerendering where appropriate
9. **Monitor bundle sizes** using Vite's built-in analysis
10. **Keep dependencies updated** especially `@tanstack/react-start` and `@tanstack/react-router`
