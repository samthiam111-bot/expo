import React from 'react';
import { requireNativeView } from 'expo';

import { type ModifierConfig } from './createModifier';
import { createViewModifierEventListener, type GlobalEvent } from './utils';

const ModifierSlotNativeView: React.ComponentType<{
  modifierType: string;
  slotName: string;
  children: React.ReactNode;
}> = requireNativeView('ExpoUI', 'ModifierSlotView');

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
export function processModifiers(modifiers?: ModifierConfig[]): {
  modifierProps: ({ modifiers: ModifierConfig[] } & GlobalEvent) | undefined;
  slotChildren: React.ReactNode;
} {
  if (!modifiers || modifiers.length === 0) {
    return { modifierProps: undefined, slotChildren: null };
  }

  const cleanedConfigs: ModifierConfig[] = [];
  const slotElements: React.ReactNode[] = [];

  for (const mod of modifiers) {
    const { $content, ...config } = mod;
    cleanedConfigs.push(config);

    if ($content && typeof $content === 'object') {
      for (const [slotName, element] of Object.entries($content as Record<string, React.ReactNode>)) {
        if (element != null) {
          slotElements.push(
            <ModifierSlotNativeView
              key={`${config.$type}-${slotName}`}
              modifierType={config.$type}
              slotName={slotName}>
              {element}
            </ModifierSlotNativeView>
          );
        }
      }
    }
  }

  return {
    modifierProps: {
      modifiers: cleanedConfigs,
      ...createViewModifierEventListener(cleanedConfigs),
    },
    slotChildren: slotElements.length > 0 ? slotElements : null,
  };
}
