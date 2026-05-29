export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    try {
        const { content, date, time, email } = req.body;

        if (!content || !email) {
            return res.status(400).json({ error: 'Faltan datos requeridos' });
        }

        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Georgia, serif; background-color: #FBF8F3; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #F5F0E6; border-radius: 8px; padding: 40px; }
        .header { border-bottom: 2px solid rgba(196, 149, 106, 0.3); padding-bottom: 20px; margin-bottom: 30px; }
        .title { font-family: Georgia, serif; color: #2C2416; font-size: 24px; }
        .date { color: #7A7062; font-size: 14px; margin-top: 8px; }
        .content { font-family: Georgia, serif; color: #2C2416; font-size: 16px; line-height: 1.8; white-space: pre-wrap; }
        .stamp { display: inline-block; border: 2px solid #C4956A; padding: 8px 16px; border-radius: 4px; color: #8B7355; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="title">Nueva entrada en tu Bitácora</h1>
            <p class="date">${date} - ${time}</p>
        </div>
        <div class="content">${escapeHtml(content)}</div>
        <div class="footer">
            <span class="stamp">Guardado</span>
        </div>
    </div>
</body>
</html>
        `;

        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'Bitácora Personal <onboarding@resend.dev>',
                to: [email],
                subject: `Nueva entrada - ${date}`,
                html: htmlContent
            })
        });

        if (!response.ok) {
            throw new Error('Error al enviar email');
        }

        return res.status(200).json({ success: true, message: 'Email enviado' });

    } catch (error) {
        return res.status(500).json({ error: 'Error al enviar el email' });
    }
}

function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
}
