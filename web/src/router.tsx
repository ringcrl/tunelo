import {
  createRouter,
  createRootRoute,
  createRoute,
  Outlet,
} from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import Explorer from "@/pages/Explorer";
import Viewer from "@/pages/Viewer";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1 },
  },
});

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const browseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  validateSearch: (s: Record<string, unknown>) => ({
    path: (s.path as string) || "/",
  }),
  component: Explorer,
});

const viewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/view",
  validateSearch: (s: Record<string, unknown>) => ({
    path: (s.path as string) || "/",
  }),
  component: Viewer,
});

const routeTree = rootRoute.addChildren([browseRoute, viewRoute]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
