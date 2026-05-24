import fs from 'fs';
import path from 'path';

export const SPEECH_TEMP_DIR = '/tmp/rakkyo-speech';

export class SpeechFileSweeper {
  private intervalId: NodeJS.Timeout | null = null;
  private isSweeping = false;

  /**
   * Start the 3-second periodic background sweeping timer
   */
  start() {
    // Ensure the temp directory exists
    if (!fs.existsSync(SPEECH_TEMP_DIR)) {
      fs.mkdirSync(SPEECH_TEMP_DIR, { recursive: true });
    }

    if (this.intervalId) return;

    this.intervalId = setInterval(() => {
      this.sweep().catch(err => {
        console.error('Background speech file sweep error:', err);
      });
    }, 3000);
  }

  /**
   * Stop the background sweeping timer (avoids hanging Jest handles)
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Sweeps /tmp/rakkyo-speech and unlinks any file older than 7 seconds
   */
  async sweep() {
    if (this.isSweeping) return;
    this.isSweeping = true;

    try {
      if (!fs.existsSync(SPEECH_TEMP_DIR)) {
        this.isSweeping = false;
        return;
      }

      const files = await fs.promises.readdir(SPEECH_TEMP_DIR);
      const now = Date.now();

      await Promise.all(
        files.map(async (file) => {
          const filePath = path.join(SPEECH_TEMP_DIR, file);
          try {
            const stats = await fs.promises.stat(filePath);
            const ageMs = now - stats.mtimeMs;
            
            // Forcefully delete if the file is older than 7 seconds (7000ms)
            if (ageMs > 7000) {
              await fs.promises.unlink(filePath);
              console.info(`[SpeechFileSweeper] Forcefully purged stale speech audio file: ${filePath}`);
            }
          } catch (e: any) {
            // Handle cases where the file was unlinked concurrently by the request's own sync/error unlinks
            if (e.code !== 'ENOENT') {
              console.error(`[SpeechFileSweeper] Failed to process/unlink file ${filePath}:`, e);
            }
          }
        })
      );
    } catch (err) {
      console.error('[SpeechFileSweeper] Sweep error during directory reading:', err);
    } finally {
      this.isSweeping = false;
    }
  }
}

export const speechFileSweeper = new SpeechFileSweeper();
