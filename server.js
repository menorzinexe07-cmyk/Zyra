const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const bio = require('./utils/biografo'); // Importa seu tradutor

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para servir arquivos estáticos (html, css, js do front)
app.use(express.static('public'));
app.use(express.json());

/**
 * ROTA PRINCIPAL DE CALLBACK DO OAUTH2
 */
app.get('/callback', async (req, res) => {
    const { code, state, u_name, u_icon } = req.query;

    // Se não tiver code ou o state (ID do bot biografado), cancela
    if (!code || !state) {
        return res.status(400).send("Requisição inválida. Credenciais ausentes.");
    }

    try {
        // 1. DESBIOGRAFAR O ID DO BOT PARA BUSCAR NO BANCO
        const botIdReal = bio.decodificar(state);
        
        // 2. LER O BANCO DE DADOS DE BOTS
        const dbPath = path.join(__dirname, 'database', 'bots.json');
        if (!fs.existsSync(dbPath)) {
            return res.status(500).send("Erro interno: Banco de dados não encontrado.");
        }

        let db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
        const botConfig = db.find(b => b.clientId === botIdReal);

        if (!botConfig) {
            return res.status(404).send("Este Bot não está configurado no sistema.");
        }

        // 3. TROCAR O 'CODE' PELO 'ACCESS_TOKEN' NO DISCORD
        const params = new URLSearchParams({
            client_id: botConfig.clientId,
            client_secret: botConfig.clientSecret,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: `https://seu-site.vercel.app/callback`, // DEVE SER IGUAL AO DO DEV PORTAL
        });

        const tokenResponse = await axios.post('https://discord.com/api/v10/oauth2/token', params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const { access_token, refresh_token } = tokenResponse.data;

        // 4. PEGAR O ID REAL DO USUÁRIO DIRETO DA API DO DISCORD (SEGURANÇA)
        const userResponse = await axios.get('https://discord.com/api/v10/users/@me', {
            headers: { Authorization: `Bearer ${access_token}` }
        });

        const discordUser = userResponse.data;

        // 5. PREPARAR OS DADOS DO MEMBRO PARA SALVAR
        const novoMembro = {
            id: discordUser.id,
            username: bio.decodificar(u_name) || discordUser.username,
            avatar_url: bio.decodificar(u_icon) || `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`,
            access_token: access_token,
            refresh_token: refresh_token,
            last_verify: new Date().toISOString()
        };

        // 6. SALVAR NA DATABASE DO BOT ESPECÍFICO
        botConfig.members = botConfig.members || [];
        const indexMembro = botConfig.members.findIndex(m => m.id === novoMembro.id);

        if (indexMembro === -1) {
            botConfig.members.push(novoMembro);
        } else {
            botConfig.members[indexMembro] = novoMembro;
        }

        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

        console.log(`✅ [SISTEMA] Membro ${novoMembro.username} pescado com sucesso para o Bot ${botIdReal}`);

        // 7. REDIRECIONAR PARA A UI DE CARREGAMENTO (Passando os dados biografados adiante)
        // Usamos os mesmos u_name e u_icon que chegaram para manter a estética no front
        res.redirect(`/inicio.html?u_name=${u_name}&u_icon=${u_icon}`);

    } catch (error) {
        console.error("❌ Erro no Processo OAuth2:", error.response?.data || error.message);
        res.status(500).send("Erro ao processar sua verificação. Tente novamente.");
    }
});
// Se alguém acessar o link puro (https://seu-site.vercel.app/), manda pro inicio
app.get('/', (req, res) => {
    res.redirect('/inicio.html');
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`
    ███████╗██╗   ██╗██████╗  █████╗ 
    ╚══███╔╝╚██╗ ██╔╝██╔══██╗██╔══██╗
      ███╔╝  ╚████╔╝ ██████╔╝███████║
     ███╔╝    ╚██╔╝  ██╔══██╗██╔══██║
    ███████╗   ██║   ██║  ██║██║  ██║
    ╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝
    🚀 ULTRA MEGA REALISTA PRO MAX OS ONLINE na porta ${PORT}
    `);
});