You are a senior software engineer doing a thorough code review of this entire Next.js + TypeScript + Prisma + Tailwind + shadcn project.

Review every single file in the project with extreme attention to detail. For each issue found, search the web for references, best practices and official documentation to confirm the problem and suggest the best solution.

Review the following in order:

1. TYPESCRIPT
- Implicit any types
- Missing or incorrect types in functions, props, API routes and Prisma queries
- Type inconsistencies between frontend and backend
- Search reference: TypeScript best practices Next.js

2. NEXT.JS APP ROUTER
- Incorrect use of server vs client components
- Missing or incorrect use of use client directive
- Data fetching patterns (should use server components where possible)
- Missing loading.tsx or error.tsx files
- Incorrect use of useEffect for data fetching that could be server-side
- Search reference: Next.js App Router best practices

3. API ROUTES
- Missing input validation in all POST and PUT routes
- Missing error handling and incorrect HTTP status codes
- Security issues: unprotected routes, missing auth checks
- N+1 query patterns in Prisma
- Missing try/catch blocks
- Search reference: Next.js API routes security best practices

4. PRISMA
- Missing indexes on foreign keys and frequently queried fields
- Inefficient queries (select all fields when only some are needed)
- Missing transactions where multiple writes happen together
- Cascade delete configuration
- Search reference: Prisma performance best practices

5. AUTHENTICATION (NextAuth.js v5)
- Unprotected routes that should require login
- JWT token security
- Session handling issues
- Search reference: NextAuth.js v5 security best practices

6. REACT COMPONENTS
- Unnecessary re-renders (missing useMemo, useCallback)
- Missing key props in lists
- Memory leaks (missing cleanup in useEffect)
- Props drilling that could be simplified
- Search reference: React performance optimization

7. TAILWIND + RESPONSIVE DESIGN
- Missing responsive prefixes (sm:, md:, lg:)
- Elements that break on mobile (320px) or tablet (768px)
- Touch targets smaller than 44px
- Tables without overflow-x-auto wrapper
- Search reference: Tailwind CSS responsive design best practices

8. SECURITY
- Environment variables exposed to client
- API routes without authentication
- Input sanitization
- SQL injection risks via Prisma raw queries
- Search reference: Next.js security checklist

9. PERFORMANCE
- Missing Image optimization (next/image)
- Missing dynamic imports for heavy components
- Bundle size issues
- Missing caching strategies
- Search reference: Next.js performance optimization

10. CODE QUALITY
- Duplicate logic that could be extracted to utilities
- Dead code and unused imports
- Inconsistent naming conventions
- Functions that are too long or do too much
- Missing comments on complex logic

For each issue found:
- Show the file path and line number
- Explain the problem clearly in Portuguese
- Show the current code
- Show the fixed code
- Add the web reference used to confirm the fix

After the full review, create a prioritized action plan:
- P0: Critical (security, data loss risk)
- P1: Important (bugs, performance)
- P2: Moderate (code quality, types)
- P3: Low (nice to have)

Take your time. Be thorough. Search the web whenever in doubt.
