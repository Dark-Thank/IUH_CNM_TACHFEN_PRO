import { Audio } from "expo-av";
import { Pause, Play, Volume2 } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { useThemeStore } from "@/stores/useThemeStore";

const formatDuration = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

interface VoiceMessagePlayerProps {
  uri: string;
  durationSeconds?: number;
  isOwn?: boolean;
}

export default function VoiceMessagePlayer({
  uri,
  durationSeconds = 0,
  isOwn = false,
}: VoiceMessagePlayerProps) {
  const { isDark } = useThemeStore();
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [positionSeconds, setPositionSeconds] = useState(0);
  const [resolvedDurationSeconds, setResolvedDurationSeconds] = useState(durationSeconds);

  useEffect(() => {
    setResolvedDurationSeconds(durationSeconds);
  }, [durationSeconds]);

  useEffect(() => {
    return () => {
      void soundRef.current?.unloadAsync();
      soundRef.current = null;
    };
  }, []);

  const ensureSound = async () => {
    if (soundRef.current) {
      return soundRef.current;
    }

    setIsLoading(true);

    const { sound } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: false },
      (status) => {
        if (!status.isLoaded) {
          return;
        }

        setIsPlaying(status.isPlaying);
        setPositionSeconds((status.positionMillis ?? 0) / 1000);

        if (status.durationMillis) {
          setResolvedDurationSeconds(status.durationMillis / 1000);
        }

        if (status.didJustFinish) {
          setIsPlaying(false);
          setPositionSeconds(0);
        }
      }
    );

    soundRef.current = sound;
    setIsLoading(false);

    return sound;
  };

  const togglePlayback = async () => {
    try {
      const sound = await ensureSound();
      const status = await sound.getStatusAsync();

      if (!status.isLoaded) {
        return;
      }

      if (status.isPlaying) {
        await sound.pauseAsync();
        return;
      }

      if (status.didJustFinish) {
        await sound.replayAsync();
        return;
      }

      await sound.playAsync();
    } catch (error) {
      console.error("Loi khi phat audio:", error);
      setIsLoading(false);
    }
  };

  const progress = resolvedDurationSeconds > 0
    ? Math.min(1, positionSeconds / resolvedDurationSeconds)
    : 0;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isOwn
            ? "rgba(255,255,255,0.14)"
            : isDark
              ? "#111827"
              : "#f8fafc",
          borderColor: isOwn
            ? "rgba(255,255,255,0.18)"
            : isDark
              ? "#334155"
              : "#e2e8f0",
        },
      ]}
    >
      <Pressable
        onPress={() => void togglePlayback()}
        style={[
          styles.playButton,
          {
            backgroundColor: isOwn ? "rgba(255,255,255,0.18)" : isDark ? "#1f2937" : "#ede9fe",
          },
        ]}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={isOwn ? "#ffffff" : isDark ? "#e2e8f0" : "#6d28d9"} />
        ) : isPlaying ? (
          <Pause size={18} color={isOwn ? "#ffffff" : isDark ? "#f8fafc" : "#6d28d9"} />
        ) : (
          <Play size={18} color={isOwn ? "#ffffff" : isDark ? "#f8fafc" : "#6d28d9"} />
        )}
      </Pressable>

      <View style={styles.waveContainer}>
        <View
          style={[
            styles.progressTrack,
            { backgroundColor: isOwn ? "rgba(255,255,255,0.2)" : isDark ? "#1f2937" : "#e2e8f0" },
          ]}
        >
          <View
            style={[
              styles.progressFill,
              {
                width: `${progress * 100}%`,
                backgroundColor: isOwn ? "#ffffff" : isDark ? "#c084fc" : "#8b5cf6",
              },
            ]}
          />
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaLeft}>
            <Volume2 size={14} color={isOwn ? "#ffffffcc" : isDark ? "#cbd5e1" : "#64748b"} />
            <Text style={[styles.metaText, { color: isOwn ? "#ffffffcc" : isDark ? "#cbd5e1" : "#64748b" }]}>
              Tin nhắn thoại
            </Text>
          </View>

          <Text style={[styles.metaText, { color: isOwn ? "#ffffffcc" : isDark ? "#cbd5e1" : "#64748b" }]}>
            {formatDuration(resolvedDurationSeconds || durationSeconds)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 220,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  waveContainer: {
    flex: 1,
    gap: 8,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  metaLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },
  metaText: {
    fontSize: 12,
    fontWeight: "500",
  },
});