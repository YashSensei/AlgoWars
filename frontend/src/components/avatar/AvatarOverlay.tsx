"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Button, Icon } from "@/components/ui";
import { useAuthStore } from "@/stores";
import { usersApi } from "@/lib/api";
import { AVATARS, getAvatarUrl } from "@/lib/avatars";

interface AvatarOverlayProps {
  onComplete: () => void;
}

export function AvatarOverlay({ onComplete }: AvatarOverlayProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setUser = useAuthStore((s) => s.setUser);

  const navigate = useCallback(
    (dir: number) => {
      setSelectedIndex((prev) => (prev + dir + AVATARS.length) % AVATARS.length);
    },
    [],
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") navigate(-1);
      if (e.key === "ArrowRight") navigate(1);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [navigate]);

  const handleConfirm = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await usersApi.setAvatar(AVATARS[selectedIndex].id);
      setUser(updated);
      onComplete();
    } catch {
      setError("Failed to save avatar. Try again.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />
      <div className="relative z-10 flex flex-col items-center gap-6 px-4 w-full max-w-3xl">
        <div className="text-center mt-8 md:mt-12">
          <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tight">
            Choose Your Avatar
          </h2>
          <p className="text-xs font-japanese text-primary tracking-widest mt-1">
            アバターを選べ
          </p>
        </div>

        <Carousel selectedIndex={selectedIndex} onNavigate={navigate} />

        <p className="text-lg font-bold text-white uppercase tracking-wide">
          {AVATARS[selectedIndex].name}
        </p>

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        <Button
          variant="primary"
          size="lg"
          onClick={handleConfirm}
          disabled={saving}
          leftIcon="check"
        >
          {saving ? "Saving..." : "Confirm"}
        </Button>
      </div>
    </div>
  );
}

function Carousel({
  selectedIndex,
  onNavigate,
}: {
  selectedIndex: number;
  onNavigate: (dir: number) => void;
}) {
  const total = AVATARS.length;
  const leftIdx = (selectedIndex - 1 + total) % total;
  const rightIdx = (selectedIndex + 1) % total;

  return (
    <div className="relative flex items-center justify-center w-full h-72 md:h-[24rem]">
      <button
        type="button"
        onClick={() => onNavigate(-1)}
        className="absolute left-2 md:left-8 z-20 size-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors"
      >
        <Icon name="chevron_left" size={24} className="text-white" />
      </button>

      <div className="flex items-center justify-center gap-4 md:gap-8">
        <AvatarSlot avatar={AVATARS[leftIdx]} position="side" />
        <AvatarSlot avatar={AVATARS[selectedIndex]} position="center" />
        <AvatarSlot avatar={AVATARS[rightIdx]} position="side" />
      </div>

      <button
        type="button"
        onClick={() => onNavigate(1)}
        className="absolute right-2 md:right-8 z-20 size-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors"
      >
        <Icon name="chevron_right" size={24} className="text-white" />
      </button>
    </div>
  );
}

function AvatarSlot({
  avatar,
  position,
}: {
  avatar: (typeof AVATARS)[number];
  position: "center" | "side";
}) {
  const isCenter = position === "center";

  return (
    <div className={`transition-all duration-300 ease-out ${isCenter ? "scale-100" : "scale-75 opacity-50"}`}>
      <div className={isCenter ? "size-68 md:size-[22rem]" : "size-48 md:size-60"}>
        <Image
          src={getAvatarUrl(avatar.id)}
          alt={avatar.name}
          width={352}
          height={352}
          className="w-full h-full object-contain"
        />
      </div>
    </div>
  );
}
