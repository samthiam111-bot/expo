import { requireNativeView } from 'expo';

import { ListForEach, type ListForEachProps } from './ListForEach';
import { type ViewEvent } from '../../types';
import { processModifiers } from '../modifiers/processModifiers';
import { type CommonViewModifierProps } from '../types';

const ListNativeView: React.ComponentType<NativeListProps> = requireNativeView<NativeListProps>(
  'ExpoUI',
  'ListView'
);

export interface ListProps extends CommonViewModifierProps {
  /**
   * The children elements to be rendered inside the list.
   */
  children: React.ReactNode;

  /**
   * The currently selected item tags.
   */
  selection?: (string | number)[];

  /**
   * Callback triggered when the selection changes in a list.
   * Returns an array of selected item tags.
   */
  onSelectionChange?: (selection: (string | number)[]) => void;
}

/**
 * SelectItemEvent represents an event triggered when the selection changes in a list.
 */
type SelectItemEvent = ViewEvent<'onSelectionChange', { selection: (string | number)[] }>;

type NativeListProps = Omit<ListProps, 'onSelectionChange'> &
  SelectItemEvent & {
    children: React.ReactNode;
  };

/**
 * A list component that renders its children using a native SwiftUI `List`.
 */
export function List(props: ListProps) {
  const { modifiers, children, onSelectionChange, ...restProps } = props;
  const { modifierProps, slotChildren } = processModifiers(modifiers);
  return (
    <ListNativeView
      {...modifierProps}
      {...restProps}
      onSelectionChange={({ nativeEvent: { selection } }) => onSelectionChange?.(selection)}>
      {children}
      {slotChildren}
    </ListNativeView>
  );
}

List.ForEach = ListForEach;

export { ListForEach, ListForEachProps };
