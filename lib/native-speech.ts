import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';

export const isNativeAndroid = () => Capacitor.getPlatform() === 'android';

export async function nativeSpeechAvailable(): Promise<boolean> {
  try { return (await SpeechRecognition.available()).available; }
  catch { return false; }
}

export async function captureNativeSpeech(): Promise<string> {
  const permission = await SpeechRecognition.requestPermissions();
  if (permission.speechRecognition !== 'granted') {
    throw new Error('Microphone permission is needed for voice entry. You can still type the order.');
  }
  const result = await SpeechRecognition.start({
    language: 'hi-IN', maxResults: 1, popup: true, partialResults: false,
    prompt: 'बिके हुए सामान और संख्या बोलिए',
  });
  return result.matches?.[0] || '';
}

export async function stopNativeSpeech(): Promise<void> {
  await SpeechRecognition.stop();
}
