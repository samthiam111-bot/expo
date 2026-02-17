import { requireNativeView } from 'expo';

import { processModifiers } from '../modifiers/processModifiers';
import { CommonViewModifierProps } from '../types';

export type ZStackProps = {
  children: React.ReactNode;
  /**
   * The alignment of children within the stack.
   */
  alignment?:
    | 'center'
    | 'leading'
    | 'trailing'
    | 'top'
    | 'bottom'
    | 'topLeading'
    | 'topTrailing'
    | 'bottomLeading'
    | 'bottomTrailing'
    | 'centerFirstTextBaseline'
    | 'centerLastTextBaseline'
    | 'leadingFirstTextBaseline'
    | 'leadingLastTextBaseline'
    | 'trailingFirstTextBaseline'
    | 'trailingLastTextBaseline';
} & CommonViewModifierProps;

const ZStackNativeView: React.ComponentType<ZStackProps> = requireNativeView(
  'ExpoUI',
  'ZStackView'
);

export function ZStack(props: ZStackProps) {
  const { modifiers, children, ...restProps } = props;
  const { modifierProps, slotChildren } = processModifiers(modifiers);
  return (
    <ZStackNativeView {...modifierProps} {...restProps}>
      {children}
      {slotChildren}
    </ZStackNativeView>
  );
}
