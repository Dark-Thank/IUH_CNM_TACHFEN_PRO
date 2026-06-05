import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

interface IUserAvatarProps {
  type: "sidebar" | "chat" | "profile";
  name: string;
  avatarUrl?: string;
  className?: string;
}

const UserAvatar = ({ type, name, avatarUrl, className }: IUserAvatarProps) => {
  const [hasImageError, setHasImageError] = useState(false);
  const bgColor = !avatarUrl || hasImageError ? "bg-primary" : "";

  if (!name) {
    name = "TACHFEN";
  }

  useEffect(() => {
    setHasImageError(false);
  }, [avatarUrl]);

  return (
    <Avatar
      className={cn(
        className ?? "",
        type === "sidebar" && "size-12 text-base",
        type === "chat" && "size-8 text-sm",
        type === "profile" && "size-24 text-3xl shadow-md"
      )}
    >
      {!hasImageError && avatarUrl ? (
        <AvatarImage
          src={avatarUrl}
          alt={name}
          onError={() => setHasImageError(true)}
        />
      ) : null}
      <AvatarFallback className={`${bgColor} text-white font-semibold`}>
        {name.charAt(0)}
      </AvatarFallback>
    </Avatar>
  );
};

export default UserAvatar;
