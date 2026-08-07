import net from 'net';
import { Readable } from 'stream';

export interface ClamAVScanOptions {
  host?: string;
  port?: number;
  timeoutMs?: number;
}

export interface ClamAVScanResult {
  status: 'clean' | 'infected' | 'unavailable' | 'error';
  virus?: string | null;
  message?: string;
}

/**
 * Sends a Buffer or Stream to ClamAV clamd daemon over TCP using the INSTREAM protocol.
 */
export async function scanStreamWithClamAV(
  stream: Readable,
  options: ClamAVScanOptions = {},
): Promise<ClamAVScanResult> {
  const host = options.host || process.env.CLAMAV_HOST || '127.0.0.1';
  const port = options.port || Number(process.env.CLAMAV_PORT || 3310);
  const timeoutMs = options.timeoutMs || Number(process.env.CLAMAV_TIMEOUT_MS || 10000);

  return new Promise((resolve) => {
    let resolved = false;

    const safeResolve = (res: ClamAVScanResult) => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve(res);
      }
    };

    const socket = net.createConnection({ host, port }, () => {
      // Send INSTREAM command header
      socket.write('nINSTREAM\n');

      stream.on('data', (chunk: Buffer | string) => {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        if (buf.length === 0) return;

        // 4-byte big endian length header
        const lenBuf = Buffer.alloc(4);
        lenBuf.writeUInt32BE(buf.length, 0);

        socket.write(lenBuf);
        socket.write(buf);
      });

      stream.on('end', () => {
        // Send zero-length chunk to signal end of stream
        const zeroBuf = Buffer.alloc(4);
        zeroBuf.writeUInt32BE(0, 0);
        socket.write(zeroBuf);
      });

      stream.on('error', (err) => {
        safeResolve({ status: 'error', message: `Stream error: ${err.message}` });
      });
    });

    socket.setTimeout(timeoutMs);

    let responseText = '';
    socket.on('data', (data) => {
      responseText += data.toString('utf-8');
    });

    socket.on('end', () => {
      const trimmed = responseText.trim();
      if (trimmed.includes('FOUND')) {
        const match = trimmed.match(/stream:\s*(.+)\s+FOUND/i) || trimmed.match(/:\s*(.+)\s+FOUND/i);
        const virusName = match ? match[1].trim() : 'Malware Detected';
        safeResolve({ status: 'infected', virus: virusName, message: trimmed });
      } else if (trimmed.includes('OK')) {
        safeResolve({ status: 'clean', virus: null, message: trimmed });
      } else {
        safeResolve({ status: 'error', message: trimmed || 'Unrecognized response from ClamAV' });
      }
    });

    socket.on('timeout', () => {
      safeResolve({ status: 'unavailable', message: `ClamAV scan timed out after ${timeoutMs}ms` });
    });

    socket.on('error', (err) => {
      safeResolve({ status: 'unavailable', message: `ClamAV connection failed (${host}:${port}): ${err.message}` });
    });
  });
}

export async function scanBufferWithClamAV(
  buffer: Buffer,
  options: ClamAVScanOptions = {},
): Promise<ClamAVScanResult> {
  const stream = Readable.from(buffer);
  return scanStreamWithClamAV(stream, options);
}
