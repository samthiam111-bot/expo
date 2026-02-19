import { SafeAreaProviderCompat } from '@react-navigation/elements';
import {
  NavigationContext,
  NavigationRouteContext,
  type ParamListBase,
  type Route,
  StackActions,
  type StackNavigationState,
  useTheme,
} from '@react-navigation/native';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { ScreenStack, ScreenStackItem } from 'react-native-screens';

import { convertOptionsToHeaderConfig } from './headerConfig';
import type { NativeStackOptions } from './types';

type Descriptor = {
  options: NativeStackOptions;
  render: () => React.ReactNode;
  route: { key: string; name: string };
  navigation: any;
};

type Props = {
  state: StackNavigationState<ParamListBase>;
  navigation: any;
  descriptors: Record<string, Descriptor>;
};

const MODAL_PRESENTATIONS = new Set([
  'modal',
  'transparentModal',
  'containedModal',
  'containedTransparentModal',
  'fullScreenModal',
  'formSheet',
  'pageSheet',
]);

function getModalRouteKeys(
  routes: Route<string>[],
  descriptors: Record<string, Descriptor>
): string[] {
  return routes.reduce<string[]>((acc, route) => {
    const { presentation } = descriptors[route.key]?.options ?? {};
    if ((acc.length && !presentation) || (presentation && MODAL_PRESENTATIONS.has(presentation))) {
      acc.push(route.key);
    }
    return acc;
  }, []);
}

export function NativeStackView({ state, navigation, descriptors }: Props) {
  const { colors } = useTheme();
  const modalRouteKeys = getModalRouteKeys(state.routes, descriptors);

  return (
    <SafeAreaProviderCompat>
      <ScreenStack style={styles.container}>
        {state.routes.map((route, index) => {
          const descriptor = descriptors[route.key];
          const { options } = descriptor;
          const isFocused = state.index === index;
          const canGoBack = index > 0;

          const headerConfig = convertOptionsToHeaderConfig(options, route.name, canGoBack);

          const isModal = modalRouteKeys.includes(route.key);

          const {
            presentation = isModal ? 'modal' : 'card',
            animation,
            animationDuration,
            animationTypeForReplace = 'push',
            gestureEnabled,
            fullScreenSwipeEnabled,
            gestureResponseDistance,
            swipeDirection,
            orientation,
            freezeOnBlur,
            contentStyle,
            homeIndicatorHidden,
            hideKeyboardOnSwipe,
            scrollEdgeEffects,
            // Sheet props
            sheetAllowedDetents,
            sheetGrabberVisible,
            sheetCornerRadius,
            sheetExpandsWhenScrolledToEdge,
            sheetInitialDetentIndex,
            sheetLargestUndimmedDetentIndex,
            sheetElevation,
            // Status bar props
            statusBarStyle,
            statusBarHidden,
            statusBarAnimation,
            statusBarTranslucent,
            statusBarBackgroundColor,
            // Navigation bar (Android)
            navigationBarHidden,
            navigationBarColor,
            navigationBarTranslucent,
          } = options;

          // First screen should always be treated as 'push'
          const stackPresentation =
            index === 0 ? 'push' : presentation === 'card' ? 'push' : presentation;

          // Freeze logic: don't freeze focused, modals on iOS (underlying screen visible),
          // or screens where freezeOnBlur is explicitly disabled
          const isModalOnIos = isModal && Platform.OS === 'ios';
          const shouldFreeze = !isFocused && !isModalOnIos && freezeOnBlur !== false;

          return (
            <NavigationContext.Provider key={route.key} value={descriptor.navigation}>
              <NavigationRouteContext.Provider value={route}>
                <ScreenStackItem
                  screenId={route.key}
                  activityState={2}
                  style={StyleSheet.absoluteFill}
                  aria-hidden={!isFocused}
                  stackPresentation={stackPresentation}
                  stackAnimation={animation}
                  transitionDuration={animationDuration}
                  replaceAnimation={animationTypeForReplace}
                  gestureEnabled={Platform.OS === 'android' ? false : gestureEnabled}
                  fullScreenSwipeEnabled={fullScreenSwipeEnabled}
                  gestureResponseDistance={gestureResponseDistance}
                  swipeDirection={swipeDirection}
                  screenOrientation={orientation}
                  shouldFreeze={shouldFreeze}
                  homeIndicatorHidden={homeIndicatorHidden}
                  hideKeyboardOnSwipe={hideKeyboardOnSwipe}
                  scrollEdgeEffects={
                    scrollEdgeEffects
                      ? {
                          bottom: scrollEdgeEffects.bottom ?? 'automatic',
                          top: scrollEdgeEffects.top ?? 'automatic',
                          left: scrollEdgeEffects.left ?? 'automatic',
                          right: scrollEdgeEffects.right ?? 'automatic',
                        }
                      : undefined
                  }
                  // Sheet props
                  sheetAllowedDetents={sheetAllowedDetents}
                  sheetGrabberVisible={sheetGrabberVisible}
                  sheetCornerRadius={sheetCornerRadius}
                  sheetExpandsWhenScrolledToEdge={sheetExpandsWhenScrolledToEdge}
                  sheetInitialDetentIndex={sheetInitialDetentIndex}
                  sheetLargestUndimmedDetentIndex={sheetLargestUndimmedDetentIndex}
                  sheetElevation={sheetElevation}
                  // Status bar props
                  statusBarStyle={statusBarStyle}
                  statusBarHidden={statusBarHidden}
                  statusBarAnimation={statusBarAnimation}
                  statusBarTranslucent={statusBarTranslucent}
                  statusBarColor={statusBarBackgroundColor}
                  // Navigation bar (Android)
                  navigationBarHidden={navigationBarHidden}
                  navigationBarColor={navigationBarColor}
                  navigationBarTranslucent={navigationBarTranslucent}
                  nativeBackButtonDismissalEnabled={false}
                  contentStyle={[
                    presentation !== 'transparentModal' &&
                      presentation !== 'containedTransparentModal' && {
                        backgroundColor: colors.background,
                      },
                    contentStyle,
                  ]}
                  headerConfig={headerConfig}
                  // Event callbacks
                  onWillAppear={() => {
                    navigation.emit({
                      type: 'transitionStart',
                      data: { closing: false },
                      target: route.key,
                    });
                  }}
                  onAppear={() => {
                    navigation.emit({
                      type: 'transitionEnd',
                      data: { closing: false },
                      target: route.key,
                    });
                  }}
                  onWillDisappear={() => {
                    navigation.emit({
                      type: 'transitionStart',
                      data: { closing: true },
                      target: route.key,
                    });
                  }}
                  onDisappear={() => {
                    navigation.emit({
                      type: 'transitionEnd',
                      data: { closing: true },
                      target: route.key,
                    });
                  }}
                  onDismissed={(event) => {
                    navigation.dispatch({
                      ...StackActions.pop(event.nativeEvent.dismissCount),
                      source: route.key,
                      target: state.key,
                    });
                  }}
                  onNativeDismissCancelled={(event) => {
                    navigation.dispatch({
                      ...StackActions.pop(event.nativeEvent.dismissCount),
                      source: route.key,
                      target: state.key,
                    });
                  }}
                  onHeaderBackButtonClicked={() => {
                    navigation.dispatch({
                      ...StackActions.pop(),
                      source: route.key,
                      target: state.key,
                    });
                  }}
                  onGestureCancel={() => {
                    navigation.emit({
                      type: 'gestureCancel',
                      target: route.key,
                    });
                  }}
                  onSheetDetentChanged={(event) => {
                    navigation.emit({
                      type: 'sheetDetentChange',
                      target: route.key,
                      data: {
                        index: event.nativeEvent.index,
                        stable: event.nativeEvent.isStable,
                      },
                    });
                  }}>
                  {descriptor.render()}
                </ScreenStackItem>
              </NavigationRouteContext.Provider>
            </NavigationContext.Provider>
          );
        })}
      </ScreenStack>
    </SafeAreaProviderCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
