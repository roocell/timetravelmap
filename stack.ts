import { StackClientApp, StackServerApp } from "@stackframe/stack";
import type { NextRequest } from "next/server";

const projectId =
  process.env.NEXT_PUBLIC_STACK_PROJECT_ID ?? "11111111-1111-4111-8111-111111111111";
const publishableClientKey =
  process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY ?? "stack-publishable-key-not-configured";
const secretServerKey =
  process.env.STACK_SECRET_SERVER_KEY ?? "stack-secret-key-not-configured";

const sharedUrls = {
  handler: "/handler",
  home: "/",
  afterSignIn: "/",
  afterSignUp: "/",
  afterSignOut: "/"
} as const;

export const stackClientApp = new StackClientApp({
  tokenStore: "nextjs-cookie",
  projectId,
  publishableClientKey,
  urls: sharedUrls
});

export const stackServerApp = new StackServerApp({
  tokenStore: "nextjs-cookie",
  projectId,
  publishableClientKey,
  secretServerKey,
  urls: sharedUrls
});

export async function getStackUser(request?: NextRequest | Request) {
  if (request) {
    return stackServerApp.getUser({ tokenStore: request, includeRestricted: true });
  }

  return stackServerApp.getUser({ includeRestricted: true });
}
