export const componentEnvIcon = {
  client: "⚡️",
  server: "", // server is the default in RSC — no badge
  universal: "♾️",
} as const satisfies Record<"client" | "server" | "universal", string>;
