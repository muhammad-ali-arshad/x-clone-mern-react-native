import { ClerkProvider } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "../global.css";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

if (!publishableKey) {
  throw new Error(
    'Missing Publishable Key. Please set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in your .env'
  );
}

export default function RootLayout() {
  return (
  <SafeAreaProvider>
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache} >
        <Stack screenOptions={{headerShown:false}}>
          <Stack.Screen name="(auth)" options={{headerShown:false}}/>
          <Stack.Screen name="(tabs)" options={{headerShown:false}}/>
        </Stack>
    </ClerkProvider>
  </SafeAreaProvider>
  )
}
