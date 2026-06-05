import SignInForm from "@/components/auth/SignInForm";
import SignupForm from "@/components/auth/SignupForm";
import OtpVerifyForm from "@/components/auth/OtpVerifyForm";
import OtpResetForm from "@/components/auth/OtpResetForm";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";
import { useState } from "react";
import { useAuthStore } from "@/stores/useAuthStore";

type AuthMode = "signin" | "signup";

export default function AuthScreen() {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const pendingOtpEmail = useAuthStore((s) => s.pendingOtpEmail);

  if (pendingOtpEmail) {
    // show reset flow when pendingOtpForReset is true
    if (useAuthStore.getState().pendingOtpForReset) {
      return (
        <OtpResetForm
          onCancel={() => useAuthStore.setState({ pendingOtpEmail: null, pendingOtpForReset: false })}
          onSuccess={() => {
            useAuthStore.setState({ pendingOtpEmail: null, pendingOtpForReset: false });
            setMode("signin");
          }}
        />
      );
    }

    return <OtpVerifyForm onCancel={() => useAuthStore.setState({ pendingOtpEmail: null })} />;
  }

  if (mode === "signup") {
    return <SignupForm onSignInPress={() => setMode("signin")} />;
  }

  if (mode === "forgot") {
    return <ForgotPasswordForm onCancel={() => setMode("signin")} />;
  }

  return <SignInForm onSignUpPress={() => setMode("signup")} onForgotPress={() => setMode("forgot")} />;
}
