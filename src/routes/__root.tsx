import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import logoAsset from "../assets/logo-v2.webp.asset.json";
import level1 from "../assets/level1.webp.asset.json";
import level2 from "../assets/level2.webp.asset.json";
import level3 from "../assets/level3.webp.asset.json";
import level4 from "../assets/level4.webp.asset.json";
import level5 from "../assets/level5.webp.asset.json";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover",
      },
      { title: "바른말 수호대 — 초등 국어 매체 리터러시" },
      {
        name: "description",
        content: "초등학생과 함께 만드는 바른 우리말 사전과 대화 예절 시뮬레이터",
      },
      { name: "author", content: "바른말 수호대" },
      { property: "og:title", content: "바른말 수호대 — 초등 국어 매체 리터러시" },
      {
        property: "og:description",
        content: "초등학생과 함께 만드는 바른 우리말 사전과 대화 예절 시뮬레이터",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "바른말 수호대 — 초등 국어 매체 리터러시" },
      {
        name: "twitter:description",
        content: "초등학생과 함께 만드는 바른 우리말 사전과 대화 예절 시뮬레이터",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/30d825a9-dceb-4b5b-841f-f294c8683a8b/id-preview-c9b10eb5--c7048151-1aba-4248-b2b3-bf16423336e2.lovable.app-1783698490932.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/30d825a9-dceb-4b5b-841f-f294c8683a8b/id-preview-c9b10eb5--c7048151-1aba-4248-b2b3-bf16423336e2.lovable.app-1783698490932.png",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://cdn.jsdelivr.net", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preload", as: "image", href: logoAsset.url, fetchpriority: "high" },
      { rel: "preload", as: "image", href: level1.url },
      { rel: "preload", as: "image", href: level2.url },
      { rel: "preload", as: "image", href: level3.url },
      { rel: "preload", as: "image", href: level4.url },
      { rel: "preload", as: "image", href: level5.url },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <SonnerToaster richColors position="top-center" />
    </QueryClientProvider>
  );
}
