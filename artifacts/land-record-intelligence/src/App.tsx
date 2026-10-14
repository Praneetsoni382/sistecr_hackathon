import { type ReactNode } from 'react';
import { ClerkProvider, RedirectToSignIn, SignIn, SignUp } from '@clerk/react';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/view-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SystemCacheProvider } from '@/lib/system-cache-context';
import { LanguageProvider } from '@/lib/language-context';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  useParams,
  Router as WouterRouter,
} from 'wouter';
import {
  CasesPage,
  CaseWorkspacePage,
  DashboardPage,
  RecordsPage,
  ExistingRecordsPage,
  AuditTrailPage,
  PublicHome,
  SettingsPage,
  UsageMonitorPage,
} from '@/components/workspace';
import { Stage3VerificationPage } from "./components/stage-3-verification";
import { SecureVaultDashboard } from "./components/secure-vault-dashboard";
import { CartoonOfficerAvatar } from "./components/cartoon-officer-avatar";
import { ArrowLeft } from "lucide-react";
import { AuthProvider, isClerkConfigured, useAppAuth } from '@/lib/auth-context';

const queryClient = new QueryClient();

function getClerkPubKey(): string | undefined {
  try {
    const rawKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
    if (!isClerkConfigured || !rawKey || typeof rawKey !== 'string') return undefined;
    return rawKey.trim();
  } catch (err) {
    console.warn("[Auth] Failed resolving Clerk key, fallback:", err);
    return undefined;
  }
}

const clerkPubKey = getClerkPubKey();
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = (import.meta.env.BASE_URL || '').replace(/\/$/, '');
const windowOrigin = typeof window !== 'undefined' && window.location ? window.location.origin : '';

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}
const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${windowOrigin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: 'hsl(166 46% 31%)',
    colorForeground: 'hsl(183 36% 15%)',
    colorMutedForeground: 'hsl(183 13% 43%)',
    colorBackground: 'hsl(42 34% 99%)',
    colorInput: 'hsl(40 19% 78%)',
    colorDanger: 'hsl(3 62% 48%)',
    colorNeutral: 'hsl(183 36% 15%)',
    fontFamily: 'DM Sans, sans-serif',
  },
  elements: {
    cardBox: 'w-[440px] max-w-full rounded-2xl border border-[#dedbd2] bg-[#fffdfa] shadow-[0_12px_30px_rgba(29,59,58,.09)]',
    headerTitle: 'font-serif text-3xl',
    headerSubtitle: 'text-[#62706c]',
    formButtonPrimary: 'bg-[#2b7468] hover:bg-[#235f56]',
    footerActionLink: 'text-[#2b7468]',
  },
};

function OfficerDevSignIn() {
  const [, setLocation] = useLocation();
  const { officer } = useAppAuth();

  return (
    <div className="noise flex min-h-[100dvh] flex-col items-center justify-center bg-[hsl(var(--sidebar))] p-6 text-[hsl(var(--sidebar-foreground))]">
      <div className="w-full max-w-md mb-4 flex justify-start">
        <button
          type="button"
          onClick={() => setLocation('/dashboard')}
          data-testid="button-signin-return-workspace"
          className="inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-accent)/.6)] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))] transition"
        >
          <ArrowLeft size={14} className="text-[hsl(var(--sidebar-primary))]" />
          <span>Return to Workspace</span>
        </button>
      </div>
      <div className="w-full max-w-md rounded-2xl border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-accent)/.4)] p-8 shadow-2xl backdrop-blur-md">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <CartoonOfficerAvatar size={48} animated />
            </div>
            <div>
              <h2 className="text-base font-bold">{officer?.fullName || 'Revenue Officer'}</h2>
              <p className="text-xs text-[hsl(var(--sidebar-foreground)/.6)]">{officer?.role || 'Officer'} · Authenticated</p>
            </div>
          </div>
          <span className="rounded-full bg-[hsl(var(--sidebar-primary)/.15)] px-2.5 py-1 text-[10px] font-semibold text-[hsl(var(--sidebar-primary))]">
            Active Session
          </span>
        </div>

        <p className="text-sm leading-relaxed text-[hsl(var(--sidebar-foreground)/.7)]">
          You are currently signed in with an authorized revenue officer session. All cases, document extraction workflows, and audit trails are operational.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setLocation('/dashboard')}
            className="focus-ring inline-flex min-h-11 items-center justify-center rounded-lg bg-[hsl(var(--sidebar-primary))] px-4 text-sm font-bold text-[hsl(var(--sidebar))] hover:brightness-110"
          >
            Enter Officer Workspace
          </button>
          <button
            type="button"
            onClick={() => setLocation('/')}
            className="focus-ring inline-flex min-h-11 items-center justify-center rounded-lg border border-[hsl(var(--sidebar-border))] px-4 text-sm font-semibold text-[hsl(var(--sidebar-foreground)/.8)] hover:bg-[hsl(var(--sidebar-accent))]"
          >
            Return to Overview
          </button>
        </div>
      </div>
    </div>
  );
}

function SignInRoute() {
  if (isClerkConfigured && clerkPubKey) {
    return <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} appearance={clerkAppearance} />;
  }
  return <OfficerDevSignIn />;
}

function SignUpRoute() {
  if (isClerkConfigured && clerkPubKey) {
    return <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} appearance={clerkAppearance} />;
  }
  return <OfficerDevSignIn />;
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={PublicHome} />
        <Route path="/sign-in/*?" component={SignInRoute} />
        <Route path="/sign-up/*?" component={SignUpRoute} />
        <Route path="/dashboard">
          <Protected>
            <DashboardPage />
          </Protected>
        </Route>
        <Route path="/cases">
          <Protected>
            <CasesPage />
          </Protected>
        </Route>
        <Route path="/cases/:caseId/verification">
          <Protected>
            <Stage3VerificationRoute />
          </Protected>
        </Route>
        <Route path="/cases/:caseId/stage3">
          <Protected>
            <Stage3VerificationRoute />
          </Protected>
        </Route>
        <Route path="/cases/:caseId">
          <Protected>
            <CaseRoute />
          </Protected>
        </Route>
        <Route path="/records/:recordId/vault">
          <Protected>
            <VaultRoute />
          </Protected>
        </Route>
        <Route path="/vault/:recordId">
          <Protected>
            <VaultRoute />
          </Protected>
        </Route>
        <Route path="/cases/:caseId/vault">
          <Protected>
            <CaseVaultRoute />
          </Protected>
        </Route>
        <Route path="/records">
          <Protected>
            <RecordsPage />
          </Protected>
        </Route>
        <Route path="/existing-records">
          <Protected>
            <ExistingRecordsPage />
          </Protected>
        </Route>
        <Route path="/audit-trail">
          <Protected>
            <AuditTrailPage />
          </Protected>
        </Route>
        <Route path="/settings">
          <Protected>
            <SettingsPage />
          </Protected>
        </Route>
        <Route path="/usage-monitor">
          <Protected>
            <UsageMonitorPage />
          </Protected>
        </Route>
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function CaseRoute() {
  return <CaseRouteContent />;
}

function CaseRouteContent() {
  const params = useParams<{ caseId?: string }>();
  return <CaseWorkspacePage caseId={params?.caseId || ""} />;
}

function Stage3VerificationRoute() {
  const params = useParams<{ caseId?: string }>();
  return <Stage3VerificationPage caseId={params?.caseId || ""} />;
}

function VaultRoute() {
  const params = useParams<{ recordId?: string }>();
  return <SecureVaultDashboard recordId={params?.recordId} />;
}

function CaseVaultRoute() {
  const params = useParams<{ caseId?: string }>();
  return <SecureVaultDashboard caseId={params?.caseId} />;
}

function Protected({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAppAuth();
  if (!isLoaded) return <div className="min-h-[100dvh] bg-background p-8"><div className="skeleton mx-auto mt-20 h-28 max-w-xl rounded-xl" /></div>;
  if (!isSignedIn && isClerkConfigured && clerkPubKey) return <RedirectToSignIn />;
  return <>{children}</>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function MainApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <SystemCacheProvider>
        <LanguageProvider>
          <TooltipProvider>
            <Router />
            <Toaster />
          </TooltipProvider>
        </LanguageProvider>
      </SystemCacheProvider>
    </QueryClientProvider>
  );
}

function ClerkApp() {
  const [, setLocation] = useLocation();

  if (!isClerkConfigured || !clerkPubKey) {
    return (
      <AuthProvider hasClerkProvider={false}>
        <MainApp />
      </AuthProvider>
    );
  }

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <AuthProvider hasClerkProvider={true}>
        <MainApp />
      </AuthProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkApp />
    </WouterRouter>
  );
}

export default App;
