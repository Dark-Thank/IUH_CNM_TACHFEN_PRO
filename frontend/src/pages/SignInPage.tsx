import { SignInForm } from '@/components/auth/signin-form'

const SignInPage = () => {
  return (
    <div className="flex min-h-screen w-screen items-center justify-center bg-muted p-6 md:p-10">
      <div className="w-full max-w-4xl mx-auto">
        <SignInForm />
      </div>
    </div>
  )
}

export default SignInPage