import { render, screen } from '@testing-library/react-native';
import type { ImageRef } from 'expo-image';

import { RouterToolbarItemWithImageSupport } from '../RouterToolbarItemWithImageSupport';

jest.mock('../native', () => {
  const { View }: typeof import('react-native') = jest.requireActual('react-native');
  return {
    RouterToolbarItem: jest.fn((props) => <View testID="RouterToolbarItem" {...props} />),
  };
});

const mockUseImage = jest.fn<ImageRef | null, [any, any?, any?]>(() => null);
jest.mock('expo-image', () => ({
  useImage: (source: any, options?: any, deps?: any) => mockUseImage(source, options, deps),
}));

const { RouterToolbarItem } = jest.requireMock('../native') as typeof import('../native');
const MockedRouterToolbarItem = RouterToolbarItem as jest.MockedFunction<typeof RouterToolbarItem>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe(RouterToolbarItemWithImageSupport, () => {
  const baseProps = {
    identifier: 'test-id',
    title: 'Test',
    onSelected: jest.fn(),
  };

  it('renders RouterToolbarItem directly when no xcassetName', () => {
    render(<RouterToolbarItemWithImageSupport {...baseProps} />);

    expect(mockUseImage).not.toHaveBeenCalled();
    expect(screen.getByTestId('RouterToolbarItem')).toBeVisible();
  });

  it('calls useImage with xcassetName when provided', () => {
    render(<RouterToolbarItemWithImageSupport {...baseProps} xcassetName="my-icon" />);

    expect(mockUseImage).toHaveBeenCalledWith({ uri: 'my-icon' }, {}, ['my-icon']);
  });

  it('passes resolved image to RouterToolbarItem when xcassetName is provided', () => {
    const fakeImageRef = { __expo_shared_object_id__: 42 } as unknown as ImageRef;
    mockUseImage.mockReturnValue(fakeImageRef);

    render(<RouterToolbarItemWithImageSupport {...baseProps} xcassetName="my-icon" />);

    expect(mockUseImage).toHaveBeenCalledWith({ uri: 'my-icon' }, {}, ['my-icon']);
    // The mock receives the ImageRef directly (not the shared object ID)
    expect(MockedRouterToolbarItem.mock.calls[0][0].image).toBe(fakeImageRef);
  });

  it('prefers explicit image prop over xcasset image', () => {
    const explicitImage = { __expo_shared_object_id__: 99 } as unknown as ImageRef;
    const xcassetImage = { __expo_shared_object_id__: 42 } as unknown as ImageRef;
    mockUseImage.mockReturnValue(xcassetImage);

    render(
      <RouterToolbarItemWithImageSupport
        {...baseProps}
        image={explicitImage}
        xcassetName="my-icon"
      />
    );

    // useImage is still called (hooks must always be called)
    expect(mockUseImage).toHaveBeenCalledWith({ uri: 'my-icon' }, {}, ['my-icon']);
    // But explicit image takes precedence
    expect(MockedRouterToolbarItem.mock.calls[0][0].image).toBe(explicitImage);
  });

  it('passes null image when useImage has not resolved yet', () => {
    mockUseImage.mockReturnValue(null);

    render(<RouterToolbarItemWithImageSupport {...baseProps} xcassetName="my-icon" />);

    // undefined ?? null = null
    expect(MockedRouterToolbarItem.mock.calls[0][0].image).toBeNull();
  });

  describe('imageSource support', () => {
    it('calls useImage with imageSource when provided', () => {
      const imageSource = { uri: 'https://example.com/icon.png' };
      render(<RouterToolbarItemWithImageSupport {...baseProps} imageSource={imageSource} />);

      expect(mockUseImage.mock.calls[0][0]).toEqual(imageSource);
    });

    it('passes resolved image to RouterToolbarItem when imageSource is provided', () => {
      const fakeImageRef = { __expo_shared_object_id__: 42 } as unknown as ImageRef;
      mockUseImage.mockReturnValue(fakeImageRef);

      const imageSource = { uri: 'https://example.com/icon.png' };
      render(<RouterToolbarItemWithImageSupport {...baseProps} imageSource={imageSource} />);

      expect(MockedRouterToolbarItem.mock.calls[0][0].image).toBe(fakeImageRef);
    });

    it('prefers explicit image prop over resolved imageSource', () => {
      const explicitImage = { __expo_shared_object_id__: 99 } as unknown as ImageRef;
      const resolvedImage = { __expo_shared_object_id__: 42 } as unknown as ImageRef;
      mockUseImage.mockReturnValue(resolvedImage);

      const imageSource = { uri: 'https://example.com/icon.png' };
      render(
        <RouterToolbarItemWithImageSupport
          {...baseProps}
          image={explicitImage}
          imageSource={imageSource}
        />
      );

      expect(MockedRouterToolbarItem.mock.calls[0][0].image).toBe(explicitImage);
    });

    it('passes null image when useImage returns null for imageSource', () => {
      mockUseImage.mockReturnValue(null);

      const imageSource = { uri: 'https://example.com/icon.png' };
      render(<RouterToolbarItemWithImageSupport {...baseProps} imageSource={imageSource} />);

      // undefined ?? null = null
      expect(MockedRouterToolbarItem.mock.calls[0][0].image).toBeNull();
    });

    it('imageSource takes priority over xcassetName', () => {
      const imageSource = { uri: 'https://example.com/icon.png' };
      render(
        <RouterToolbarItemWithImageSupport
          {...baseProps}
          imageSource={imageSource}
          xcassetName="my-icon"
        />
      );

      // useImage is called with imageSource, not xcassetName
      expect(mockUseImage.mock.calls[0][0]).toEqual(imageSource);
      expect(mockUseImage).not.toHaveBeenCalledWith({ uri: 'my-icon' }, {}, ['my-icon']);
    });

    it('does not call useImage when no imageSource or xcassetName', () => {
      render(<RouterToolbarItemWithImageSupport {...baseProps} />);

      expect(mockUseImage).not.toHaveBeenCalled();
    });
  });
});
