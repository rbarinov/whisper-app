export class AudioRecorderRenderer {
  private audioContext: AudioContext | null = null;

  private workletNode: AudioWorkletNode | null = null;

  private mediaStream: MediaStream | null = null;

  private sourceNode: MediaStreamAudioSourceNode | null = null;

  private chunks: Float32Array[] = [];

  private sampleRate = 0;

  async startRecording(): Promise<void> {
    if (this.audioContext) {
      throw new Error('Recording already in progress');
    }

    this.chunks = [];

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });

    this.audioContext = new AudioContext();
    this.sampleRate = this.audioContext.sampleRate;

    const workletUrl = new URL('./audio-worklet-processor.js', window.location.href);
    await this.audioContext.audioWorklet.addModule(workletUrl.toString());

    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-processor');

    this.workletNode.port.onmessage = (event: MessageEvent<{ samples?: Float32Array }>) => {
      const samples = event.data?.samples;
      if (!(samples instanceof Float32Array) || samples.length === 0) {
        return;
      }

      const copy = new Float32Array(samples.length);
      copy.set(samples);
      this.chunks.push(copy);
    };

    this.sourceNode.connect(this.workletNode);
    this.workletNode.connect(this.audioContext.destination);
  }

  stopRecording(): Float32Array {
    const totalSamples = this.chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Float32Array(totalSamples);

    let offset = 0;
    for (const chunk of this.chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    this.workletNode?.disconnect();
    this.sourceNode?.disconnect();

    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        track.stop();
      }
    }

    void this.audioContext?.close();

    this.workletNode = null;
    this.sourceNode = null;
    this.mediaStream = null;
    this.audioContext = null;

    this.chunks = [];

    return result;
  }

  getSampleRate(): number {
    return this.sampleRate;
  }
}
