import { useState, useEffect, useRef } from 'react';

interface UseWebcamOptions {
  width?: number;
  height?: number;
  facingMode?: 'user' | 'environment';
}

export const useWebcam = (options: UseWebcamOptions = {}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const startWebcam = async () => {
      try {
        // Create video element in memory if it doesn't exist
        if (!videoRef.current) {
          const video = document.createElement('video');
          video.autoplay = true;
          video.muted = true;
          video.playsInline = true;
          videoRef.current = video;
        }

        const constraints: MediaStreamConstraints = {
          video: {
            width: { ideal: options.width || 1280 },
            height: { ideal: options.height || 720 },
            facingMode: options.facingMode || 'user',
          },
          audio: false,
        };

        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        setStream(mediaStream);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.onloadedmetadata = () => {
            if (videoRef.current) {
                videoRef.current.play();
                setIsReady(true);
            }
          };
        }
      } catch (err) {
        console.error("Error accessing webcam:", err);
        setError(err instanceof Error ? err : new Error('Failed to access webcam'));
      }
    };

    startWebcam();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [options.width, options.height, options.facingMode]);

  return { videoRef, stream, error, isReady };
};
