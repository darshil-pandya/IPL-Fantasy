export function ownerSlug(owner: string): string {
  return owner
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export function franchiseBySlug(
  franchises: { owner: string }[],
  slug: string,
): { owner: string } | undefined {
  return franchises.find((f) => ownerSlug(f.owner) === slug);
}
