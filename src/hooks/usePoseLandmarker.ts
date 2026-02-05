"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/** 本機路徑，離線可用。WASM 檔來自 node_modules，已複製到 public/wasm/ */
const WASM_PATH = "/wasm";
const MODEL_PATH = "/models/hand_landmarker.task";

/** Minimum visibility for key landmarks to consider pose "in frame" (gate pass). */
const MIN_VISIBILITY = 0.6;

export type PoseLandmarkerResult = {
  landmarks: Array<{ x: number; y: number; z: number; visibility?: number }[]>;
};

export interface UsePoseLandmarkerReturn {
  isReady: boolean;
  error: Error | null;
  /** Call with video element only. Timestamp is managed internally (strictly increasing for MediaPipe VIDEO mode). */
  detectForVideo: (video: HTMLVideoElement) => PoseLandmarkerResult | null;
}

export function usePoseLandmarker(): UsePoseLandmarkerReturn {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const poseLandmarkerRef = useRef<{
    detectForVideo: (
      video: HTMLVideoElement,
      timestamp: number,
    ) => PoseLandmarkerResult;
  } | null>(null);
  /** MediaPipe VIDEO mode requires strictly monotonically increasing timestamps. We use a counter (ms-like). */
  const lastVideoTimestampRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { FilesetResolver, PoseLandmarker } =
          await import("@mediapipe/tasks-vision");
        const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
        const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_PATH },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        if (cancelled) return;
        poseLandmarkerRef.current = poseLandmarker as unknown as {
          detectForVideo: (
            video: HTMLVideoElement,
            timestamp: number,
          ) => PoseLandmarkerResult;
        };
        setIsReady(true);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e : new Error("Failed to load PoseLandmarker"),
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      poseLandmarkerRef.current = null;
    };
  }, []);

  const detectForVideo = useCallback(
    (video: HTMLVideoElement): PoseLandmarkerResult | null => {
      if (!poseLandmarkerRef.current || video.readyState < 2) return null;
      try {
        // VIDEO mode requires strictly monotonically increasing timestamps (no same or lower).
        const timestampMs = lastVideoTimestampRef.current + 33;
        lastVideoTimestampRef.current = timestampMs;
        const result = poseLandmarkerRef.current.detectForVideo(
          video,
          timestampMs,
        ) as PoseLandmarkerResult;
        return result;
      } catch {
        return null;
      }
    },
    [],
  );

  return { isReady, error, detectForVideo };
}

/** Returns true if the pose result has at least one pose with key landmarks visible (gate pass). */
export function isPoseGoodEnough(result: PoseLandmarkerResult | null): boolean {
  if (!result?.landmarks?.length) return false;
  const pose = result.landmarks[0];
  if (!pose?.length) return false;
  const hasVisibility = (l: { visibility?: number } | undefined) =>
    (l?.visibility ?? 0) >= MIN_VISIBILITY;
  // Require nose (0), left shoulder (11), right shoulder (12) to be visible
  const nose = pose[0];
  const leftShoulder = pose[11];
  const rightShoulder = pose[12];
  return (
    hasVisibility(nose) &&
    hasVisibility(leftShoulder) &&
    hasVisibility(rightShoulder)
  );
}
