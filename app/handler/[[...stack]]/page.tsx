import StackHandlerClient from "../../../components/StackHandlerClient";
import { notFound, redirect } from "next/navigation";

function normalizePath(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

function normalizeSearchParams(
  value: Record<string, string | string[] | undefined>
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) => {
      if (typeof entry === "string") {
        return [[key, entry]];
      }

      if (Array.isArray(entry) && typeof entry[0] === "string") {
        return [[key, entry[0]]];
      }

      return [];
    })
  );
}

type StackHandlerPageProps = {
  params: Promise<{ stack?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const VALID_ROUTES = new Set([
  "signin",
  "login",
  "signup",
  "register",
  "error",
  "forgotpassword",
  "passwordreset",
  "emailverification",
  "oauthcallback",
  "teaminvitation",
  "accountsettings",
  "cliauthconfirm",
  "mfa",
  "onboarding",
  "signout"
]);

export default async function StackHandlerPage({
  params,
  searchParams
}: StackHandlerPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = normalizeSearchParams(await searchParams);
  const segment = resolvedParams?.stack?.[0] ?? "sign-in";

  if (segment === "" || segment == null) {
    redirect("/handler/sign-in");
  }

  const normalized = normalizePath(segment);

  if (!VALID_ROUTES.has(normalized)) {
    notFound();
  }

  return <StackHandlerClient normalized={normalized} searchParams={resolvedSearchParams} />;
}
