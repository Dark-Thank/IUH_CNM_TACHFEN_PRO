import { Alert } from "react-native";

const show = (title: string, message: string) => {
  Alert.alert(title, message);
};

export const toast = {
  success: (message: string) => show("Thành công", message),
  error: (message: string) => show("Lỗi", message),
  info: (message: string) => show("Thông báo", message),
  warning: (message: string) => show("Cảnh báo", message),
};
