class PCMProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input[0]) {
      this.port.postMessage({ samples: input[0] });
    }
    return true;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
