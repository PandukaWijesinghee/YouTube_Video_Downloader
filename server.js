const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const YTDLP_PATH = 'C:/Users/pandu/AppData/Roaming/Python/Python313/Scripts/yt-dlp.exe';
const FFMPEG_CMD = 'ffmpeg';

const app = express();
const PORT = 3000;

// Check if ffmpeg is available
spawn(FFMPEG_CMD, ['-version']).on('error', () => {
  console.warn('Warning: ffmpeg not found in PATH. yt-dlp may not be able to merge video and audio.');
});

app.use(cors());
app.use(express.static('public'));

app.get('/download', async (req, res) => {
  const videoURL = req.query.url;
  const type = req.query.type || 'video';
  const resolution = req.query.res || 'best';
  if (!videoURL) {
    return res.status(400).json({ error: 'Invalid or missing YouTube URL.' });
  }
  try {
    // Use yt-dlp to fetch video title first
    const titleProc = spawn(YTDLP_PATH, ['--get-title', videoURL]);
    let title = '';
    titleProc.stdout.on('data', (data) => {
      title += data.toString();
    });
    titleProc.stderr.on('data', (data) => {
      console.error('yt-dlp title error:', data.toString());
    });
    titleProc.on('close', (code) => {
      if (code !== 0 || !title) {
        return res.status(500).json({ error: 'Failed to fetch video title.' });
      }
      const safeTitle = title.trim().replace(/[^a-zA-Z0-9]/g, '_');
      const tempDir = os.tmpdir();
      let tempFile, formatString, filename, contentType, mergeFormat;
      if (type === 'audio') {
        tempFile = path.join(tempDir, `${safeTitle}_${Date.now()}.mp3`);
        formatString = 'bestaudio';
        filename = `${safeTitle}.mp3`;
        contentType = 'audio/mpeg';
        mergeFormat = 'mp3';
      } else {
        tempFile = path.join(tempDir, `${safeTitle}_${Date.now()}.mp4`);
        filename = `${safeTitle}.mp4`;
        contentType = 'video/mp4';
        mergeFormat = 'mp4';
        if (resolution !== 'best') {
          if (resolution === '720' || resolution === '1080') {
            formatString = `bestvideo[height<=${resolution}]+bestaudio/best[height<=${resolution}]/best`;
          } else {
            formatString = `best[height<=${resolution}][ext=mp4]/best[height<=${resolution}]/best`;
          }
        } else {
          formatString = 'best[ext=mp4]/best';
        }
      }
      let ytdlpArgs;
      if (type === 'audio') {
        ytdlpArgs = [
          '--extract-audio',
          '--audio-format', 'mp3',
          '-f', formatString,
          '-o', tempFile,
          '--socket-timeout', '30',
          videoURL
        ];
      } else {
        ytdlpArgs = [
          '-f', formatString,
          '-o', tempFile,
          '--merge-output-format', mergeFormat,
          '--socket-timeout', '30',
          videoURL
        ];
        // For video, force ffmpeg to re-encode audio to AAC for compatibility
        ytdlpArgs.splice(2, 0, '--postprocessor-args', '-c:v copy -c:a aac -b:a 192k');
      }
      const ytdlp = spawn(YTDLP_PATH, ytdlpArgs);
      ytdlp.stderr.on('data', (data) => {
        console.error('yt-dlp error:', data.toString());
      });
      ytdlp.on('close', (code) => {
        if (code !== 0 || !fs.existsSync(tempFile)) {
          fs.existsSync(tempFile) && fs.unlinkSync(tempFile);
          return res.status(500).json({ error: 'Failed to download/merge video.' });
        }
        res.header('Content-Disposition', `attachment; filename="${filename}"`);
        res.header('Content-Type', contentType);
        const readStream = fs.createReadStream(tempFile);
        readStream.pipe(res);
        readStream.on('close', () => {
          fs.existsSync(tempFile) && fs.unlinkSync(tempFile);
        });
      });
    });
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ error: 'Failed to download video.' });
  }
});

app.get('/formats', async (req, res) => {
  const videoURL = req.query.url;
  if (!videoURL) {
    return res.status(400).json({ error: 'Invalid or missing YouTube URL.' });
  }
  try {
    const formatsProc = spawn(YTDLP_PATH, ['-j', videoURL]);
    let jsonStr = '';
    formatsProc.stdout.on('data', (data) => {
      jsonStr += data.toString();
    });
    formatsProc.stderr.on('data', (data) => {
      console.error('yt-dlp formats error:', data.toString());
    });
    formatsProc.on('close', (code) => {
      if (code !== 0) {
        return res.status(500).json({ error: 'Failed to fetch video formats.' });
      }
      try {
        const info = JSON.parse(jsonStr);
        // Only send the formats array to the frontend
        res.json({ formats: info.formats });
      } catch (e) {
        console.error('JSON parse error:', e);
        res.status(500).json({ error: 'Failed to parse formats.' });
      }
    });
  } catch (err) {
    console.error('Formats fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch video formats.' });
  }
});

app.get('/title', async (req, res) => {
  const videoURL = req.query.url;
  if (!videoURL) {
    return res.status(400).json({ error: 'Invalid or missing YouTube URL.' });
  }
  try {
    const titleProc = spawn(YTDLP_PATH, ['--get-title', videoURL]);
    let title = '';
    titleProc.stdout.on('data', (data) => {
      title += data.toString();
    });
    titleProc.stderr.on('data', (data) => {
      console.error('yt-dlp title error:', data.toString());
    });
    titleProc.on('close', (code) => {
      if (code !== 0 || !title) {
        return res.status(500).json({ error: 'Failed to fetch video title.' });
      }
      res.json({ title: title.trim() });
    });
  } catch (err) {
    console.error('Title fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch video title.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
}); 