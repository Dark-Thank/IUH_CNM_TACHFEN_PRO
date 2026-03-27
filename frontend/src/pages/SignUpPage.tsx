import { SignupForm } from '@/components/auth/signup-form'


const SignUpPage = () => {
  return (
    <div className="flex min-h-screen w-screen items-center justify-center bg-muted p-6 md:p-10">
      <div className="w-full max-w-4xl mx-auto">
        <SignupForm />
      </div>
    </div>
  )
}

export default SignUpPage