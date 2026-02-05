"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useWebcam } from './useWebcam';
import { useCanvasRecorder } from '../../hooks/useCanvasRecorder';
import { useHandLandmarker, getExtendedFingerCount } from '../../hooks/useHandLandmarker';

type GameState = 'IDLE' | 'AWAITING_POSE' | 'COUNTDOWN' | 'POSE' | 'CAPTURING' | 'FINISHED';

const POSE_DURATION = 1000; // Time in ms to hold the "Flash" or capture moment? No, maybe just countdown.
const COUNTDOWN_START = 3;
const TOTAL_POSES = 4;
/** How long (ms) pose must be detected before starting countdown. */
const POSE_GATE_STABLE_MS = 1000;

export default function GameEngine() {
  // --- Refs & Hooks ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { videoRef, isReady: webcamReady } = useWebcam({ width: 720, height: 1280 });
  const { startRecording, stopRecording, videoUrl, isRecording } = useCanvasRecorder(canvasRef);
  const { isReady: handReady, detectForVideo: detectHand } = useHandLandmarker();
  
  // --- State ---
  const [gameState, setGameState] = useState<GameState>('IDLE');
  const [poseIndex, setPoseIndex] = useState(0); // 0 to 3
  const [countdown, setCountdown] = useState(COUNTDOWN_START);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [finalCompositeImage, setFinalCompositeImage] = useState<string | null>(null);

  // --- Mutable Game State (for loop) ---
  // Using refs for values that change inside the animation loop to avoid dependency hell
  const gameStateRef = useRef<GameState>('IDLE');
  const poseIndexRef = useRef(0);
  const countdownRef = useRef(COUNTDOWN_START);
  const lastTickRef = useRef(0);
  /** When pose gate became satisfied (ms). Used to require stable pose before countdown. */
  const poseGateSatisfiedSinceRef = useRef<number | null>(null);
  /** Throttle pose detection (run every N ms). */
  const lastPoseCheckRef = useRef(0);
  
  // Update refs when state changes (for UI mostly)
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { poseIndexRef.current = poseIndex; }, [poseIndex]);

  // --- Helpers ---
  const drawText = (ctx: CanvasRenderingContext2D, text: string, y: number, color = 'white', fontSize = 60) => {
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 4;
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.strokeText(text, ctx.canvas.width / 2, y);
    ctx.fillText(text, ctx.canvas.width / 2, y);
    ctx.restore();
  };

  const captureFrame = useCallback(() => {
    if (!canvasRef.current || !videoRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // We want to capture the frame WITHOUT the countdown text, but WITH the overlay design.
    // For simplicity now, we just crop the current video feed + overlay.
    // Ideally we would do an offscreen render here to ensure it's clean.
    
    // Create a temp canvas to capture clean frame
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvasRef.current.width;
    tempCanvas.height = canvasRef.current.height;
    const tCtx = tempCanvas.getContext('2d');
    if (tCtx) {
        // Draw Video
        const vid = videoRef.current;
        // Aspect ratio cover logic
        // Simple draw for now:
        tCtx.drawImage(vid, 0, 0, tempCanvas.width, tempCanvas.height);
        
        // Draw Design Overlay (Placeholder: Rectangle with color)
        tCtx.save();
        tCtx.strokeStyle = getPoseColor(poseIndexRef.current);
        tCtx.lineWidth = 20;
        tCtx.strokeRect(0, 0, tempCanvas.width, tempCanvas.height);
        
        // Draw Pose Label
        tCtx.font = "bold 40px sans-serif";
        tCtx.fillStyle = "white";
        tCtx.fillText(`Pose ${poseIndexRef.current + 1}`, 50, tempCanvas.height - 50);
        tCtx.restore();

        const dataUrl = tempCanvas.toDataURL('image/png');
        setCapturedImages(prev => [...prev, dataUrl]);
    }
  }, [videoRef]);

  const generateComposite = async (images: string[]) => {
    if (images.length < 4) return;
    
    const w = 720;
    const h = 1280;
    const canvas = document.createElement('canvas');
    canvas.width = w * 2;
    canvas.height = h * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw 4 images in a grid
    // 0 | 1
    // -----
    // 2 | 3
    
    const loadImg = (src: string) => new Promise<HTMLImageElement>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = src;
    });

    try {
        const imgs = await Promise.all(images.map(loadImg));
        
        ctx.drawImage(imgs[0], 0, 0, w, h);
        ctx.drawImage(imgs[1], w, 0, w, h);
        ctx.drawImage(imgs[2], 0, h, w, h);
        ctx.drawImage(imgs[3], w, h, w, h);
        
        // Add Branding / Center Overlay
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(0, 0, canvas.width, canvas.height); // bright film
        
        ctx.save();
        ctx.translate(canvas.width/2, canvas.height/2);
        ctx.rotate(-Math.PI / 4);
        ctx.font = "bold 150px sans-serif";
        ctx.fillStyle = "rgba(255,0,0,0.5)";
        ctx.textAlign = "center";
        ctx.fillText("LA ROCHE-POSAY", 0, 0);
        ctx.restore();

        setFinalCompositeImage(canvas.toDataURL('image/jpeg', 0.9));
    } catch (e) {
        console.error("Composite generation failed", e);
    }
  };

  const getPoseColor = (index: number) => {
      const colors = ['#ff0055', '#33ddff', '#55ff00', '#ffaa00'];
      return colors[index % colors.length];
  };

  // --- Game Loop ---
  const loop = useCallback((timestamp: number) => {
    if (!canvasRef.current || !videoRef.current) {
        requestAnimationFrame(loop);
        return;
    }
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    
    const w = canvasRef.current.width;
    const h = canvasRef.current.height;

    // 1. Clear & Draw Video
    ctx.clearRect(0, 0, w, h);
    if (webcamReady) {
       // Maintain aspect ratio cover (simplified)
       ctx.drawImage(videoRef.current, 0, 0, w, h);
    }

    // 2. Draw Game Elements based on State
    const state = gameStateRef.current;

    if (state === 'AWAITING_POSE') {
      const now = Date.now();
      const requiredFingers = poseIndexRef.current + 1; // Pose 1 → 1 finger, Pose 2 → 2 fingers, ...
      if (handReady && videoRef.current && now - lastPoseCheckRef.current > 100) {
        lastPoseCheckRef.current = now;
        const result = detectHand(videoRef.current);
        const count = getExtendedFingerCount(result);
        if (count === requiredFingers) {
          if (poseGateSatisfiedSinceRef.current === null) {
            poseGateSatisfiedSinceRef.current = now;
          } else if (now - poseGateSatisfiedSinceRef.current >= POSE_GATE_STABLE_MS) {
            gameStateRef.current = 'COUNTDOWN';
            setGameState('COUNTDOWN');
            countdownRef.current = COUNTDOWN_START;
            setCountdown(COUNTDOWN_START);
            lastTickRef.current = now;
          }
        } else {
          poseGateSatisfiedSinceRef.current = null;
        }
      }
      ctx.save();
      ctx.strokeStyle = getPoseColor(poseIndexRef.current);
      ctx.lineWidth = 10;
      ctx.strokeRect(20, 20, w - 40, h - 40);
      drawText(ctx, `Pose ${poseIndexRef.current + 1}`, h - 140, 'white', 40);
      drawText(
        ctx,
        handReady ? `Show ${requiredFingers} finger${requiredFingers > 1 ? 's' : ''}` : 'Loading hand detection...',
        h - 80,
        'white',
        36
      );
      if (poseGateSatisfiedSinceRef.current !== null) {
        const remaining = Math.ceil((POSE_GATE_STABLE_MS - (now - poseGateSatisfiedSinceRef.current)) / 1000);
        drawText(ctx, remaining > 0 ? `${remaining}...` : 'Get ready!', h / 2, '#88ff88', 120);
      }
      ctx.restore();
    } else if (state === 'COUNTDOWN') {
        const now = Date.now();
        // Check timer logic
        if (now - lastTickRef.current > 1000) {
            countdownRef.current -= 1;
            setCountdown(countdownRef.current);
            lastTickRef.current = now;
            
            if (countdownRef.current <= 0) {
                // Trigger Capture
                gameStateRef.current = 'CAPTURING';
                setGameState('CAPTURING');
                captureFrame();
                
                // Next: either another AWAITING_POSE (gate for next gesture) or FINISHED
                setTimeout(() => {
                    const nextPose = poseIndexRef.current + 1;
                    if (nextPose >= TOTAL_POSES) {
                         gameStateRef.current = 'FINISHED';
                         setGameState('FINISHED');
                    } else {
                        poseIndexRef.current = nextPose;
                        setPoseIndex(nextPose);
                        gameStateRef.current = 'AWAITING_POSE';
                        setGameState('AWAITING_POSE');
                        poseGateSatisfiedSinceRef.current = null;
                        lastPoseCheckRef.current = 0;
                    }
                }, 500);
            }
        }
        
        // Draw Overlay Frame (Preview)
        ctx.save();
        ctx.strokeStyle = getPoseColor(poseIndexRef.current);
        ctx.lineWidth = 10;
        ctx.strokeRect(20, 20, w-40, h-40);
        
        // Draw Text
        drawText(ctx, `Pose ${poseIndexRef.current + 1}`, h - 100);
        
        // Draw Countdown Big
        if (countdownRef.current > 0) {
            drawText(ctx, countdownRef.current.toString(), h/2, 'white', 200);
        }
        ctx.restore();

    } else if (state === 'CAPTURING') {
        // Flash Effect
        ctx.save();
        ctx.fillStyle = 'white';
        ctx.globalAlpha = 0.8;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
    } else if (state === 'FINISHED') {
        drawText(ctx, "FINISHED!", h/2);
    }

    // Loop
    if (state !== 'FINISHED' && state !== 'IDLE') {
        requestAnimationFrame(loop);
    }
  }, [webcamReady, captureFrame, handReady, detectHand]);

  // --- Effect: Start Game logic helper ---
  const startGame = () => {
      setCapturedImages([]);
      setPoseIndex(0);
      setCountdown(COUNTDOWN_START);
      setGameState('AWAITING_POSE');
      startRecording();

      // Init refs
      poseIndexRef.current = 0;
      countdownRef.current = COUNTDOWN_START;
      lastTickRef.current = Date.now();
      gameStateRef.current = 'AWAITING_POSE';
      poseGateSatisfiedSinceRef.current = null;
      lastPoseCheckRef.current = 0;

      requestAnimationFrame(loop);
  };

  useEffect(() => {
      if (gameState === 'FINISHED') {
          stopRecording();
          // Generate result
          generateComposite(capturedImages);
      }
  }, [gameState, stopRecording, capturedImages]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
      
      {gameState === 'IDLE' && (
        <div className="z-10 text-center">
          <h1 className="text-4xl font-bold mb-8 text-blue-400">La Roche-Posay Photo Booth</h1>
          {webcamReady ? (
             <button 
                onClick={startGame}
                className="px-8 py-4 bg-white text-black font-bold rounded-full text-xl hover:bg-gray-200 transition-all transform hover:scale-105"
             >
                START GAME
             </button>
          ) : (
             <div className="text-gray-400">Loading Camera...</div>
          )}
        </div>
      )}

      {/* Main Game Container */}
      <div className={`relative ${gameState === 'FINISHED' ? 'hidden' : 'block'}`}>
         <canvas 
            ref={canvasRef} 
            width={720} 
            height={1280}
            className="w-full max-w-[400px] border-4 border-gray-800 rounded-lg shadow-2xl bg-gray-900"
         />
         {!webcamReady && <div className="absolute inset-0 flex items-center justify-center text-white">Camera not ready</div>}
      </div>

      {gameState === 'FINISHED' && (
          <div className="flex flex-col items-center gap-8 w-full max-w-4xl animate-fade-in">
              <h2 className="text-3xl font-bold text-green-400">Great Shot!</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
                  {/* Result 1: Composite Image */}
                  <div className="bg-gray-800 p-4 rounded-xl flex flex-col items-center">
                     <h3 className="mb-4 text-xl">Your Photo Strip</h3>
                     {finalCompositeImage ? (
                         <img src={finalCompositeImage} alt="Result" className="w-full rounded-lg shadow-lg" />
                     ) : (
                         <div className="w-full h-64 flex items-center justify-center">Generating...</div>
                     )}
                     {finalCompositeImage && (
                        <a 
                            href={finalCompositeImage} 
                            download="laroche-photo.jpg"
                            className="mt-4 px-6 py-2 bg-blue-600 rounded-full hover:bg-blue-500"
                        >
                            Download Photo
                        </a>
                     )}
                  </div>

                  {/* Result 2: Video */}
                  <div className="bg-gray-800 p-4 rounded-xl flex flex-col items-center">
                      <h3 className="mb-4 text-xl">Gameplay Video</h3>
                      {videoUrl ? (
                          <video src={videoUrl} controls className="w-full rounded-lg shadow-lg" />
                      ) : (
                          <div className="w-full h-64 flex items-center justify-center">Processing Video...</div>
                      )}
                      {videoUrl && (
                        <a 
                             href={videoUrl} 
                             download="laroche-gameplay.webm"
                             className="mt-4 px-6 py-2 bg-purple-600 rounded-full hover:bg-purple-500"
                        >
                            Download Video
                        </a>
                      )}
                  </div>
              </div>
              
              <button 
                onClick={() => setGameState('IDLE')}
                className="mt-8 text-gray-400 underline hover:text-white"
              >
                  Play Again
              </button>
          </div>
      )}
    </div>
  );
}
