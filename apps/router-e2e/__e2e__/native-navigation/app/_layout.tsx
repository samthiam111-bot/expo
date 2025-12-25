import { Stack, unstable_navigationEvents } from 'expo-router';
import { Appearance } from 'react-native';

const appStart = Date.now();

(['pageWillRender', 'pageFocused', 'pageBlurred', 'pageRemoved'] as const).forEach((eventType) => {
  unstable_navigationEvents.addListener(eventType, (event) => {
    console.log(`[${Date.now() - appStart}ms] ${eventType}:`, event.pathname, event.screenId);
  });
});

// Appearance.setColorScheme('dark');

export default function Layout() {
  return (
    <Stack screenOptions={{}}>
      <Stack.Screen name="index" options={{ title: 'Home', headerTransparent: true }} />
      <Stack.Screen
        name="toolbar"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.4],
          headerTransparent: true,
          title: '',
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
    </Stack>
  );
}
