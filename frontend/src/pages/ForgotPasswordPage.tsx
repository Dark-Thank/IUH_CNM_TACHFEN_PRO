import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/useAuthStore";

export default function ForgotPasswordPage() {
    const { register, handleSubmit } = useForm<{ email: string }>();
    const { forgotPassword } = useAuthStore();

    const navigate = useNavigate();
    const loading = useAuthStore((state) => state.loading);

    const onSubmit = async (data: { email: string }) => {
        try {
            await forgotPassword(data.email);
            navigate("/verify-otp");
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-muted p-6">
            <div className="w-full max-w-md">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div>
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" {...register("email")} />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>Gửi mã đặt lại</Button>
                </form>
            </div>
        </div>
    );
}
