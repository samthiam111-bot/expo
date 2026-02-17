import { requireNativeView } from 'expo';

import { processModifiers } from '../modifiers/processModifiers';
import { type CommonViewModifierProps } from '../types';

export type VStackProps = {
  children: React.ReactNode;
  /**
   * The horizontal alignment of children within the stack.
   */
  alignment?: 'leading' | 'center' | 'trailing';
  /**
   * The spacing between children.
   */
  spacing?: number;
} & CommonViewModifierProps;

const VStackNativeView: React.ComponentType<VStackProps> = requireNativeView(
  'ExpoUI',
  'VStackView'
);

export function VStack(props: VStackProps) {
  const { modifiers, children, ...restProps } = props;
  const { modifierProps, slotChildren } = processModifiers(modifiers);
  return (
    <VStackNativeView {...modifierProps} {...restProps}>
      {children}
      {slotChildren}
    </VStackNativeView>
  );
}
