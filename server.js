// ============================================
// VIDEO DOWNLOADER WEB APP - SERVER
// Supports: YouTube, TikTok, Facebook + AI Search
// ============================================

// Import libraries
const express = require('express');
const cors = require('cors');
const ytdl = require('@distube/ytdl-core');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Gemini AI Setup
const GEMINI_API_KEY = 'AIzaSyByyOq9Vmevsrxk8tkICU2xktz6QRtE5l8';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Multer setup for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
});

// Setup express app with cors and json middleware
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (for frontend)
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// ROUTE: Home - Serve index.html
// ============================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================
// ROUTE: AI Image Search - Find videos from image
// ============================================
app.post('/ai/search', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'Vui lòng upload một ảnh!'
            });
        }

        console.log('🤖 AI đang phân tích ảnh...');

        // Convert image to base64
        const imageBase64 = req.file.buffer.toString('base64');
        const mimeType = req.file.mimetype;

        // Use Gemini Vision to analyze image
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

        const prompt = `Phân tích ảnh screenshot video từ YouTube Shorts, TikTok, hoặc Facebook Reels.

NHIỆM VỤ: Tìm và trích xuất CHÍNH XÁC:
1. TÊN KÊNH/TÊN NGƯỜI ĐĂNG (có thể có @ hoặc không có @)
   - YouTube: thường có @username
   - TikTok: thường có @username  
   - Facebook: CHỈ CÓ TÊN, KHÔNG CÓ @ (ví dụ: "Khánh Trần Ati")
   
2. TIÊU ĐỀ VIDEO (dòng text mô tả video, thường ở dưới cùng)

Trả về JSON (CHỈ JSON, không có text khác):
{
  "username": "tên kênh chính xác như trong ảnh (có @ nếu có, không @ nếu không có)",
  "videoTitle": "tiêu đề video chính xác như trong ảnh",
  "keywords": ["tên kênh", "từ khóa từ tiêu đề"]
}

VÍ DỤ:
- YouTube: {"username": "@MienTayTiVi", "videoTitle": "Máy cày NEW!", "keywords": ["MienTayTiVi", "máy cày"]}
- Facebook: {"username": "Khánh Trần Ati", "videoTitle": "Khoan ngang Goodeng GS150-LS", "keywords": ["Khánh Trần Ati", "Goodeng GS150"]}
- TikTok: {"username": "@username", "videoTitle": "tiêu đề", "keywords": ["username", "keyword"]}`;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    mimeType: mimeType,
                    data: imageBase64
                }
            }
        ]);

        const responseText = result.response.text();
        console.log('Gemini response:', responseText);

        // Parse JSON from response
        let aiData;
        try {
            // Extract JSON from response (may be wrapped in markdown)
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                aiData = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No JSON found');
            }
        } catch (e) {
            // Fallback: use the text as description
            aiData = {
                description: responseText.substring(0, 200),
                keywords: ['video']
            };
        }

        // Search URLs for multiple platforms
        const searchQuery = aiData.keywords.join(' ');
        const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
        const tiktokSearchUrl = `https://www.tiktok.com/search?q=${encodeURIComponent(searchQuery)}`;
        const facebookSearchUrl = `https://www.facebook.com/search/videos?q=${encodeURIComponent(searchQuery)}`;

        res.json({
            success: true,
            data: {
                isScreenshot: aiData.isScreenshot || false,
                username: aiData.username || null,
                videoTitle: aiData.videoTitle || null,
                description: aiData.description,
                keywords: aiData.keywords,
                searchQuery: searchQuery,
                youtubeUrl: youtubeSearchUrl,
                tiktokUrl: tiktokSearchUrl,
                facebookUrl: facebookSearchUrl
            }
        });

    } catch (error) {
        console.error('AI Search Error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Lỗi AI: ' + error.message
        });
    }
});

// ============================================
// ROUTE: AI Image Search from URL (for Discord Bot)
// ============================================
app.post('/ai/search-url', async (req, res) => {
    try {
        const { imageUrl } = req.body;

        if (!imageUrl) {
            return res.status(400).json({
                success: false,
                error: 'Cần imageUrl!'
            });
        }

        console.log('🤖 AI đang phân tích ảnh từ URL:', imageUrl);

        // Download image from URL
        const imageResponse = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 15000
        });

        const imageBase64 = Buffer.from(imageResponse.data).toString('base64');
        const mimeType = imageResponse.headers['content-type'] || 'image/jpeg';

        // Use Gemini Vision to analyze image
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

        const prompt = `Phân tích ảnh screenshot video từ YouTube Shorts, TikTok, hoặc Facebook Reels.

NHIỆM VỤ: Tìm và trích xuất CHÍNH XÁC:
1. TÊN KÊNH/TÊN NGƯỜI ĐĂNG (có thể có @ hoặc không có @)
2. TIÊU ĐỀ VIDEO (dòng text mô tả video)

Trả về JSON (CHỈ JSON, không có text khác):
{
  "username": "tên kênh chính xác",
  "videoTitle": "tiêu đề video", 
  "keywords": ["tên kênh", "từ khóa"]
}`;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    mimeType: mimeType,
                    data: imageBase64
                }
            }
        ]);

        const responseText = result.response.text();
        console.log('Gemini response:', responseText);

        // Parse JSON from response
        let aiData;
        try {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                aiData = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No JSON found');
            }
        } catch (e) {
            aiData = { keywords: ['video'] };
        }

        res.json({
            success: true,
            username: aiData.username || null,
            videoTitle: aiData.videoTitle || null,
            keywords: aiData.keywords || ['video']
        });

    } catch (error) {
        console.error('AI Search URL Error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================
// ROUTE: YouTube Search API - Get video list with thumbnails
// ============================================
app.get('/api/youtube/search', async (req, res) => {
    try {
        const { q, maxResults = 6 } = req.query;

        if (!q) {
            return res.status(400).json({ success: false, error: 'Cần từ khóa tìm kiếm' });
        }

        console.log('🔍 Tìm kiếm YouTube:', q);

        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(q)}&maxResults=${maxResults}&key=${GEMINI_API_KEY}`;

        const response = await axios.get(searchUrl);

        if (!response.data.items) {
            throw new Error('Không tìm thấy video');
        }

        const videos = response.data.items.map(item => ({
            id: item.id.videoId,
            title: item.snippet.title,
            thumbnail: item.snippet.thumbnails.medium.url,
            channel: item.snippet.channelTitle,
            url: `https://www.youtube.com/watch?v=${item.id.videoId}`
        }));

        console.log(`✅ Tìm thấy ${videos.length} video YouTube`);

        res.json({
            success: true,
            videos: videos
        });

    } catch (error) {
        console.error('YouTube Search Error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Lỗi tìm kiếm: ' + error.message
        });
    }
});

// ============================================
// ROUTE: Download YouTube Video (using yt-dlp)
// Supports: quality selection, video/audio format
// ============================================
app.get('/download/youtube', async (req, res) => {
    try {
        const { url, quality = '720', format = 'video' } = req.query;

        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'URL is required. Please provide a YouTube video URL.'
            });
        }

        if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
            return res.status(400).json({
                success: false,
                error: 'Invalid YouTube URL. Please provide a valid YouTube video link.'
            });
        }

        const { spawn } = require('child_process');
        const fs = require('fs');
        const os = require('os');

        const tempDir = os.tmpdir();
        const isAudio = format === 'audio';
        const ext = isAudio ? 'mp3' : 'mp4';
        const tempFile = path.join(tempDir, `youtube_${Date.now()}.${ext}`);

        console.log(`Đang tải ${isAudio ? 'audio' : 'video'} từ YouTube...`);
        console.log('URL:', url);
        console.log('Quality:', quality);
        console.log('Format:', format);

        // Build yt-dlp arguments based on format
        let ytdlpArgs = [];

        if (isAudio) {
            // Audio only - extract to MP3
            ytdlpArgs = [
                '-x',  // Extract audio
                '--audio-format', 'mp3',
                '--audio-quality', quality === '320' ? '0' : quality === '256' ? '1' : quality === '192' ? '2' : '3',
                '-o', tempFile,
                '--no-playlist',
                '--no-warnings',
                url
            ];
        } else {
            // Video - sử dụng format string để đảm bảo chất lượng cao
            // Luôn ưu tiên merge bestvideo+bestaudio để có chất lượng tốt nhất
            let formatString = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best';

            if (quality === 'best') {
                // Tải chất lượng cao nhất có thể
                formatString = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best';
            } else if (quality === '1080') {
                // Ưu tiên 1080p chính xác, fallback về gần nhất
                formatString = 'bestvideo[height=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height=1080]+bestaudio/bestvideo[height<=1080][ext=mp4]+bestaudio/best[height<=1080]';
            } else if (quality === '720') {
                // Ưu tiên 720p chính xác, fallback về gần nhất
                formatString = 'bestvideo[height=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height=720]+bestaudio/bestvideo[height<=720][ext=mp4]+bestaudio/best[height<=720]';
            } else if (quality === '480') {
                formatString = 'bestvideo[height=480][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height=480]+bestaudio/bestvideo[height<=480][ext=mp4]+bestaudio/best[height<=480]';
            } else if (quality === '360') {
                formatString = 'bestvideo[height=360][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height=360]+bestaudio/bestvideo[height<=360][ext=mp4]+bestaudio/best[height<=360]';
            }

            ytdlpArgs = [
                '-f', formatString,
                '--merge-output-format', 'mp4',
                '-o', tempFile,
                '--no-playlist',
                '--no-warnings',
                '--no-check-certificate',
                url
            ];
        }

        const ytdlpProcess = spawn('yt-dlp', ytdlpArgs);

        let errorOutput = '';

        ytdlpProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
            console.log('yt-dlp:', data.toString());
        });

        ytdlpProcess.stdout.on('data', (data) => {
            console.log('yt-dlp:', data.toString());
        });

        ytdlpProcess.on('close', (code) => {
            if (code === 0 && fs.existsSync(tempFile)) {
                console.log('Tải xong! Đang gửi file...');

                const contentType = isAudio ? 'audio/mpeg' : 'video/mp4';
                const fileName = isAudio ? 'youtube_audio.mp3' : `youtube_${quality}.mp4`;

                res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
                res.setHeader('Content-Type', contentType);

                const fileStream = fs.createReadStream(tempFile);
                fileStream.pipe(res);

                fileStream.on('end', () => {
                    fs.unlink(tempFile, (err) => {
                        if (err) console.log('Không thể xóa file tạm:', err);
                        else console.log('Đã xóa file tạm');
                    });
                });

                fileStream.on('error', (err) => {
                    console.error('Lỗi stream:', err);
                    if (!res.headersSent) {
                        res.status(500).json({ success: false, error: 'Lỗi khi gửi file' });
                    }
                });
            } else {
                console.error('yt-dlp thất bại:', errorOutput);
                res.status(500).json({
                    success: false,
                    error: 'Không thể tải. ' + (errorOutput || 'Lỗi không xác định')
                });
            }
        });

        ytdlpProcess.on('error', (err) => {
            console.error('Lỗi chạy yt-dlp:', err);
            res.status(500).json({
                success: false,
                error: 'Không thể chạy yt-dlp. Hãy đảm bảo yt-dlp đã được cài đặt.'
            });
        });

    } catch (error) {
        console.error('YouTube Download Error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to download. ' + error.message
        });
    }
});

// ============================================
// ROUTE: Get YouTube Video Info (for preview)
// ============================================
app.get('/info/youtube', async (req, res) => {
    try {
        const { url } = req.query;

        if (!url || !ytdl.validateURL(url)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid YouTube URL'
            });
        }

        const info = await ytdl.getInfo(url);

        res.json({
            success: true,
            data: {
                title: info.videoDetails.title,
                thumbnail: info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1].url,
                duration: info.videoDetails.lengthSeconds,
                author: info.videoDetails.author.name,
                views: info.videoDetails.viewCount
            }
        });

    } catch (error) {
        console.error('YouTube Info Error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get video info: ' + error.message
        });
    }
});

// ============================================
// ROUTE: Download TikTok Video (using yt-dlp)
// ============================================
app.get('/download/tiktok', async (req, res) => {
    try {
        const { url, format = 'video' } = req.query;

        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'URL is required. Please provide a TikTok video URL.'
            });
        }

        // Validate TikTok URL
        if (!url.includes('tiktok.com')) {
            return res.status(400).json({
                success: false,
                error: 'Invalid TikTok URL. Please provide a valid TikTok video link.'
            });
        }

        const { spawn } = require('child_process');
        const fs = require('fs');
        const os = require('os');

        const tempDir = os.tmpdir();
        const isAudio = format === 'audio';
        const ext = isAudio ? 'mp3' : 'mp4';
        const tempFile = path.join(tempDir, `tiktok_${Date.now()}.${ext}`);

        console.log(`Đang tải ${isAudio ? 'audio' : 'video'} từ TikTok...`);
        console.log('URL:', url);

        let ytdlpArgs = [];

        if (isAudio) {
            ytdlpArgs = [
                '-x',
                '--audio-format', 'mp3',
                '-o', tempFile,
                '--no-playlist',
                '--no-warnings',
                '--no-check-certificate',
                url
            ];
        } else {
            ytdlpArgs = [
                '-f', 'best[ext=mp4]/best',
                '--merge-output-format', 'mp4',
                '-o', tempFile,
                '--no-playlist',
                '--no-warnings',
                '--no-check-certificate',
                url
            ];
        }

        const ytdlpProcess = spawn('yt-dlp', ytdlpArgs);

        let errorOutput = '';

        ytdlpProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
            console.log('yt-dlp (TikTok):', data.toString());
        });

        ytdlpProcess.stdout.on('data', (data) => {
            console.log('yt-dlp (TikTok):', data.toString());
        });

        ytdlpProcess.on('close', (code) => {
            if (code === 0 && fs.existsSync(tempFile)) {
                console.log('Tải TikTok xong!');

                const contentType = isAudio ? 'audio/mpeg' : 'video/mp4';
                const fileName = isAudio ? 'tiktok_audio.mp3' : 'tiktok_video.mp4';

                res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
                res.setHeader('Content-Type', contentType);

                const fileStream = fs.createReadStream(tempFile);
                fileStream.pipe(res);

                fileStream.on('end', () => {
                    fs.unlink(tempFile, (err) => {
                        if (err) console.log('Không thể xóa file tạm:', err);
                    });
                });

                fileStream.on('error', (err) => {
                    console.error('Lỗi stream:', err);
                    if (!res.headersSent) {
                        res.status(500).json({ success: false, error: 'Lỗi khi gửi file' });
                    }
                });
            } else {
                console.error('yt-dlp TikTok thất bại:', errorOutput);
                res.status(500).json({
                    success: false,
                    error: 'Không thể tải video TikTok.',
                    suggestion: 'Thử dùng: https://snaptik.app hoặc https://ssstik.io'
                });
            }
        });

        ytdlpProcess.on('error', (err) => {
            console.error('Lỗi chạy yt-dlp:', err);
            res.status(500).json({
                success: false,
                error: 'Không thể chạy yt-dlp.'
            });
        });

    } catch (error) {
        console.error('TikTok Download Error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to download TikTok video. ' + error.message
        });
    }
});

// ============================================
// ROUTE: Download Facebook Video (using yt-dlp)
// ============================================
app.get('/download/facebook', async (req, res) => {
    try {
        const { url, quality = '720', format = 'video' } = req.query;

        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'URL is required. Please provide a Facebook video URL.'
            });
        }

        // Validate Facebook URL
        if (!url.includes('facebook.com') && !url.includes('fb.watch') && !url.includes('fb.com')) {
            return res.status(400).json({
                success: false,
                error: 'Invalid Facebook URL. Please provide a valid Facebook video link.'
            });
        }

        const { spawn } = require('child_process');
        const fs = require('fs');
        const os = require('os');

        const tempDir = os.tmpdir();
        const isAudio = format === 'audio';
        const ext = isAudio ? 'mp3' : 'mp4';
        const tempFile = path.join(tempDir, `facebook_${Date.now()}.${ext}`);

        console.log(`Đang tải ${isAudio ? 'audio' : 'video'} từ Facebook...`);
        console.log('URL:', url);

        let ytdlpArgs = [];

        if (isAudio) {
            ytdlpArgs = [
                '-x',
                '--audio-format', 'mp3',
                '-o', tempFile,
                '--no-playlist',
                '--no-warnings',
                '--no-check-certificate',
                url
            ];
        } else {
            ytdlpArgs = [
                '-f', 'best[ext=mp4]/best',
                '--merge-output-format', 'mp4',
                '-o', tempFile,
                '--no-playlist',
                '--no-warnings',
                '--no-check-certificate',
                url
            ];
        }

        const ytdlpProcess = spawn('yt-dlp', ytdlpArgs);

        let errorOutput = '';

        ytdlpProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
            console.log('yt-dlp (FB):', data.toString());
        });

        ytdlpProcess.stdout.on('data', (data) => {
            console.log('yt-dlp (FB):', data.toString());
        });

        ytdlpProcess.on('close', (code) => {
            if (code === 0 && fs.existsSync(tempFile)) {
                console.log('Tải Facebook xong!');

                const contentType = isAudio ? 'audio/mpeg' : 'video/mp4';
                const fileName = isAudio ? 'facebook_audio.mp3' : 'facebook_video.mp4';

                res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
                res.setHeader('Content-Type', contentType);

                const fileStream = fs.createReadStream(tempFile);
                fileStream.pipe(res);

                fileStream.on('end', () => {
                    fs.unlink(tempFile, (err) => {
                        if (err) console.log('Không thể xóa file tạm:', err);
                    });
                });

                fileStream.on('error', (err) => {
                    console.error('Lỗi stream:', err);
                    if (!res.headersSent) {
                        res.status(500).json({ success: false, error: 'Lỗi khi gửi file' });
                    }
                });
            } else {
                console.error('yt-dlp Facebook thất bại:', errorOutput);
                res.status(500).json({
                    success: false,
                    error: 'Không thể tải video Facebook. Video có thể ở chế độ riêng tư.',
                    suggestion: 'Thử dùng: https://fdown.net hoặc https://getfvid.com'
                });
            }
        });

        ytdlpProcess.on('error', (err) => {
            console.error('Lỗi chạy yt-dlp:', err);
            res.status(500).json({
                success: false,
                error: 'Không thể chạy yt-dlp.'
            });
        });

    } catch (error) {
        console.error('Facebook Download Error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to download Facebook video. ' + error.message
        });
    }
});

// ============================================
// ERROR HANDLING MIDDLEWARE
// ============================================
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// ============================================
// START SERVER
// ============================================
// Start server on port 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║      🎬 VIDEO DOWNLOADER SERVER STARTED SUCCESSFULLY     ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log(`║  🌐 Server running at: http://localhost:${PORT}              ║`);
    console.log('║  📺 Supported platforms: YouTube, TikTok, Facebook       ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log('║  API Endpoints:                                           ║');
    console.log('║  • GET /download/youtube?url=<youtube_url>               ║');
    console.log('║  • GET /download/tiktok?url=<tiktok_url>                 ║');
    console.log('║  • GET /download/facebook?url=<facebook_url>             ║');
    console.log('║  • GET /info/youtube?url=<youtube_url>                   ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
});
