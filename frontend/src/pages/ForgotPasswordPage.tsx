import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/useAuthStore";
import { authService } from "@/services/authService";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
    const { register, handleSubmit } = useForm<{ email: string }>();
    const [sent, setSent] = useState(false);

    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    const onSubmit = async (data: { email: string }) => {
        // set pending email and mark this as a password-reset flow so OTP page shows reset fields
        useAuthStore.setState({ pendingOtpEmail: data.email, pendingOtpForReset: true });
        navigate("/verify-otp");

        try {
            setLoading(true);
            await authService.forgotPassword(data.email);
            toast.success("Nếu email tồn tại, mã reset đã được gửi.");
        } catch (e) {
            console.error(e);
            toast.error("Gửi mã reset thất bại.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-muted p-6">
            <div className="w-full max-w-md">
                {!sent ? (
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div>
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" {...register("email")} />
                        </div>
                        <Button type="submit" className="w-full" disabled={loading}>Gửi mã đặt lại</Button>
                    </form>
                ) : (
                    <ResetForm />
                )}
            </div>
        </div>
    );
}

function ResetForm() {
    const { register, handleSubmit } = useForm<{ email: string; otp: string; newPassword: string }>();
    const [showPassword, setShowPassword] = useState(false);

    const onSubmitReset = async (data: { email: string; otp: string; newPassword: string }) => {
        try {
            await authService.resetPassword(data.email, data.otp, data.newPassword);
            toast.success("Đặt lại mật khẩu thành công. Vui lòng đăng nhập.");
        } catch (e) {
            console.error(e);
            toast.error("Đặt lại mật khẩu thất bại.");
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmitReset)} className="space-y-4">
            <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" {...register("email")} />
            </div>
            <div>
                <Label htmlFor="otp">Mã OTP</Label>
                <Input id="otp" {...register("otp")} />
            </div>
            <div>
                <Label htmlFor="newPassword">Mật khẩu mới</Label>
                <div className="relative">
                    <Input id="newPassword" type={showPassword ? "text" : "password"} {...register("newPassword")} />
                    <button
                        type="button"
                        aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                        onClick={() => setShowPassword((s) => !s)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                        {showPassword ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10 10 0 0 1 12 20c-4.97 0-9.11-3.16-10-8 0 0 3.5-8 10-8 2.3 0 4.4.7 6.06 1.94" /><path d="M1 1l22 22" /></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" /><circle cx="12" cy="12" r="3" /></svg>
                        )}
                    </button>
                </div>
            </div>
            <Button type="submit" className="w-full">Đặt lại mật khẩu</Button>
        </form>
    );
}
