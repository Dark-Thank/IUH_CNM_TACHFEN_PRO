import { StatusBar } from "expo-status-bar";
import AuthScreen from "@/screens/AuthScreen";
import AppNavigator from "@/navigation/AppNavigator";
import { useAuthStore } from "@/stores/useAuthStore";
import { useSocketStore } from "@/stores/useSocketStore";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { useEffect } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function App() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const connectSocket = useSocketStore((state) => state.connectSocket);
  const disconnectSocket = useSocketStore((state) => state.disconnectSocket);
  const registerAppStateListener = useSocketStore(
    (state) => state.registerAppStateListener
  );
  const unregisterAppStateListener = useSocketStore(
    (state) => state.unregisterAppStateListener
  );

  useEffect(() => {
    registerAppStateListener();

    return () => unregisterAppStateListener();
  }, [registerAppStateListener, unregisterAppStateListener]);

  useEffect(() => {
    if (accessToken) {
      connectSocket();
    } else {
      disconnectSocket();
    }

    return () => disconnectSocket();
  }, [accessToken, connectSocket, disconnectSocket]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <BottomSheetModalProvider>
        <StatusBar style="auto" />
        {accessToken ? <AppNavigator /> : <AuthScreen />}
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
