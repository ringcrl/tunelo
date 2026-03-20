import {
  createRouter,
  createRootRoute,
  createRoute,
  Outlet,
} from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import Explorer from "@/pages/Explorer";
import Viewer from "@/pages/Viewer";

// ─── Query Client ──────────────────────────────────────────────
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// ─── Root Route ────────────────────────────────────────────────
const rootRoute = createRootRoute({
  component: () => (
    <TooltipProvider delay={400}>
      <Outlet />
    </TooltipProvider>
  ),
});

// ─── Browse Route (catch-all for directories) ──────────────────
// Using search params: ?path=/some/dir/
const browseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  validateSearch: (search: Record<string, unknown>) => ({
    path: (search.path as string) || "/",
  }),
  component: Explorer,
});

// ─── View Route (file viewer) ──────────────────────────────────
// /view?path=/some/file.txt
const viewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/view",
  validateSearch: (search: Record<string, unknown>) => ({
    path: (search.path as string) || "/",
  }),
  component: Viewer,
});

// ─── Router ────────────────────────────────────────────────────
const routeTree = rootRoute.addChildren([browseRoute, viewRoute]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  context: {},
});

// Type registration for TypeScript
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
