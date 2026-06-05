"use client"

import * as React from "react"
import { useState } from "react"

import { NavUser } from "@/components/sidebar/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { UserPlus, Users, Moon, Sun } from "lucide-react";
import { Switch } from "../ui/switch";
import CreateNewChat from "../chat/CreateNewChat";
import NewGroupChatModal from "../chat/NewGroupChatModal";
import ConversationList from "../chat/ConversationList";
import JoinGroupModal from "../chat/JoinGroupModal";
import { Card } from "../ui/card";
import { useThemeStore } from "@/stores/useThemeStore"
import { useAuthStore } from "@/stores/useAuthStore"
import ConversationSkeleton from "../skeleton/ConversationSkeleton"
import { useChatStore } from "@/stores/useChatStore"
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { isDark, toggleTheme } = useThemeStore();
  const { user } = useAuthStore();
  const { convoLoading } = useChatStore();
  const [isJoinGroupOpen, setIsJoinGroupOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  return (
    <>
      <Sidebar variant="inset" {...props}>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" className="bg-gradient-primary">
                <a href="#">
                  <div className="flex w-full items-center px-2 justify-between">
                    <h1 className="text-xl font-bold text-white">TACHFEN</h1>
                    <div className="flex items-center gap-2">
                      <Sun className="size-4 text-white/80" />
                      <Switch
                        checked={isDark}
                        onCheckedChange={toggleTheme}
                        className="data-[state=checked]:bg-background/80"
                      />
                      <Moon className="size-4 text-white/80" />
                    </div>
                  </div>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent className="beautiful-scrollbar">
          <SidebarGroup>
            <SidebarGroupLabel className="uppercase">khám phá</SidebarGroupLabel>
            <SidebarGroupContent className="space-y-3">
              <CreateNewChat />
              <Card
                className="glass cursor-pointer p-3 transition-smooth hover:shadow-soft group/card"
                onClick={() => setIsCreateGroupOpen(true)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex size-8 items-center justify-center rounded-full bg-gradient-chat transition-bounce group-hover/card:scale-110">
                      <Users className="size-4 text-white" />
                    </div>
                    <span className="truncate text-sm font-medium capitalize">
                      Tạo nhóm mới
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setIsJoinGroupOpen(true);
                    }}
                    className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/80 text-muted-foreground transition hover:border-primary/30 hover:text-primary"
                    title="Tham gia nhóm"
                  >
                    <UserPlus className="size-4" />
                    <span className="sr-only">Tham gia nhóm</span>
                  </button>
                </div>
              </Card>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel className="uppercase">cuộc trò chuyện</SidebarGroupLabel>
            <SidebarGroupContent>
              {convoLoading ? <ConversationSkeleton /> : <ConversationList />}
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          {user && <NavUser user={user} />}
        </SidebarFooter>
      </Sidebar>

      <JoinGroupModal
        isOpen={isJoinGroupOpen}
        onClose={() => setIsJoinGroupOpen(false)}
      />

      <NewGroupChatModal
        open={isCreateGroupOpen}
        onOpenChange={setIsCreateGroupOpen}
      />
    </>
  )
}
