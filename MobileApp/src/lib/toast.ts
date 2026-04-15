import { Alert } from "react-native";

const show = (title: string, message: string) => {
  Alert.alert(title, message);
};

export const toast = {
  success: (message: string) => show("Success", message),
  error: (message: string) => show("Error", message),
  info: (message: string) => show("Info", message),
  warning: (message: string) => show("Warning", message),
};
