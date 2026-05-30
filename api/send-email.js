
/**
 * Bitácora Personal - API de Email para Vercel (Con Corrector Ortográfico)
 */

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    try {
        const { content, date, time, email } = req.body;

        if (!content || !email) {
            return res.status(400).json({ error: 'Faltan datos requeridos' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Email inválido' });
        }

        // ==========================================
        // 🛠️ HERRAMIENTA BACKEND: CORRECTOR ORTOGRÁFICO
        // ==========================================
        let finalContent = content;
        let correctionNotes = "";

        try {
            // Llamamos a la API gratuita de LanguageTool para español
            const checkResponse = await fetch('https://api.languagetool.org/v2/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    text: content,
                    language: 'es'
                })
            });

            if (checkResponse.ok) {
                const checkData = await checkResponse.json();
                
                // Si encuentra errores, los corregimos automáticamente con la primera sugerencia
                if (checkData.matches && checkData.matches.length > 0) {
                    let offsetMod = 0;
                    let errorsFound = [];

                    // Recorremos los errores de atrás hacia adelante para no romper los índices (offsets)
                    const sortedMatches = checkData.matches.sort((a, b) => b.offset - a.offset);

                    for (const match of sortedMatches) {
                        if (match.replacements && match.replacements.length > 0) {
                            const wordToReplace = content.substring(match.offset, match.offset + match.length);
                            const correction = match.replacements[0].value;
                            
                            // Aplicamos el reemplazo en el texto final
                            finalContent = finalContent.substring(0, match.offset) + correction + finalContent.substring(match.offset + match.length);
                            errorsFound.push(`• "<i>${wordToReplace}</i>" cambiado por "<b>${correction}</b>" (${match.message})`);
                        }
                    }

                    if (errorsFound.length > 0) {
                        correctionNotes = `
                            <div style="margin-top: 20px; padding: 15px; background-color: #FFF2CC; border-left: 4px solid #F1C232; font-family: sans-serif; font-size: 13px; color: #7F6000;">
                                <strong>Auto-correcciones ortográficas aplicadas:</strong><br>
                                ${errorsFound.reverse().join('<br>')}
                            </div>
                        `;
                    }
                }
            }
        } catch (spellError) {
            console.error('Error en el corrector ortográfico (se enviará el texto original):', spellError);
        }

        // ==========================================
        // 📧 DISEÑO DEL EMAIL
        // ==========================================
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Georgia, serif; background-color: #FBF8F3; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #F5F0E6; border-radius: 8px; padding: 40px; box-shadow: 0 2px 10px rgba(44, 36, 22, 0.1); }
        .header { border-bottom: 2px solid rgba(196, 149, 106, 0.3); padding-bottom: 20px; margin-bottom: 30px; }
        .title { color: #2C2416; font-size: 24px; margin: 0; }
        .date { color: #7A7062; font-size: 14px; margin-top: 8px; }
        .content { color: #2C2416; font-size: 16px; line-height: 1.8; white-space: pre-wrap; }
        .footer { border-top: 2px solid rgba(196, 149, 106, 0.3); padding-top: 20px; margin-top: 30px; text-align: center; }
        .stamp { display: inline-block; border: 2px solid #C4956A; padding: 8px 16px; border-radius: 4px; color: #8B7355; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="title">Nueva entrada en tu Bitácora</h1>
            <p class="date">${date || new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} - ${time || new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <div class="content">${escapeHtml(finalContent)}</div>
        ${correctionNotes}
        <div class="footer">
            <span class="stamp">Guardado y Corregido</span>
        </div>
    </div>
</body>
</html>
        `;

        // ==========================================
        // 🚀 ENVÍO CON RESEND
        // ==========================================
        if (!process.env.RESEND_API_KEY) {
            throw new Error("La variable RESEND_API_KEY no está configurada en Vercel.");
        }

        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'Bitácora Personal <onboarding@resend.dev>',
                to: [email],
                subject: `Nueva entrada - ${date || 'Bitácora'}`,
                html: htmlContent
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Error de Resend:', errorData);
            throw new Error(`Error de Resend: ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();

        return res.status(200).json({
            success: true,
            message: 'Email enviado correctamente',
            id: data.id
        });

    } catch (error) {
        console.error('Error al procesar solicitud:', error);
        return res.status(500).json({
            error: 'Error al enviar el email',
            details: error.message
        });
    }
}

function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
}
