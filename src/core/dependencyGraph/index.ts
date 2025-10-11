/**
 * Component type classification.
 * - 'client': Entry or dependency with "use client" directive
 * - 'server': Server-only component
 * - 'universal': Referenced from both client and server
 */
export type ComponentType = "client" | "server" | "universal";

/**
 * Returns the label for each component type (for graph visualization).
 */
export function getLabelByType(type?: ComponentType): string {
  switch (type) {
    case "client":
      return "CLIENT";
    case "server":
      return "SERVER";
    case "universal":
      return "UNIVERSAL";
    default:
      return "";
  }
}
