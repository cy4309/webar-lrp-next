"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/** 本機路徑，離線可用。WASM 檔來自 node_modules，已複製到 public/wasm/ */
const WASM_PATH = "/wasm";
const HAND_MODEL_PATH = "/models/hand_landmarker.task";

/** Hand landmark indices (MediaPipe 21 points). Fingers: index 4-7, middle 8-11, ring 12-15, pinky 16-19. */
const FINGER_TIPS = [7, 11, 15, 19]; // index, middle, ring, pinky
const FINGER_PIPS = [5, 9, 13, 17];

export type HandLandmarkerResult = {
  landmarks: Array<{ x: number; y: number; z: number }[]>;
};

export interface UseHandLandmarkerReturn {
  isReady: boolean;
  error: Error | null;
  detectForVideo: (video: HTMLVideoElement) => HandLandmarkerResult | null;
}

export function useHandLandmarker(): UseHandLandmarkerReturn {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const handLandmarkerRef = useRef<{
    detectForVideo: (
      video: HTMLVideoElement,
      timestamp: number
    ) => HandLandmarkerResult;
  } | null>(null);
  const lastVideoTimestampRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { FilesetResolver, HandLandmarker } = await import(
          "@mediapipe/tasks-vision"
        );
        const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: HAND_MODEL_PATH },
          runningMode: "VIDEO",
          numHands: 1,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        if (cancelled) return;
        handLandmarkerRef.current = handLandmarker as unknown as {
          detectForVideo: (
            video: HTMLVideoElement,
            timestamp: number
          ) => HandLandmarkerResult;
        };
        setIsReady(true);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e
              : new Error("Failed to load HandLandmarker")
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      handLandmarkerRef.current = null;
    };
  }, []);

  const detectForVideo = useCallback(
    (video: HTMLVideoElement): HandLandmarkerResult | null => {
      if (!handLandmarkerRef.current || video.readyState < 2) return null;
      try {
        const timestampMs = lastVideoTimestampRef.current + 33;
        lastVideoTimestampRef.current = timestampMs;
        return handLandmarkerRef.current.detectForVideo(video, timestampMs);
      } catch {
        return null;
      }
    },
    []
  );

  return { isReady, error, detectForVideo };
}

/**
 * Count extended fingers (index, middle, ring, pinky only) from hand landmarks.
 * In normalized coords, y increases downward; finger "up" = tip.y < pip.y.
 * Returns 0-4.
 */
export function getExtendedFingerCount(
  result: HandLandmarkerResult | null
): number {
  if (!result?.landmarks?.length) return 0;
  const hand = result.landmarks[0];
  if (!hand || hand.length < 20) return 0;

  let count = 0;
  for (let i = 0; i < FINGER_TIPS.length; i++) {
    const tip = hand[FINGER_TIPS[i]];
    const pip = hand[FINGER_PIPS[i]];
    if (tip && pip && tip.y < pip.y) count++;
  }
  return count;
}
