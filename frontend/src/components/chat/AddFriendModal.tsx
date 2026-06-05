import { useFriendStore } from "@/stores/useFriendStore";
import { cn } from "@/lib/utils";
import type { User } from "@/types/user";
import { UserPlus } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import SearchForm from "../addFriendModal/SearchForm";
import SendFriendRequestForm from "../addFriendModal/SendFriendRequestForm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
export interface IFormValues {
  username: string;
  message: string;
}

interface AddFriendModalProps {
  trigger?: ReactNode;
  triggerClassName?: string;
}

function AddFriendModal({ trigger, triggerClassName }: AddFriendModalProps) {
  const [isFound, setIsFound] = useState<boolean | null>(null);
  const [searchUser, setSearchUser] = useState<User>();
  const [searchedUsername, setSearchedUsername] = useState("");
  const { loading, searchByUsername, addFriend } = useFriendStore();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<IFormValues>({
    defaultValues: { username: "", message: "" },
  });

  const usernameValue = watch("username");

  const handleSearch = handleSubmit(async (data) => {
    const username = data.username.trim();
    if (!username) return;

    setIsFound(null);
    setSearchedUsername(username);

    try {
      const foundUser = await searchByUsername(username);
      if (foundUser) {
        setIsFound(true);
        setSearchUser(foundUser);
      } else {
        setIsFound(false);
      }
    } catch (error) {
      console.error(error);
      setIsFound(false);
    }
  });

  const handleSend = handleSubmit(async (data) => {
    if (!searchUser) return;

    try {
      const message = await addFriend(
        searchUser._id,
        (data.message ?? "").trim()
      );
      toast.success(message);

      handleCancel();
    } catch (error) {
      console.error("Lỗi xảy ra khi gửi request từ form", error);
    }
  });

  const handleCancel = () => {
    reset();
    setSearchedUsername("");
    setIsFound(null);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            className={cn(
              "z-10 flex cursor-pointer items-center justify-center rounded-full hover:bg-sidebar-accent",
              triggerClassName ?? "size-5"
            )}
          >
            <UserPlus className="size-4" />
            <span className="sr-only">Kết bạn</span>
          </button>
        )}
      </DialogTrigger>

      <DialogContent
  className="sm:max-w-md border-none"
  onClick={(e) => e.stopPropagation()}
>
        <DialogHeader>
          <DialogTitle>Kết Bạn</DialogTitle>
        </DialogHeader>

        {isFound !== true && (
          <>
            <SearchForm
              register={register}
              errors={errors}
              usernameValue={usernameValue}
              loading={loading}
              isFound={isFound}
              searchedUsername={searchedUsername}
              onSubmit={handleSearch}
              onCancel={handleCancel}
            />
          </>
        )}

        {isFound === true && (
          <>
            <SendFriendRequestForm
              register={register}
              loading={loading}
              searchedUsername={searchedUsername}
              onSubmit={handleSend}
              onBack={() => setIsFound(null)}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default AddFriendModal