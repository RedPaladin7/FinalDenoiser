// src/app/page.tsx
import AudioRecorder from '@/components/AudioRecorder';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <AudioRecorder />
    </main>
  );
}