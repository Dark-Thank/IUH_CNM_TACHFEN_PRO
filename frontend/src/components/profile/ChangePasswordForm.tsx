import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import api from "@/lib/axios";
import { useAuthStore } from "@/stores/useAuthStore";
import { useState } from "react";
import { authService } from "@/services/authService";

export default function ChangePasswordForm() {
    const { register, handleSubmit, reset } = useForm<{ oldPassword: string; newPassword: string }>();
    const [open, setOpen] = useState(false);
    const [awaitingOtp, setAwaitingOtp] = useState(false);
    const [showOld, setShowOld] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [otp, setOtp] = useState("");
    const [pendingNewPassword, setPendingNewPassword] = useState("");
    const user = useAuthStore((s: any) => s.user);

    const requestChange = async (data: { oldPassword: string; newPassword: string }) => {
        try {
            await api.post("/users/request-change-password", data);
            toast.success("Mã OTP đã được gửi tới email của bạn. Vui lòng kiểm tra để xác nhận đổi mật khẩu.");
            // save newPassword so OTP confirm step can use it
            setPendingNewPassword(data.newPassword);
            setAwaitingOtp(true);
        } catch (e: any) {
            console.error(e);
            const msg = e?.response?.data?.message || "Yêu cầu đổi mật khẩu thất bại.";
            toast.error(msg);
        }
    };

    const confirmOtp = async () => {
        try {
            if (!user?.email) return toast.error("Không tìm thấy email người dùng.");
            // newPassword should be read from form values
            const formValues = (await import('react-hook-form')).then(() => null);
            // Instead get newPassword from DOM via form state is cumbersome; simpler: read values via register's ref
            // We'll re-use the form's current values by using the form's getValues
            // But react-hook-form getValues isn't available here, so restructure: use handleSubmit wrapper
        } catch (e) {
            console.error(e);
        }
    };

    const onSubmit = async (data: { oldPassword: string; newPassword: string }) => {
        await requestChange(data);
    };

    const onConfirmOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const newPassword = pendingNewPassword || '';
            if (!newPassword) return toast.error('Vui lòng nhập mật khẩu mới.');
            if (!user?.email) return toast.error('Không tìm thấy email người dùng.');

            await authService.resetPassword(user.email, otp, newPassword);
            toast.success('Đổi mật khẩu thành công.');
            setAwaitingOtp(false);
            setOpen(false);
            reset();
            setPendingNewPassword('');
        } catch (err: any) {
            console.error(err);
            const msg = err?.response?.data?.message || 'Mã OTP không chính xác.';
            toast.error(msg);
        }
    };

    return (
        <div>
            <Button type="button" onClick={() => setOpen((s) => !s)} className="w-full">{open ? 'Đóng' : 'Đổi mật khẩu'}</Button>
            {open && (
                <div className="mt-4">
                    {!awaitingOtp ? (
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div>
                                <Label htmlFor="old">Mật khẩu hiện tại</Label>
                                <div className="relative">
                                    <Input id="old" type={showOld ? 'text' : 'password'} {...register('oldPassword')} />
                                    <button type="button" onClick={() => setShowOld(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label={showOld ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
                                        {showOld ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10 10 0 0 1 12 20c-4.97 0-9.11-3.16-10-8 0 0 3.5-8 10-8 2.3 0 4.4.7 6.06 1.94" /><path d="M1 1l22 22" /></svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" /><circle cx="12" cy="12" r="3" /></svg>
                                        )}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <Label htmlFor="new">Mật khẩu mới</Label>
                                <div className="relative">
                                    <Input id="new" type={showNew ? 'text' : 'password'} {...register('newPassword')} />
                                    <button type="button" onClick={() => setShowNew(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label={showNew ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
                                        {showNew ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10 10 0 0 1 12 20c-4.97 0-9.11-3.16-10-8 0 0 3.5-8 10-8 2.3 0 4.4.7 6.06 1.94" /><path d="M1 1l22 22" /></svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" /><circle cx="12" cy="12" r="3" /></svg>
                                        )}
                                    </button>
                                </div>
                            </div>
                            <Button type="submit" className="w-full">Gửi yêu cầu đổi mật khẩu</Button>
                        </form>
                    ) : (
                        <form onSubmit={onConfirmOtp} className="space-y-4 mt-4">
                            <div>
                                <Label htmlFor="otp">Mã OTP</Label>
                                <Input id="otp-confirm" type="text" value={otp} onChange={e => setOtp(e.target.value)} />
                            </div>
                            <Button type="submit" className="w-full">Xác nhận OTP</Button>
                        </form>
                    )}
                </div>
            )}
        </div>
    );
}
