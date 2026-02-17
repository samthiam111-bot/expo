import { requireNativeView } from 'expo';

import { processModifiers } from '../modifiers/processModifiers';
import { type CommonViewModifierProps } from '../types';

export type ScrollViewProps = {
  children: React.ReactNode;
  /**
   * The scrollable axes.
   * @default 'vertical'
   */
  axes?: 'vertical' | 'horizontal' | 'both';
  /**
   * Whether to show scroll indicators.
   * @default true
   */
  showsIndicators?: boolean;
} & CommonViewModifierProps;

const ScrollViewNativeView: React.ComponentType<ScrollViewProps> = requireNativeView(
  'ExpoUI',
  'ScrollViewComponent'
);

export function ScrollView(props: ScrollViewProps) {
  const { modifiers, children, ...restProps } = props;
  const { modifierProps, slotChildren } = processModifiers(modifiers);
  return (
    <ScrollViewNativeView {...modifierProps} {...restProps}>
      {children}
      {slotChildren}
    </ScrollViewNativeView>
  );
}
