import { useState, useRef, useCallback } from 'react';

interface UseCanvasRecorderReturn {
  startRecording: () => void;
  stopRecording: () => void;
  isRecording: boolean;
  videoBlob: Blob | null;
  videoUrl: string | null;
}

export const useCanvasRecorder = (canvasRef: React.RefObject<HTMLCanvasElement>): UseCanvasRecorderReturn => {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(() => {
    if (!canvasRef.current) return;

    const stream = canvasRef.current.captureStream(30); // 30 FPS
    const options = { mimeType: 'video/webm;codecs=vp9' };
    
    // Check supported types
    let mimeType = 'video/webm';
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
      mimeType = 'video/webm;codecs=vp9';
    } else if (MediaRecorder.isTypeSupported('video/mp4')) {
      mimeType = 'video/mp4'; // Safari support
    }

    try {
        const recorder = new MediaRecorder(stream, { mimeType });
        
        chunksRef.current = [];
        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                chunksRef.current.push(e.data);
            }
        };

        recorder.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: mimeType });
            setVideoBlob(blob);
            const url = URL.createObjectURL(blob);
            setVideoUrl(url);
            chunksRef.current = [];
        };

        recorder.start();
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
    } catch (e) {
        console.error("Failed to start recording", e);
    }
  }, [canvasRef]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  return { startRecording, stopRecording, isRecording, videoBlob, videoUrl };
};
