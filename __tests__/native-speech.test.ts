import { captureNativeSpeech, nativeSpeechAvailable } from '../lib/native-speech';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';

jest.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'android' } }));
jest.mock('@capacitor-community/speech-recognition', () => ({
  SpeechRecognition: { available: jest.fn(), requestPermissions: jest.fn(), start: jest.fn(), stop: jest.fn() },
}));
const speech = SpeechRecognition as jest.Mocked<typeof SpeechRecognition>;
beforeEach(() => jest.clearAllMocks());

it('does not start recording when microphone permission is denied', async () => {
  speech.requestPermissions.mockResolvedValue({ speechRecognition: 'denied' });
  await expect(captureNativeSpeech()).rejects.toThrow('Microphone permission');
  expect(speech.start).not.toHaveBeenCalled();
});
it('returns a Hindi native recognition result for draft review', async () => {
  speech.requestPermissions.mockResolvedValue({ speechRecognition: 'granted' });
  speech.start.mockResolvedValue({ matches: ['दो पेंसिल'] });
  await expect(captureNativeSpeech()).resolves.toBe('दो पेंसिल');
  expect(speech.start).toHaveBeenCalledWith(expect.objectContaining({ language: 'hi-IN', popup: true, partialResults: false }));
});
it('keeps manual entry available when the recognition service is missing', async () => {
  speech.available.mockRejectedValue(new Error('Unavailable'));
  await expect(nativeSpeechAvailable()).resolves.toBe(false);
});
