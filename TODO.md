# Fix "Unauthorized" Errors in Dashboard Layouts - COMPLETED

## Task Analysis
Multiple components were throwing "Unauthorized" errors because cookies were not being sent with fetch requests, causing the server-side API routes to fail authentication.

## Files Fixed

### 1. components/employee/EmployeeLayout.tsx ✅
- Added `credentials: 'include'` to all fetch calls:
  - `loadNotifications` (GET)
  - `handleDelete` (DELETE)
  - `handleMarkAsRead` (PATCH)
- Fixed useCallback dependency by using a ref instead of state
- Added proper 401 status handling

### 2. components/admin/AdminLayout.tsx ✅
- Added `credentials: 'include'` to:
  - `fetchNotifications` (GET)
  - `handleDelete` (DELETE)
  - `fetchProfile` in AdminPortalLayout (GET)

## Root Cause
The issue was that cookies were not being sent with the fetch requests, causing the server-side API routes to fail authentication. By adding `credentials: 'include'`, the browser now includes the Supabase session cookies with each API request, allowing proper authentication.

## Changes Made:
1. Added `credentials: 'include'` to all fetch requests to ensure cookies are sent
2. This ensures the Supabase session cookies are included with each API request

