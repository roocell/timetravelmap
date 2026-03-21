"use client";

import { LoaderCircle, LogIn, LogOut, Settings, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useStackApp, useUser } from "@stackframe/stack";
import { Button } from "./ui/Button";

type StackHandlerClientProps = {
  normalized: string;
  searchParams: Record<string, string>;
};

function Shell({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="min-h-screen px-4 py-10 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
        <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_32px_120px_rgba(15,23,42,0.16)]">
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
          {children ? <div className="mt-5">{children}</div> : null}
        </div>
      </div>
    </main>
  );
}

function OAuthCallbackScreen() {
  const stackApp = useStackApp();
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const finishSignIn = async () => {
      try {
        const redirected = await stackApp.callOAuthCallback();

        if (!redirected && active) {
          await stackApp.redirectToHome();
        }
      } catch (cause) {
        if (!active) {
          return;
        }

        setError(cause instanceof Error ? cause.message : "Unable to complete sign in.");
      }
    };

    void finishSignIn();

    return () => {
      active = false;
    };
  }, [stackApp]);

  if (error) {
    return (
      <Shell
        title="Sign In Failed"
        description="Google sign-in could not be completed. You can return home and try again."
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button
            type="button"
            onClick={() => {
              void stackApp.redirectToHome();
            }}
            className="w-full"
          >
            Return Home
          </Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell
      title="Finishing Sign In"
      description="We’re finishing the Google sign-in flow and bringing you back to the map."
    >
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <LoaderCircle className="h-4 w-4 animate-spin" />
        <span>Completing authentication…</span>
      </div>
    </Shell>
  );
}

function AccountSettingsScreen() {
  const stackApp = useStackApp();
  const user = useUser();

  return (
    <Shell
      title="Account"
      description="This app uses Google sign-in only. Your account actions are available here."
    >
      <div className="space-y-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Signed in as {user?.primaryEmail ?? "Unknown user"}
        </div>
        <Button
          type="button"
          onClick={() => {
            void stackApp.redirectToHome();
          }}
          className="flex w-full items-center justify-center gap-2"
        >
          <Settings size={15} strokeWidth={2.2} />
          <span>Back To Map</span>
        </Button>
      </div>
    </Shell>
  );
}

function SignOutScreen() {
  const stackApp = useStackApp();
  const user = useUser();

  useEffect(() => {
    let active = true;

    const run = async () => {
      await user?.signOut();

      if (active) {
        await stackApp.redirectToHome();
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [stackApp, user]);

  return (
    <Shell title="Signing Out" description="We’re signing you out and returning you to the map.">
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <LogOut className="h-4 w-4" />
        <span>Signing out…</span>
      </div>
    </Shell>
  );
}

function UnsupportedScreen() {
  const stackApp = useStackApp();

  return (
    <Shell
      title="Authentication"
      description="This route is not used in the current Google-only sign-in flow."
    >
      <Button
        type="button"
        onClick={() => {
          void stackApp.redirectToHome();
        }}
        className="flex w-full items-center justify-center gap-2"
      >
        <LogIn size={15} strokeWidth={2.2} />
        <span>Return Home</span>
      </Button>
    </Shell>
  );
}

function ErrorScreen({ searchParams }: Pick<StackHandlerClientProps, "searchParams">) {
  const stackApp = useStackApp();
  const errorCode = searchParams.errorCode ?? "";
  const rawMessage = searchParams.message ?? "";

  const title =
    errorCode === "SIGN_UP_REJECTED" ? "Sign Up Rejected" : "Authentication Error";

  const description =
    errorCode === "SIGN_UP_REJECTED"
      ? "This account is not allowed to sign up for Time Travel Map."
      : "Something went wrong during authentication.";

  const detail =
    rawMessage ||
    (errorCode === "SIGN_UP_REJECTED"
      ? "Your Google account does not match the allowed sign-up rule."
      : "Please return to the map and try again.");

  return (
    <Shell title={title} description={description}>
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{detail}</span>
        </div>
        <Button
          type="button"
          onClick={() => {
            void stackApp.redirectToHome();
          }}
          className="w-full"
        >
          Return Home
        </Button>
      </div>
    </Shell>
  );
}

export default function StackHandlerClient({
  normalized,
  searchParams
}: StackHandlerClientProps) {
  if (normalized === "oauthcallback") {
    return <OAuthCallbackScreen />;
  }

  if (normalized === "error") {
    return <ErrorScreen searchParams={searchParams} />;
  }

  if (normalized === "accountsettings") {
    return <AccountSettingsScreen />;
  }

  if (normalized === "signout") {
    return <SignOutScreen />;
  }

  return <UnsupportedScreen />;
}
