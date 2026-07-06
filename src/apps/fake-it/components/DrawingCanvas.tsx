import { useEffect, useRef, useState } from 'react';
import type { Line, Point } from '../types';

interface DrawingCanvasProps {
  lines: Line[];
  activeColor?: string;
  canDraw: boolean;
  onDrawEnd: (points: Point[]) => void;
  className?: string;
}

export default function DrawingCanvas({
  lines,
  activeColor = '#ef4444',
  canDraw,
  onDrawEnd,
  className = '',
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);

  // Redraw when lines or currentPoints change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 5;

    const drawPath = (points: Point[], color: string) => {
      if (points.length === 0) return;
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.moveTo(points[0].x * canvas.width, points[0].y * canvas.height);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x * canvas.width, points[i].y * canvas.height);
      }
      ctx.stroke();
    };

    // Draw all completed lines
    lines.forEach((line) => {
      drawPath(line.points, line.color);
    });

    // Draw active stroke in real-time
    if (currentPoints.length > 0) {
      drawPath(currentPoints, activeColor);
    }
  }, [lines, currentPoints, activeColor]);

  const startDrawing = (clientX: number, clientY: number) => {
    if (!canDraw || !canvasRef.current) return;
    setIsDrawing(true);
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    setCurrentPoints([{ x, y }]);
  };

  const draw = (clientX: number, clientY: number) => {
    if (!isDrawing || !canDraw || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    setCurrentPoints((prev) => [...prev, { x, y }]);
  };

  const endDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentPoints.length > 0) {
      onDrawEnd(currentPoints);
    }
    setCurrentPoints([]);
  };

  return (
    <canvas
      ref={canvasRef}
      width={500}
      height={500}
      onMouseDown={(e) => startDrawing(e.clientX, e.clientY)}
      onMouseMove={(e) => draw(e.clientX, e.clientY)}
      onMouseUp={endDrawing}
      onMouseLeave={endDrawing}
      onTouchStart={(e) => {
        if (!canDraw) return;
        const touch = e.touches[0];
        startDrawing(touch.clientX, touch.clientY);
      }}
      onTouchMove={(e) => {
        if (!canDraw) return;
        const touch = e.touches[0];
        draw(touch.clientX, touch.clientY);
      }}
      onTouchEnd={(e) => {
        if (!canDraw) return;
        e.preventDefault();
        endDrawing();
      }}
      className={`bg-white touch-none select-none rounded-2xl shadow-inner border-2 border-white/10 ${className} ${
        canDraw ? 'cursor-crosshair border-brodin-accent/50' : 'cursor-not-allowed'
      }`}
    />
  );
}
