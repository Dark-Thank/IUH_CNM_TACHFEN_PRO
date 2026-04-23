import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/useAuthStore";
import { useForm } from "react-hook-form";
import { Label } from "../ui/label";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { authService } from "@/services/authService";
import { toast } from "sonner";

type FormValues = {
    email: string;
    otp: string;
    newPassword?: string;
};

export default function OtpVerifyForm({ defaultEmail }: { defaultEmail?: string }) {
    const { verifyOtp } = useAuthStore();
    const pendingForReset = useAuthStore((s: any) => s.pendingOtpForReset);
    const setAuthState = useAuthStore.setState;
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();

    const { register, handleSubmit } = useForm<FormValues>({ defaultValues: { email: defaultEmail || "" } });

    const onSubmit = async (data: FormValues) => {
        if (pendingForReset) {
            try {
                await authService.resetPassword(data.email, data.otp, data.newPassword || "");
                toast.success("Đặt lại mật khẩu thành công. Vui lòng đăng nhập.");
                // clear reset state
                setAuthState({ pendingOtpForReset: false, pendingOtpEmail: null });
                navigate("/signin");
            } catch (e) {
                console.error(e);
                toast.error("Đặt lại mật khẩu thất bại.");
            }
            return;
        }

        await verifyOtp(data.email, data.otp);
        navigate("/");
    };

    return (
        <div className="max-w-md mx-auto">
            <Card>
                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div>
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" {...register("email")} />
                        </div>

                        <div>
                            <Label htmlFor="otp">Mã OTP</Label>
                            <Input id="otp" {...register("otp")} />
                        </div>

                        {pendingForReset && (
                            <div>
                                <Label htmlFor="newPassword">Mật khẩu mới</Label>
                                <div className="relative">
                                    <Input id="newPassword" type={showPassword ? "text" : "password"} {...register("newPassword")} />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((s) => !s)}
                                        aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
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
                        )}

                        <Button type="submit" className="w-full">Xác thực OTP</Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
