import OtpVerifyForm from "@/components/auth/OtpVerifyForm";
import { useAuthStore } from "@/stores/useAuthStore";

const OtpVerifyPage = () => {
    const { pendingOtpEmail } = useAuthStore();

    return (
        <div className="flex min-h-screen items-center justify-center bg-muted p-6">
            <div className="w-full max-w-md">
                <OtpVerifyForm defaultEmail={pendingOtpEmail || undefined} />
            </div>
        </div>
    );
};

export default OtpVerifyPage;
