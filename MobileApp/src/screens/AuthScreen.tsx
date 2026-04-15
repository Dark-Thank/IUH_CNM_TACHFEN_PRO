import SignInForm from "@/components/auth/SignInForm";
import SignupForm from "@/components/auth/SignupForm";
import OtpVerifyForm from "@/components/auth/OtpVerifyForm";
import { useState } from "react";
import { useAuthStore } from "@/stores/useAuthStore";

type AuthMode = "signin" | "signup";

export default function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const pendingOtpEmail = useAuthStore((s) => s.pendingOtpEmail);

  if (pendingOtpEmail) {
    return <OtpVerifyForm onCancel={() => useAuthStore.setState({ pendingOtpEmail: null })} />;
  }

  if (mode === "signup") {
    return <SignupForm onSignInPress={() => setMode("signin")} />;
  }

  return <SignInForm onSignUpPress={() => setMode("signup")} />;
}
