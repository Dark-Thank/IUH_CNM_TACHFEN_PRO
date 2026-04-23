import { Audio } from "expo-av";
import { useEffect, useRef } from "react";

import { useCallStore } from "@/stores/useCallStore";

const RINGTONE_SOURCE = require("../../../assets/incoming-call-ringtone.mp3");

export default function CallRingtonePlayer() {
  const currentCall = useCallStore((state) => state.currentCall);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    return () => {
      void soundRef.current?.unloadAsync().catch(() => undefined);
      soundRef.current = null;
    };
  }, []);

  useEffect(() => {
    const shouldPlayRingtone =
      currentCall?.status === "incoming" || currentCall?.status === "outgoing-ringing";

    let isCancelled = false;

    const syncRingtone = async () => {
      if (!shouldPlayRingtone) {
        if (soundRef.current) {
          await soundRef.current.stopAsync().catch(() => undefined);
          await soundRef.current.unloadAsync().catch(() => undefined);
          soundRef.current = null;
        }

        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      }).catch(() => undefined);

      if (!soundRef.current) {
        const { sound } = await Audio.Sound.createAsync(RINGTONE_SOURCE, {
          shouldPlay: false,
          isLooping: true,
          volume: 1,
        });

        if (isCancelled) {
          await sound.unloadAsync().catch(() => undefined);
          return;
        }

        soundRef.current = sound;
      }

      if (!soundRef.current) {
        return;
      }

      await soundRef.current.setPositionAsync(0).catch(() => undefined);
      await soundRef.current.playAsync().catch(() => undefined);
    };

    void syncRingtone();

    return () => {
      isCancelled = true;
    };
  }, [currentCall?.callId, currentCall?.status]);

  return null;
}