# Fix Nested Button Hydration Error - TODO

## Task
Fix the hydration error caused by `<button>` being a descendant of `<button>` in the employee notifications page.

## Steps
- [x] 1. Fix `components/ui/dropdown-menu.tsx` - Implement proper `asChild` handling in `DropdownMenuTrigger`
- [x] 2. Fix `components/ui/button.tsx` - Implement proper `asChild` handling in `Button` component
- [x] 3. Test the fix by running the build

## Status
- [x] Completed

