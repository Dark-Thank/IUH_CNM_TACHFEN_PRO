import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUserStore } from "@/stores/useUserStore";
import ChangePasswordForm from "./ChangePasswordForm";

const PrivacySettings = () => {
  const navigate = useNavigate();
  const { deleteAccount } = useUserStore();
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      "Bạn có chắc chắn muốn xóa tài khoản? Toàn bộ dữ liệu liên quan đến tài khoản sẽ bị xóa."
    );

    if (!confirmed) {
      return;
    }

    setDeleting(true);

    try {
      await deleteAccount();
      navigate("/signin", { replace: true });
    } catch (error) {
      console.error("Không thể xóa tài khoản", error);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card className="glass-strong border-border/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Quyền riêng tư và bảo mật
        </CardTitle>
        <CardDescription>
          Quản lý cài đặt bảo mật và thao tác nhạy cảm của tài khoản.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="p-2 bg-muted rounded-md">
            <ChangePasswordForm />
          </div>

        </div>

        <div className="pt-4 border-t border-border/30">
          <h4 className="font-medium mb-3 text-destructive">Khu vực nguy hiểm</h4>
          <Button
            type="button"
            variant="destructive"
            className="w-full"
            onClick={handleDeleteAccount}
            disabled={deleting}
          >
            {deleting ? "Đang xóa tài khoản..." : "Xóa tài khoản"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PrivacySettings;
