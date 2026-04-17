import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Bell, ShieldBan } from "lucide-react";
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
      "Ban co chac chan muon xoa tai khoan? Toan bo du lieu lien quan den tai khoan se bi xoa."
    );

    if (!confirmed) {
      return;
    }

    setDeleting(true);

    try {
      await deleteAccount();
      navigate("/signin", { replace: true });
    } catch (error) {
      console.error("Khong the xoa tai khoan", error);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card className="glass-strong border-border/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Quyen rieng tu va bao mat
        </CardTitle>
        <CardDescription>
          Quan ly cai dat bao mat va thao tac nhay cam cua tai khoan.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="p-2 bg-muted rounded-md">
            <ChangePasswordForm />
          </div>

          <Button
            variant="outline"
            className="w-full justify-start glass-light border-border/30 hover:text-info"
          >
            <Bell className="h-4 w-4 mr-2" />
            Cai dat thong bao
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start glass-light border-border/30 hover:text-destructive"
          >
            <ShieldBan className="size-4 mr-2" />
            Chan va bao cao
          </Button>
        </div>

        <div className="pt-4 border-t border-border/30">
          <h4 className="font-medium mb-3 text-destructive">Khu vuc nguy hiem</h4>
          <Button
            type="button"
            variant="destructive"
            className="w-full"
            onClick={handleDeleteAccount}
            disabled={deleting}
          >
            {deleting ? "Dang xoa tai khoan..." : "Xoa tai khoan"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PrivacySettings;
