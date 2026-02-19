import { act, screen } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import { router } from '../../imperative-api';
import { renderRouter, testRouter } from '../../testing-library';
import { NativeStack } from '../NativeStack';

jest.mock('react-native-screens', () => {
  const actualScreens = jest.requireActual(
    'react-native-screens'
  ) as typeof import('react-native-screens');
  return {
    ...actualScreens,
    ScreenStackItem: jest.fn((props) => <actualScreens.ScreenStackItem {...props} />),
  };
});

const { ScreenStackItem } = jest.requireMock(
  'react-native-screens'
) as typeof import('react-native-screens');
const MockedScreenStackItem = ScreenStackItem as jest.MockedFunction<typeof ScreenStackItem>;

describe('NativeStack', () => {
  beforeEach(() => {
    MockedScreenStackItem.mockClear();
  });

  describe('basic navigation', () => {
    it('renders the initial route', () => {
      renderRouter({
        _layout: () => <NativeStack />,
        index: () => <Text testID="index">Index</Text>,
      });

      expect(screen.getByTestId('index')).toBeVisible();
      expect(screen).toHavePathname('/');
    });

    it('can push and navigate between routes', () => {
      renderRouter({
        _layout: () => <NativeStack />,
        index: () => <Text testID="index">Index</Text>,
        profile: () => <Text testID="profile">Profile</Text>,
      });

      expect(screen.getByTestId('index')).toBeVisible();

      act(() => router.push('/profile'));
      expect(screen.getByTestId('profile')).toBeVisible();
      expect(screen).toHavePathname('/profile');
    });

    it('can go back after pushing', () => {
      renderRouter({
        _layout: () => <NativeStack />,
        index: () => <Text testID="index">Index</Text>,
        details: () => <Text testID="details">Details</Text>,
      });

      act(() => router.push('/details'));
      expect(screen).toHavePathname('/details');

      act(() => router.back());
      expect(screen).toHavePathname('/');
    });

    it('can push multiple screens and dismiss', () => {
      renderRouter(
        {
          _layout: () => <NativeStack />,
          a: () => <Text>A</Text>,
          b: () => <Text>B</Text>,
          c: () => <Text>C</Text>,
        },
        { initialUrl: '/a' }
      );

      act(() => router.push('/b'));
      act(() => router.push('/c'));
      expect(screen).toHavePathname('/c');

      act(() => router.dismiss());
      expect(screen).toHavePathname('/b');
    });

    it('can replace the current route', () => {
      renderRouter({
        _layout: () => <NativeStack />,
        index: () => <Text testID="index">Index</Text>,
        a: () => <Text testID="a">A</Text>,
        b: () => <Text testID="b">B</Text>,
      });

      act(() => router.push('/a'));
      expect(screen).toHavePathname('/a');

      act(() => router.replace('/b'));
      expect(screen).toHavePathname('/b');

      act(() => router.back());
      expect(screen).toHavePathname('/');
    });
  });

  describe('header config', () => {
    it('passes title from options to headerConfig', () => {
      renderRouter({
        _layout: () => (
          <NativeStack>
            <NativeStack.Screen name="index" options={{ title: 'Home' }} />
          </NativeStack>
        ),
        index: () => <Text testID="index">Index</Text>,
      });

      expect(screen.getByTestId('index')).toBeVisible();
      expect(MockedScreenStackItem.mock.calls[0][0].headerConfig?.title).toBe('Home');
    });

    it('uses route name as fallback title', () => {
      renderRouter({
        _layout: () => <NativeStack />,
        index: () => <Text testID="index">Index</Text>,
      });

      expect(MockedScreenStackItem.mock.calls[0][0].headerConfig?.title).toBe('index');
    });

    it('hides back button on first screen', () => {
      renderRouter({
        _layout: () => <NativeStack />,
        index: () => <Text testID="index">Index</Text>,
      });

      expect(MockedScreenStackItem.mock.calls[0][0].headerConfig?.hideBackButton).toBe(true);
    });

    it('shows back button on pushed screen', () => {
      renderRouter({
        _layout: () => <NativeStack />,
        index: () => <Text testID="index">Index</Text>,
        details: () => <Text testID="details">Details</Text>,
      });

      act(() => router.push('/details'));

      // Find the call for the details screen (the second ScreenStackItem rendered after push)
      const detailsCalls = MockedScreenStackItem.mock.calls.filter(
        (call) => call[0].headerConfig?.title === 'details'
      );
      expect(detailsCalls.length).toBeGreaterThan(0);
      expect(detailsCalls[detailsCalls.length - 1][0].headerConfig?.hideBackButton).toBe(false);
    });

    it('passes hidden when headerShown is false', () => {
      renderRouter({
        _layout: () => (
          <NativeStack>
            <NativeStack.Screen name="index" options={{ headerShown: false }} />
          </NativeStack>
        ),
        index: () => <Text testID="index">Index</Text>,
      });

      expect(MockedScreenStackItem.mock.calls[0][0].headerConfig?.hidden).toBe(true);
    });
  });

  describe('presentation', () => {
    it('first screen always has stackPresentation push', () => {
      renderRouter({
        _layout: () => <NativeStack screenOptions={{ presentation: 'modal' }} />,
        index: () => <Text testID="index">Index</Text>,
      });

      expect(MockedScreenStackItem.mock.calls[0][0].stackPresentation).toBe('push');
    });

    it('maps card presentation to push', () => {
      renderRouter({
        _layout: () => <NativeStack />,
        index: () => <Text testID="index">Index</Text>,
        details: () => <Text testID="details">Details</Text>,
      });

      act(() => router.push('/details'));

      const detailsCalls = MockedScreenStackItem.mock.calls.filter(
        (call) => call[0].headerConfig?.title === 'details'
      );
      expect(detailsCalls[detailsCalls.length - 1][0].stackPresentation).toBe('push');
    });

    it('passes modal presentation to ScreenStackItem', () => {
      renderRouter({
        _layout: () => (
          <NativeStack>
            <NativeStack.Screen name="index" />
            <NativeStack.Screen name="modal" options={{ presentation: 'modal' }} />
          </NativeStack>
        ),
        index: () => <Text testID="index">Index</Text>,
        modal: () => <Text testID="modal">Modal</Text>,
      });

      act(() => router.push('/modal'));

      const modalCalls = MockedScreenStackItem.mock.calls.filter(
        (call) => call[0].headerConfig?.title === 'modal'
      );
      expect(modalCalls[modalCalls.length - 1][0].stackPresentation).toBe('modal');
    });
  });

  describe('screenOptions', () => {
    it('applies screenOptions to all screens', () => {
      renderRouter({
        _layout: () => <NativeStack screenOptions={{ headerShown: false }} />,
        index: () => <Text testID="index">Index</Text>,
        details: () => <Text testID="details">Details</Text>,
      });

      expect(MockedScreenStackItem.mock.calls[0][0].headerConfig?.hidden).toBe(true);

      act(() => router.push('/details'));

      const detailsCalls = MockedScreenStackItem.mock.calls.filter(
        (call) => call[0].headerConfig?.title === 'details'
      );
      expect(detailsCalls[detailsCalls.length - 1][0].headerConfig?.hidden).toBe(true);
    });

    it('per-screen options override screenOptions', () => {
      renderRouter({
        _layout: () => (
          <NativeStack screenOptions={{ title: 'Default' }}>
            <NativeStack.Screen name="index" options={{ title: 'Custom Home' }} />
          </NativeStack>
        ),
        index: () => <Text testID="index">Index</Text>,
      });

      expect(MockedScreenStackItem.mock.calls[0][0].headerConfig?.title).toBe('Custom Home');
    });
  });

  describe('freezeOnBlur', () => {
    it('freezes non-focused screens by default', () => {
      renderRouter({
        _layout: () => <NativeStack />,
        index: () => <Text testID="index">Index</Text>,
        details: () => <Text testID="details">Details</Text>,
      });

      act(() => router.push('/details'));

      // After pushing, the index screen should be frozen
      const lastRender = MockedScreenStackItem.mock.calls;
      const indexCalls = lastRender.filter((call) => call[0].headerConfig?.title === 'index');
      const lastIndexCall = indexCalls[indexCalls.length - 1];
      expect(lastIndexCall[0].shouldFreeze).toBe(true);
    });

    it('respects freezeOnBlur: false', () => {
      renderRouter({
        _layout: () => (
          <NativeStack>
            <NativeStack.Screen name="index" options={{ freezeOnBlur: false }} />
            <NativeStack.Screen name="details" />
          </NativeStack>
        ),
        index: () => <Text testID="index">Index</Text>,
        details: () => <Text testID="details">Details</Text>,
      });

      act(() => router.push('/details'));

      const indexCalls = MockedScreenStackItem.mock.calls.filter(
        (call) => call[0].headerConfig?.title === 'index'
      );
      const lastIndexCall = indexCalls[indexCalls.length - 1];
      expect(lastIndexCall[0].shouldFreeze).toBe(false);
    });
  });

  describe('dynamic routes', () => {
    it('supports dynamic route segments', () => {
      renderRouter({
        _layout: () => <NativeStack />,
        index: () => <Text testID="index">Index</Text>,
        'user/[id]': () => <Text testID="user">User</Text>,
      });

      act(() => router.push('/user/123'));
      expect(screen).toHavePathname('/user/123');
      expect(screen.getByTestId('user')).toBeVisible();
    });
  });

  describe('dismissAll', () => {
    it('can dismiss all screens back to root', () => {
      renderRouter(
        {
          _layout: () => <NativeStack />,
          a: () => <Text>A</Text>,
          b: () => <Text>B</Text>,
          c: () => <Text>C</Text>,
        },
        { initialUrl: '/a' }
      );

      testRouter.push('/b');
      testRouter.push('/c');

      expect(screen).toHavePathname('/c');

      testRouter.dismissAll();
      expect(screen).toHavePathname('/a');
      expect(router.canDismiss()).toBe(false);
    });
  });

  describe('canDismiss', () => {
    it('returns false on root screen', () => {
      renderRouter({
        _layout: () => <NativeStack />,
        index: () => <Text>Index</Text>,
      });

      expect(router.canDismiss()).toBe(false);
    });

    it('returns true after pushing', () => {
      renderRouter({
        _layout: () => <NativeStack />,
        index: () => <Text>Index</Text>,
        details: () => <Text>Details</Text>,
      });

      act(() => router.push('/details'));
      expect(router.canDismiss()).toBe(true);
    });
  });
});
