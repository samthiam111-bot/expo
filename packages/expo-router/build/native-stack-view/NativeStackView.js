"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NativeStackView = NativeStackView;
const elements_1 = require("@react-navigation/elements");
const native_1 = require("@react-navigation/native");
const react_1 = __importDefault(require("react"));
const react_native_1 = require("react-native");
const react_native_screens_1 = require("react-native-screens");
const headerConfig_1 = require("./headerConfig");
const MODAL_PRESENTATIONS = new Set([
    'modal',
    'transparentModal',
    'containedModal',
    'containedTransparentModal',
    'fullScreenModal',
    'formSheet',
    'pageSheet',
]);
function getModalRouteKeys(routes, descriptors) {
    return routes.reduce((acc, route) => {
        const { presentation } = descriptors[route.key]?.options ?? {};
        if ((acc.length && !presentation) || (presentation && MODAL_PRESENTATIONS.has(presentation))) {
            acc.push(route.key);
        }
        return acc;
    }, []);
}
function NativeStackView({ state, navigation, descriptors }) {
    const { colors } = (0, native_1.useTheme)();
    const modalRouteKeys = getModalRouteKeys(state.routes, descriptors);
    return (<elements_1.SafeAreaProviderCompat>
      <react_native_screens_1.ScreenStack style={styles.container}>
        {state.routes.map((route, index) => {
            const descriptor = descriptors[route.key];
            const { options } = descriptor;
            const isFocused = state.index === index;
            const canGoBack = index > 0;
            const headerConfig = (0, headerConfig_1.convertOptionsToHeaderConfig)(options, route.name, canGoBack);
            const isModal = modalRouteKeys.includes(route.key);
            const { presentation = isModal ? 'modal' : 'card', animation, animationDuration, animationTypeForReplace = 'push', gestureEnabled, fullScreenSwipeEnabled, gestureResponseDistance, swipeDirection, orientation, freezeOnBlur, contentStyle, homeIndicatorHidden, hideKeyboardOnSwipe, scrollEdgeEffects, 
            // Sheet props
            sheetAllowedDetents, sheetGrabberVisible, sheetCornerRadius, sheetExpandsWhenScrolledToEdge, sheetInitialDetentIndex, sheetLargestUndimmedDetentIndex, sheetElevation, 
            // Status bar props
            statusBarStyle, statusBarHidden, statusBarAnimation, statusBarTranslucent, statusBarBackgroundColor, 
            // Navigation bar (Android)
            navigationBarHidden, navigationBarColor, navigationBarTranslucent, } = options;
            // First screen should always be treated as 'push'
            const stackPresentation = index === 0 ? 'push' : presentation === 'card' ? 'push' : presentation;
            // Freeze logic: don't freeze focused, modals on iOS (underlying screen visible),
            // or screens where freezeOnBlur is explicitly disabled
            const isModalOnIos = isModal && react_native_1.Platform.OS === 'ios';
            const shouldFreeze = !isFocused && !isModalOnIos && freezeOnBlur !== false;
            return (<native_1.NavigationContext.Provider key={route.key} value={descriptor.navigation}>
              <native_1.NavigationRouteContext.Provider value={route}>
                <react_native_screens_1.ScreenStackItem screenId={route.key} activityState={2} style={react_native_1.StyleSheet.absoluteFill} aria-hidden={!isFocused} stackPresentation={stackPresentation} stackAnimation={animation} transitionDuration={animationDuration} replaceAnimation={animationTypeForReplace} gestureEnabled={react_native_1.Platform.OS === 'android' ? false : gestureEnabled} fullScreenSwipeEnabled={fullScreenSwipeEnabled} gestureResponseDistance={gestureResponseDistance} swipeDirection={swipeDirection} screenOrientation={orientation} shouldFreeze={shouldFreeze} homeIndicatorHidden={homeIndicatorHidden} hideKeyboardOnSwipe={hideKeyboardOnSwipe} scrollEdgeEffects={scrollEdgeEffects
                    ? {
                        bottom: scrollEdgeEffects.bottom ?? 'automatic',
                        top: scrollEdgeEffects.top ?? 'automatic',
                        left: scrollEdgeEffects.left ?? 'automatic',
                        right: scrollEdgeEffects.right ?? 'automatic',
                    }
                    : undefined} 
            // Sheet props
            sheetAllowedDetents={sheetAllowedDetents} sheetGrabberVisible={sheetGrabberVisible} sheetCornerRadius={sheetCornerRadius} sheetExpandsWhenScrolledToEdge={sheetExpandsWhenScrolledToEdge} sheetInitialDetentIndex={sheetInitialDetentIndex} sheetLargestUndimmedDetentIndex={sheetLargestUndimmedDetentIndex} sheetElevation={sheetElevation} 
            // Status bar props
            statusBarStyle={statusBarStyle} statusBarHidden={statusBarHidden} statusBarAnimation={statusBarAnimation} statusBarTranslucent={statusBarTranslucent} statusBarColor={statusBarBackgroundColor} 
            // Navigation bar (Android)
            navigationBarHidden={navigationBarHidden} navigationBarColor={navigationBarColor} navigationBarTranslucent={navigationBarTranslucent} nativeBackButtonDismissalEnabled={false} contentStyle={[
                    presentation !== 'transparentModal' &&
                        presentation !== 'containedTransparentModal' && {
                        backgroundColor: colors.background,
                    },
                    contentStyle,
                ]} headerConfig={headerConfig} 
            // Event callbacks
            onWillAppear={() => {
                    navigation.emit({
                        type: 'transitionStart',
                        data: { closing: false },
                        target: route.key,
                    });
                }} onAppear={() => {
                    navigation.emit({
                        type: 'transitionEnd',
                        data: { closing: false },
                        target: route.key,
                    });
                }} onWillDisappear={() => {
                    navigation.emit({
                        type: 'transitionStart',
                        data: { closing: true },
                        target: route.key,
                    });
                }} onDisappear={() => {
                    navigation.emit({
                        type: 'transitionEnd',
                        data: { closing: true },
                        target: route.key,
                    });
                }} onDismissed={(event) => {
                    navigation.dispatch({
                        ...native_1.StackActions.pop(event.nativeEvent.dismissCount),
                        source: route.key,
                        target: state.key,
                    });
                }} onNativeDismissCancelled={(event) => {
                    navigation.dispatch({
                        ...native_1.StackActions.pop(event.nativeEvent.dismissCount),
                        source: route.key,
                        target: state.key,
                    });
                }} onHeaderBackButtonClicked={() => {
                    navigation.dispatch({
                        ...native_1.StackActions.pop(),
                        source: route.key,
                        target: state.key,
                    });
                }} onGestureCancel={() => {
                    navigation.emit({
                        type: 'gestureCancel',
                        target: route.key,
                    });
                }} onSheetDetentChanged={(event) => {
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
                </react_native_screens_1.ScreenStackItem>
              </native_1.NavigationRouteContext.Provider>
            </native_1.NavigationContext.Provider>);
        })}
      </react_native_screens_1.ScreenStack>
    </elements_1.SafeAreaProviderCompat>);
}
const styles = react_native_1.StyleSheet.create({
    container: {
        flex: 1,
    },
});
//# sourceMappingURL=NativeStackView.js.map