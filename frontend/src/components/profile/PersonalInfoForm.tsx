import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useUserStore } from "@/stores/useUserStore";
import type { User } from "@/types/user";

type Props = {
  userInfo: User | null;
};

const PersonalInfoForm = ({ userInfo }: Props) => {
  const { updateProfile } = useUserStore();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDisplayName(userInfo?.displayName ?? "");
    setBio(userInfo?.bio ?? "");
  }, [userInfo?._id, userInfo?.displayName, userInfo?.bio]);

  if (!userInfo) return null;

  const trimmedDisplayName = displayName.trim();
  const trimmedBio = bio.trim();
  const hasChanges =
    trimmedDisplayName !== (userInfo.displayName ?? "").trim() ||
    trimmedBio !== (userInfo.bio ?? "").trim();

  const handleSave = async () => {
    if (!trimmedDisplayName || !hasChanges) {
      return;
    }

    setSaving(true);

    try {
      await updateProfile({
        displayName: trimmedDisplayName,
        bio: trimmedBio,
      });
    } catch (error) {
      console.error("Khong the cap nhat profile", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="glass-strong border-border/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="size-5 text-primary" />
          Thong tin ca nhan
        </CardTitle>
        <CardDescription>
          Ban co the doi ten hien thi va gioi thieu. Email va username duoc giu co dinh.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">Ten hien thi</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="glass-light border-border/30"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Ten nguoi dung</Label>
            <Input
              id="username"
              value={userInfo.username ?? ""}
              readOnly
              className="glass-light border-border/30 opacity-70"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={userInfo.email ?? ""}
              readOnly
              className="glass-light border-border/30 opacity-70"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bio">Gioi thieu</Label>
          <Textarea
            id="bio"
            rows={4}
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            className="glass-light border-border/30 resize-none"
          />
        </div>

        <Button
          type="button"
          onClick={handleSave}
          disabled={saving || !trimmedDisplayName || !hasChanges}
          className="w-full md:w-auto bg-gradient-primary hover:opacity-90 transition-opacity"
        >
          {saving ? "Dang luu..." : "Luu thay doi"}
        </Button>
      </CardContent>
    </Card>
  );
};

export default PersonalInfoForm;
