import React from 'react';
import { type ModifierConfig } from './createModifier';
import { type GlobalEvent } from './utils';
/**
 * Processes an array of view modifiers, extracting any `$content` slots (React elements)
 * and converting them into `ModifierSlot` native view children.
 *
 * Modifiers that accept view children (like `confirmationDialog`, `alert`) store their
 * React element content under a `$content` key. This function:
 * 1. Strips `$content` from each modifier config (so it's not serialized to native)
 * 2. Wraps each content slot in a `<ModifierSlot>` native view
 * 3. Returns cleaned modifier props and the slot children to render
 *
 * @example
 * ```tsx
 * function MyComponent({ modifiers, children, ...props }) {
 *   const { modifierProps, slotChildren } = processModifiers(modifiers);
 *   return (
 *     <NativeView {...modifierProps} {...props}>
 *       {children}
 *       {slotChildren}
 *     </NativeView>
 *   );
 * }
 * ```
 */
export declare function processModifiers(modifiers?: ModifierConfig[]): {
    modifierProps: ({
        modifiers: ModifierConfig[];
    } & GlobalEvent) | undefined;
    slotChildren: React.ReactNode;
};
//# sourceMappingURL=processModifiers.d.ts.map