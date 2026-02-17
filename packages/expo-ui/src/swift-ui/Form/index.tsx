import { requireNativeView } from 'expo';

import { processModifiers } from '../modifiers/processModifiers';
import { type CommonViewModifierProps } from '../types';

export interface FormProps extends CommonViewModifierProps {
  /**
   * The content of the form.
   */
  children: React.ReactNode;
}

const FormNativeView: React.ComponentType<FormProps> = requireNativeView('ExpoUI', 'FormView');

export function Form(props: FormProps) {
  const { modifiers, children, ...restProps } = props;
  const { modifierProps, slotChildren } = processModifiers(modifiers);
  return (
    <FormNativeView {...modifierProps} {...restProps}>
      {children}
      {slotChildren}
    </FormNativeView>
  );
}
