"use client";

import Image from "next/image";
import { GlassPanel, Icon } from "@/components/ui";
import { useUser } from "@/stores";
import { getAvatarUrl } from "@/lib/avatars";

interface AvatarCardProps {
  onChooseClick: () => void;
}

export function AvatarCard({ onChooseClick }: AvatarCardProps) {
  const user = useUser();

  if (user?.avatar) {
    return (
      <GlassPanel showCornerAccents padding="p-3">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg overflow-hidden border border-primary/30">
            <Image
              src={getAvatarUrl(user.avatar)}
              alt="Your avatar"
              width={40}
              height={40}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1">
            <p className="text-[10px] text-text-muted uppercase tracking-widest">Your Avatar</p>
            <p className="text-xs font-bold text-white">{user.username ?? "Warrior"}</p>
          </div>
        </div>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel padding="p-3" className="border border-primary/30 bg-primary/5">
      <button
        type="button"
        onClick={onChooseClick}
        className="w-full flex items-center gap-3 hover:opacity-80 transition-opacity"
      >
        <div className="size-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Icon name="face" size={20} className="text-primary" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-xs font-bold text-white">Choose your avatar</p>
          <p className="text-[10px] text-text-muted">Pick a character</p>
        </div>
        <Icon name="arrow_forward" size={14} className="text-primary" />
      </button>
    </GlassPanel>
  );
}
