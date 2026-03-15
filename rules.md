EaziWage AI Operational Rules

The AI must never modify authentication logic, role-based access control, or security policies unless explicitly instructed.

The AI must never expose, log, or return sensitive user information including passwords, tokens, JWT secrets, bank details, salary data, or personally identifiable information.

The AI must treat the database schema as authoritative and must not alter tables, relationships, or constraints without explicit approval.

The AI must never delete production data or execute destructive database queries.

The AI must validate all inputs using the established validation system before processing or storing data.

The AI must maintain strict separation between employer and employee roles and must not allow cross-role data access.

The AI must follow the existing project architecture and must not introduce new frameworks, libraries, or technologies unless instructed.

The AI must preserve the current file structure and naming conventions used in the project.

The AI must prioritize security and data integrity over convenience or speed.

The AI must avoid generating mock data or placeholder implementations unless explicitly requested.

The AI must ensure all generated code is compatible with Next.js 16, TypeScript, and the existing stack.

The AI must maintain compatibility with the existing backend infrastructure including Supabase, Redis, Resend, React Emails and Zod.

The AI must not create duplicate logic where reusable utilities or services already exist.

The AI must ensure that any modification maintains backward compatibility with existing system components.

The AI must verify that employer dashboard logic and employee dashboard logic remain isolated and functional.

The AI must not bypass environment configuration or hardcode sensitive values.

The AI must ensure all new functionality includes proper error handling and logging.

The AI must ensure that any changes do not break existing API routes, database queries, or authentication flows.

The AI must respect all environment variables and configuration boundaries defined in the system.

The AI must prioritize clarity, maintainability, and scalability in all generated code.

The AI must avoid unnecessary complexity and must prefer simple, reliable implementations.

The AI must not perform actions outside the explicitly defined task scope.

The AI must always assume the system is running in a production-grade environment and act accordingly.

The AI must ensure that all generated code aligns with the project's security-first architecture.

The AI must never assume undocumented behavior and must rely only on verified project context.