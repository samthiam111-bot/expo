import { requireNativeView } from 'expo';

import { processModifiers } from '../modifiers/processModifiers';
import { type CommonViewModifierProps } from '../types';

export interface GroupProps extends CommonViewModifierProps {
  children: React.ReactNode;
}

const GroupNativeView: React.ComponentType<GroupProps> = requireNativeView('ExpoUI', 'GroupView');

export function Group(props: GroupProps) {
  const { modifiers, children, ...restProps } = props;
  const { modifierProps, slotChildren } = processModifiers(modifiers);
  return (
    <GroupNativeView {...modifierProps} {...restProps}>
      {children}
      {slotChildren}
    </GroupNativeView>
  );
}
