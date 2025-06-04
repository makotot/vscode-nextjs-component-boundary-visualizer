import { ComponentType } from '../../core/dependencyGraph';

/**
 * Icon for each component type (used in explorer badges, line decorations, etc.)
 */
export const typeIcon = {
    client: '⚡️',
    server: '', // no badge for server
    universal: '♾️',
    other: '', // no badge for other
} as const satisfies Record<ComponentType, string>;
