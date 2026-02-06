"use client";

import { useEffect, useState } from "react";

/** 關卡 overlay 圖路徑（專案 public 底下） */
const LEVEL_IMAGE_PATHS = [
  "/images/level-1.png",
  "/images/level-2.png",
  "/images/level-3.png",
  "/images/level-4.png",
] as const;

export type GameAssets = {
  overlay1: HTMLImageElement | null;
  overlay2: HTMLImageElement | null;
  overlay3: HTMLImageElement | null;
  overlay4: HTMLImageElement | null;
  logo: HTMLImageElement | null;
};

export const useGameAssets = () => {
  const [assets, setAssets] = useState<GameAssets>({
    overlay1: null,
    overlay2: null,
    overlay3: null,
    overlay4: null,
    logo: null,
  });
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let loaded = 0;
    const imgs: (HTMLImageElement | null)[] = [null, null, null, null];

    const tryFinish = () => {
      loaded++;
      if (loaded === 4) {
        setAssets({
          overlay1: imgs[0],
          overlay2: imgs[1],
          overlay3: imgs[2],
          overlay4: imgs[3],
          logo: null,
        });
        setIsReady(true);
      }
    };

    LEVEL_IMAGE_PATHS.forEach((src, i) => {
      const img = new Image();
      img.onload = () => {
        imgs[i] = img;
        tryFinish();
      };
      img.onerror = () => tryFinish();
      img.src = src;
    });
  }, []);

  return { assets, isReady };
};
