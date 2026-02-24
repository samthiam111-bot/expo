import { SendMessageError } from '../CliExtensionUtils';
import { sendCliMessageAsync } from '../sendCliMessage';

describe('sendCliMessageAsync', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('rejects when no apps are provided', async () => {
    await expect(sendCliMessageAsync('test', 'plugin', [])).rejects.toThrow(
      'No apps provided to send the message to.'
    );
  });

  it('rejects with SendMessageError when apps have different WebSocket hosts', async () => {
    const app1 = createApp({ webSocketDebuggerUrl: 'ws://localhost:8081/inspector' });
    const app2 = createApp({
      id: 'device-1-page-1',
      webSocketDebuggerUrl: 'ws://otherhost:9090/inspector',
    });

    await expect(sendCliMessageAsync('test', 'plugin', [app1, app2])).rejects.toThrow(
      SendMessageError
    );
  });

  it('connects to the broadcast WebSocket URL derived from the app', () => {
    const app = createApp({ webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=0' });

    sendCliMessageAsync('test', 'plugin', [app]);

    expect(mockWsInstance.url).toBe('ws://localhost:8081/expo-dev-plugins/broadcast');
  });

  it('sends the correct message payload on open', () => {
    const app = createApp();

    sendCliMessageAsync('doSomething', 'my-plugin', [app]);
    mockWsInstance.triggerOpen();

    expect(mockWsInstance.send).toHaveBeenCalledWith(
      JSON.stringify({
        messageKey: { pluginName: 'my-plugin', method: 'doSomething' },
        payload: { from: 'cli' },
      })
    );
  });

  it('includes extra params in the payload when provided', () => {
    const app = createApp();

    sendCliMessageAsync('query', 'my-plugin', [app], { sql: 'SELECT 1', dbName: 'test.db' });
    mockWsInstance.triggerOpen();

    const sent = JSON.parse(mockWsInstance.send.mock.calls[0][0]);
    expect(sent.payload).toEqual({ from: 'cli', sql: 'SELECT 1', dbName: 'test.db' });
  });

  it('resolves with result when a single app responds', async () => {
    const app = createApp();

    const promise = sendCliMessageAsync('query', 'plugin', [app]);
    mockWsInstance.triggerOpen();
    mockWsInstance.triggerMessage(
      createResponse('plugin', 'query', 'iPhone 15', 'com.test.app', 'ok')
    );

    await expect(promise).resolves.toEqual({ 'device-0-page-1': 'ok' });
  });

  it('resolves when all apps respond', async () => {
    const app1 = createApp();
    const app2 = createApp({
      id: 'device-1-page-1',
      appId: 'com.test.app2',
      deviceName: 'iPhone 16',
      webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=1&page=1',
    });

    const promise = sendCliMessageAsync('query', 'plugin', [app1, app2]);
    mockWsInstance.triggerOpen();

    // First app responds
    mockWsInstance.triggerMessage(
      createResponse('plugin', 'query', 'iPhone 15', 'com.test.app', 'result-1')
    );
    // Second app responds
    mockWsInstance.triggerMessage(
      createResponse('plugin', 'query', 'iPhone 16', 'com.test.app2', 'result-2')
    );

    await expect(promise).resolves.toEqual({
      'device-0-page-1': 'result-1',
      'device-1-page-1': 'result-2',
    });
  });

  it('closes the WebSocket after all apps respond', async () => {
    const app = createApp();

    const promise = sendCliMessageAsync('query', 'plugin', [app]);
    mockWsInstance.triggerOpen();
    mockWsInstance.triggerMessage(
      createResponse('plugin', 'query', 'iPhone 15', 'com.test.app', 'done')
    );

    await promise;
    expect(mockWsInstance.close).toHaveBeenCalled();
  });

  it('rejects with SendMessageError when no apps respond before timeout', async () => {
    const app = createApp();

    const promise = sendCliMessageAsync('query', 'plugin', [app], undefined, 1000);
    mockWsInstance.triggerOpen();

    jest.advanceTimersByTime(1000);

    await expect(promise).rejects.toThrow(SendMessageError);
    await expect(promise).rejects.toThrow('Timeout');
  });

  it('resolves with partial results when some apps respond before timeout', async () => {
    const app1 = createApp();
    const app2 = createApp({
      id: 'device-1-page-1',
      appId: 'com.test.app2',
      deviceName: 'iPad',
      webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=1&page=1',
    });

    const promise = sendCliMessageAsync('query', 'plugin', [app1, app2], undefined, 1000);
    mockWsInstance.triggerOpen();

    // Only first app responds
    mockWsInstance.triggerMessage(
      createResponse('plugin', 'query', 'iPhone 15', 'com.test.app', 'ok')
    );

    jest.advanceTimersByTime(1000);

    await expect(promise).resolves.toEqual({
      'device-0-page-1': 'ok',
      'device-1-page-1': 'No response (timeout)',
    });
  });

  it('rejects when response is from an unknown app', async () => {
    const app = createApp();

    const promise = sendCliMessageAsync('query', 'plugin', [app]);
    mockWsInstance.triggerOpen();
    mockWsInstance.triggerMessage(
      createResponse('plugin', 'query', 'Unknown Device', 'com.unknown.app', 'nope')
    );

    await expect(promise).rejects.toThrow('Received response for unknown app');
  });

  it('ignores messages for a different plugin', async () => {
    const app = createApp();

    const promise = sendCliMessageAsync('query', 'plugin', [app], undefined, 500);
    mockWsInstance.triggerOpen();

    // Message for a different plugin - should be ignored
    mockWsInstance.triggerMessage(
      createResponse('other-plugin', 'query', 'iPhone 15', 'com.test.app', 'wrong')
    );

    jest.advanceTimersByTime(500);

    // Should timeout because the matching response never arrived
    await expect(promise).rejects.toThrow('Timeout');
  });

  it('ignores messages for a different method', async () => {
    const app = createApp();

    const promise = sendCliMessageAsync('query', 'plugin', [app], undefined, 500);
    mockWsInstance.triggerOpen();

    // Response for a different method
    mockWsInstance.triggerMessage(
      createResponse('plugin', 'otherMethod', 'iPhone 15', 'com.test.app', 'wrong')
    );

    jest.advanceTimersByTime(500);

    await expect(promise).rejects.toThrow('Timeout');
  });

  it('rejects on WebSocket error', async () => {
    const app = createApp();
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const promise = sendCliMessageAsync('query', 'plugin', [app]);
    mockWsInstance.triggerOpen();
    mockWsInstance.triggerError();

    await expect(promise).rejects.toThrow('Failed to connect to the WebSocket server');
    consoleSpy.mockRestore();
  });
});

let mockWsInstance: MockWS;

class MockWS {
  private listeners: Record<string, ((event: any) => void)[]> = {};

  close = jest.fn();
  send = jest.fn();

  constructor(public url: string) {
    mockWsInstance = this;
  }

  addEventListener(event: string, listener: (event: any) => void) {
    (this.listeners[event] ??= []).push(listener);
  }

  /** Fire the 'open' event on the mock socket. */
  triggerOpen() {
    for (const fn of this.listeners['open'] ?? []) fn({});
  }

  /** Fire a 'message' event with a JSON-stringified payload. */
  triggerMessage(data: string) {
    for (const fn of this.listeners['message'] ?? []) fn({ data });
  }

  /** Fire the 'error' event. */
  triggerError() {
    for (const fn of this.listeners['error'] ?? []) fn({});
  }
}

// @ts-expect-error – replacing the global with our mock
globalThis.WebSocket = MockWS;

// Helper functions to create mock apps and responses

function createApp(overrides?: Record<string, any>) {
  return {
    id: 'device-0-page-1',
    title: 'TestApp (iPhone 15)',
    appId: 'com.test.app',
    description: 'React Native Bridgeless [C++ connection]',
    type: 'node' as const,
    devtoolsFrontendUrl: 'chrome-devtools://devtools/bundled/inspector.html',
    webSocketDebuggerUrl: 'ws://localhost:8081/inspector/debug?device=0&page=1',
    deviceName: 'iPhone 15',
    ...overrides,
  };
}

function createResponse(
  pluginName: string,
  method: string,
  deviceName: string,
  applicationId: string,
  message: string
) {
  return JSON.stringify({
    messageKey: { pluginName, method: `${method}_response` },
    payload: { deviceName, applicationId, message },
  });
}
