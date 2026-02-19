'use client';

import {
  createNavigatorFactory,
  type ParamListBase,
  StackRouter,
  type StackNavigationState,
  type StackRouterOptions,
  useNavigationBuilder,
} from '@react-navigation/native';

import { NativeStackView } from './NativeStackView';
import type { NativeStackNavigationEventMap, NativeStackOptions, NativeStackProps } from './types';
import { withLayoutContext } from '../layouts/withLayoutContext';

export function NativeStackNavigator({
  children,
  screenListeners,
  screenOptions,
}: NativeStackProps) {
  const { state, descriptors, navigation, NavigationContent } = useNavigationBuilder<
    StackNavigationState<ParamListBase>,
    StackRouterOptions,
    Record<string, (...args: unknown[]) => void>,
    NativeStackOptions,
    NativeStackNavigationEventMap
  >(StackRouter, {
    children,
    screenListeners,
    screenOptions,
  });

  return (
    <NavigationContent>
      <NativeStackView state={state} navigation={navigation} descriptors={descriptors} />
    </NavigationContent>
  );
}

const createNativeStackNavigatorFactory = createNavigatorFactory(NativeStackNavigator);

export const NativeStackWithContext = withLayoutContext<
  NativeStackOptions,
  typeof NativeStackNavigator,
  StackNavigationState<ParamListBase>,
  NativeStackNavigationEventMap
>(createNativeStackNavigatorFactory().Navigator);
