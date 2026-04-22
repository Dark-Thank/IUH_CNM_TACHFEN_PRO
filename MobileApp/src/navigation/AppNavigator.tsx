import ChatAppScreen from "@/screens/ChatAppScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import { useThemeStore } from "@/stores/useThemeStore";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type Theme,
} from "@react-navigation/native";
import { MessageCircleMore, Settings } from "lucide-react-native";
import { type ViewStyle } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

export type RootTabParamList = {
  Chat: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

const lightNavigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: "#7c3aed",
    background: "#f8fafc",
    card: "#ffffff",
    text: "#0f172a",
    border: "#e2e8f0",
    notification: "#ec4899",
  },
};

const darkNavigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: "#c084fc",
    background: "#0f172a",
    card: "#111827",
    text: "#f8fafc",
    border: "#1f2937",
    notification: "#f472b6",
  },
};

const getTabBarIcon = (
  routeName: keyof RootTabParamList,
  color: string,
  size: number
) => {
  switch (routeName) {
    case "Chat":
      return <MessageCircleMore color={color} size={size} />;
    case "Settings":
      return <Settings color={color} size={size} />;
    default:
      return <MessageCircleMore color={color} size={size} />;
  }
};

const getHeaderStyle = (isDark: boolean): ViewStyle => ({
  backgroundColor: isDark ? "#111827" : "#ffffff",
});

export default function AppNavigator() {
  const { isDark } = useThemeStore();

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={isDark ? darkNavigationTheme : lightNavigationTheme}>
        <Tab.Navigator
          initialRouteName="Chat"
          screenOptions={({ route }) => ({
            headerTitleAlign: "center",
            headerStyle: getHeaderStyle(isDark),
            headerTintColor: isDark ? "#f8fafc" : "#0f172a",
            headerShadowVisible: false,
            tabBarActiveTintColor: isDark ? "#d8b4fe" : "#7c3aed",
            tabBarInactiveTintColor: isDark ? "#94a3b8" : "#64748b",
            tabBarHideOnKeyboard: true,
            tabBarStyle: {
              backgroundColor: isDark ? "#111827" : "#ffffff",
              borderTopColor: isDark ? "#1f2937" : "#e2e8f0",
              height: 64,
              paddingTop: 6,
              paddingBottom: 8,
            },
            tabBarLabelStyle: {
              fontSize: 12,
              fontWeight: "700",
            },
            tabBarIcon: ({ color, size }) =>
              getTabBarIcon(route.name, color, size),
          })}
        >
          <Tab.Screen
            name="Chat"
            component={ChatAppScreen}
            options={{
              title: "Trò chuyện",
              tabBarLabel: "Trò chuyện",
            }}
          />
          <Tab.Screen
            name="Settings"
            component={SettingsScreen}
            options={{
              title: "Cài đặt",
              tabBarLabel: "Cài đặt",
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
