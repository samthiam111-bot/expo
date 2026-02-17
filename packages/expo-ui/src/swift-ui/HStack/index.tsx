import { requireNativeView } from 'expo';

import { processModifiers } from '../modifiers/processModifiers';
import { type CommonViewModifierProps } from '../types';

export type HStackProps = {
  children: React.ReactNode;
  /**
   * The spacing between children.
   */
  spacing?: number;
  /**
   * The vertical alignment of children within the stack.
   */
  alignment?: 'top' | 'center' | 'bottom' | 'firstTextBaseline' | 'lastTextBaseline';
} & CommonViewModifierProps;

const HStackNativeView: React.ComponentType<HStackProps> = requireNativeView(
  'ExpoUI',
  'HStackView'
);

export function HStack(props: HStackProps) {
  const { modifiers, children, ...restProps } = props;
  const { modifierProps, slotChildren } = processModifiers(modifiers);
  return (
    <HStackNativeView {...modifierProps} {...restProps}>
      {children}
      {slotChildren}
    </HStackNativeView>
  );
}
