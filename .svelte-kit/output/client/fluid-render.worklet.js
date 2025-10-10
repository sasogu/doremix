class FluidRenderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.queue = [];
    this.current = null;
    this.offset = 0;
    this.maxQueueLength = 32;

    this.port.onmessage = (event) => {
      const data = event.data || {};
      if (data.type === 'audio') {
        const left = data.left ? new Float32Array(data.left) : null;
        const right = data.right ? new Float32Array(data.right) : null;
        if (!left || !right) return;
        if (left.length !== right.length) return;
        if (left.length === 0) return;
        if (this.queue.length < this.maxQueueLength) {
          this.queue.push({ left, right });
        }
      } else if (data.type === 'flush') {
        this.queue.length = 0;
        this.current = null;
        this.offset = 0;
      }
    };
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    const leftOut = output[0];
    const rightOut = output.length > 1 ? output[1] : output[0];

    let written = 0;
    const blockSize = leftOut.length;

    while (written < blockSize) {
      if (!this.current) {
        this.current = this.queue.shift() || null;
        this.offset = 0;
        if (!this.current) {
          // no data: fill remainder with silence and exit
          leftOut.fill(0, written);
          rightOut.fill(0, written);
          break;
        }
      }
      const currentLeft = this.current.left;
      const currentRight = this.current.right;
      const remainingInBuffer = currentLeft.length - this.offset;
      const remainingInBlock = blockSize - written;
      const copyCount = Math.min(remainingInBuffer, remainingInBlock);

      leftOut.set(
        currentLeft.subarray(this.offset, this.offset + copyCount),
        written
      );
      rightOut.set(
        currentRight.subarray(this.offset, this.offset + copyCount),
        written
      );

      written += copyCount;
      this.offset += copyCount;
      if (this.offset >= currentLeft.length) {
        this.current = null;
      }
    }

    if (this.queue.length < 4) {
      this.port.postMessage({
        type: 'need-audio',
        pending: this.queue.length
      });
    }

    return true;
  }
}

registerProcessor('fluid-renderer', FluidRenderProcessor);

