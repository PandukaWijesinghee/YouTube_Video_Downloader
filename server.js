const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs');

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
      if (type === 'audio') {
        res.header('Content-Disposition', `attachment; filename="${safeTitle}.mp3"`);
        res.header('Content-Type', 'audio/mpeg');
        const ytdlp = spawn(YTDLP_PATH, ['-f', 'bestaudio', '--extract-audio', '--audio-format', 'mp3', '-o', '-', videoURL]);
        ytdlp.stdout.pipe(res);
        ytdlp.stderr.on('data', (data) => {
          console.error('yt-dlp error:', data.toString());
        });
        ytdlp.on('close', (code) => {
          if (code !== 0) {
            console.error('yt-dlp exited with code', code);
          }
        });
      } else {
        let formatString = 'best[ext=mp4]/best';
        let filename = `${safeTitle}.mp4`;
        let contentType = 'video/mp4';
        if (resolution !== 'best') {
          // For high resolutions, allow merging of separate video and audio streams
          if (resolution === '720' || resolution === '1080') {
            formatString = `bestvideo[height<=${resolution}]+bestaudio/best[height<=${resolution}]/best`;
          } else {
            // For lower resolutions, use pre-merged streams when available
            formatString = `best[height<=${resolution}][ext=mp4]/best[height<=${resolution}]/best`;
          }
        }
        res.header('Content-Disposition', `attachment; filename="${filename}"`);
        res.header('Content-Type', contentType);
        const ytdlp = spawn(YTDLP_PATH, ['-f', formatString, '-o', '-', videoURL]);
        ytdlp.stdout.pipe(res);
        ytdlp.stderr.on('data', (data) => {
          console.error('yt-dlp error:', data.toString());
        });
        ytdlp.on('close', (code) => {
          if (code !== 0) {
            console.error('yt-dlp exited with code', code);
          }
        });
      }
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
    const formatsProc = spawn(YTDLP_PATH, ['-F', videoURL]);
    let formats = '';
    formatsProc.stdout.on('data', (data) => {
      formats += data.toString();
    });
    formatsProc.stderr.on('data', (data) => {
      console.error('yt-dlp formats error:', data.toString());
    });
    formatsProc.on('close', (code) => {
      if (code !== 0) {
        return res.status(500).json({ error: 'Failed to fetch video formats.' });
      }
      res.json({ formats: formats });
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