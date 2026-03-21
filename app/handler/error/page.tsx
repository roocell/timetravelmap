import StackHandlerClient from "../../../components/StackHandlerClient";

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

type ErrorPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function StackErrorPage({ searchParams }: ErrorPageProps) {
  const resolvedSearchParams = normalizeSearchParams(await searchParams);

  return <StackHandlerClient normalized="error" searchParams={resolvedSearchParams} />;
}
