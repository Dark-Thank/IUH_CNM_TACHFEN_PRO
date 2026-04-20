
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/useAuthStore";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Label } from "../ui/label";

const signInSchema = z.object({
    username: z.string().min(3, "Tên đăng nhập phải có ít nhất 3 ký tự"),
    password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự"),
});

type SignInFormValues = z.infer<typeof signInSchema>;

export function SignInForm({ className, ...props }: React.ComponentProps<"div">) {
    const { signIn } = useAuthStore();
    const navigate = useNavigate();
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<SignInFormValues>({
        resolver: zodResolver(signInSchema),
    });

    const [showPassword, setShowPassword] = useState(false);

    const onSubmit = async (data: SignInFormValues) => {
        const { username, password } = data;

        // gọi backend để signin
        const res = await signIn(username, password);
        // đi tới trang nhập OTP
        navigate("/verify-otp");
    };

    return (
        <div
            className={cn("flex flex-col gap-6", className)}
            {...props}
        >
            <Card className="overflow-hidden p-0 border-border">
                <CardContent className="grid p-0 md:grid-cols-2">
                    <form
                        className="p-6 md:p-8"
                        onSubmit={handleSubmit(onSubmit)}
                    >
                        <div className="flex flex-col gap-6">
                            {/* header - logo */}
                            <div className="flex flex-col items-center text-center gap-2">
                                <a
                                    href="/"
                                    className="mx-auto block w-fit text-center"
                                >
                                    <img
                                        src="/logo.svg"
                                        alt="logo"
                                    />
                                </a>

                                <h1 className="text-2xl font-bold">Chào mừng đã quay lại</h1>
                                <p className="text-muted-foreground text-balance">
                                    Đăng nhập vào tài khoản TACHFEN
                                </p>
                            </div>


                            {/* username */}
                            <div className="flex flex-col gap-3">
                                <Label
                                    htmlFor="username"
                                    className="block text-sm"
                                >
                                    Tên đăng nhập
                                </Label>
                                <Input
                                    type="text"
                                    id="username"
                                    placeholder="tachfen"
                                    {...register("username")}
                                />
                                {errors.username && (
                                    <p className="error-message">
                                        {errors.username.message}
                                    </p>
                                )}
                            </div>

                            {/* password */}
                            <div className="flex flex-col gap-3">
                                <Label
                                    htmlFor="password"
                                    className="block text-sm"
                                >
                                    Mật khẩu
                                </Label>
                                <div className="relative">
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        id="password"
                                        {...register("password")}
                                    />
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
                                {errors.password && (
                                    <p className="error-message">
                                        {errors.password.message}
                                    </p>
                                )}
                            </div>

                            {/* nút đăng kí */}
                            <Button
                                type="submit"
                                className="w-full"
                                disabled={isSubmitting}
                            >
                                Đăng nhập
                            </Button>

                            <div className="text-center text-sm">
                                Bạn chưa có tài khoản?{" "}
                                <a
                                    href="/signup"
                                    className="underline underline-offset-4"
                                >
                                    Đăng kí
                                </a>
                                <div className="mt-2">
                                    <a href="/forgot-password" className="text-sm underline">Quên mật khẩu?</a>
                                </div>
                            </div>
                        </div>
                    </form>
                    <div className="bg-muted relative hidden md:block">
                        <img
                            src="/placeholderSignUp.png"
                            alt="Image"
                            className="absolute top-1/2 -translate-y-1/2 object-cover"
                        />
                    </div>
                </CardContent>
            </Card>
            <div className=" text-xs text-balance px-6 text-center *:[a]:hover:text-primary text-muted-foreground *:[a]:underline *:[a]:underline-offetset-4">
                Bằng cách tiếp tục, bạn đồng ý với <a href="#">Điều khoản dịch vụ</a> và{" "}
                <a href="#">Chính sách bảo mật</a> của chúng tôi.
            </div>
        </div>
    );
}
