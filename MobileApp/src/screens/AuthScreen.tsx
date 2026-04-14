import SignInForm from "@/components/auth/SignInForm";
import SignupForm from "@/components/auth/SignupForm";
import { useState } from "react";

type AuthMode = "signin" | "signup";

export default function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>("signin");

  if (mode === "signup") {
    return <SignupForm onSignInPress={() => setMode("signin")} />;
  }

  return <SignInForm onSignUpPress={() => setMode("signup")} />;
}
