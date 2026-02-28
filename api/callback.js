const axios = require('axios');
const fs = require('fs');
const path = require('path');
const bio = require('../utils/biografo');

module.exports = async (req, res) => {
    // Pegando os dados que o seu Bot enviou via URL
    const { code, state, u_name, u_icon } = req.query;

    // 1. Validação básica
    if (!code || !state) {
        return res.status(400).send("<h1>Erro: Dados de autenticação ausentes.</h1>");
    }

    try {
        // 2. Desbiografar o ID do Bot para saber qual Secret usar
        const botIdReal = bio.decodificar(state);
        
        // 3. Carregar o Banco de Dados (bots.json)
        const dbPath = path.join(process.cwd(), 'database', 'bots.json');
        
        if (!fs.existsSync(dbPath)) {
            return res.status(500).send("Banco de dados não encontrado.");
        }

        let db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
        const botConfig = db.find(b => b.clientId === botIdReal);

        if (!botConfig) {
            return res.status(404).send("Configuração do Bot não encontrada no ULTRA MEGA REALISTA PRO MAX OS.");
        }

        // 4. Trocar o 'code' pelo Access Token no Discord
        // Importante: A redirect_uri aqui deve ser IGUAL à que você colocou no Dev Portal
        const redirectUri = `https://${req.headers.host}/callback`;

        const params = new URLSearchParams({
            client_id: botConfig.clientId,
            client_secret: botConfig.clientSecret,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: redirectUri,
        });

        const tokenRes = await axios.post('https://discord.com/api/v10/oauth2/token', params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const { access_token, refresh_token } = tokenRes.data;

        // 5. Pegar o ID real do usuário no Discord
        const userRes = await axios.get('https://discord.com/api/v10/users/@me', {
            headers: { Authorization: `Bearer ${access_token}` }
        });

        const discordUser = userRes.data;

        // 6. Salvar o novo "peixe" (membro) na sua lista
        const novoMembro = {
            id: discordUser.id,
            username: bio.decodificar(u_name) || discordUser.username,
            avatar: bio.decodificar(u_icon) || discordUser.avatar,
            access_token,
            refresh_token,
            save_date: new Date().toISOString()
        };

        // Adiciona ou atualiza o membro no bot específico
        botConfig.members = botConfig.members || [];
        const index = botConfig.members.findIndex(m => m.id === novoMembro.id);
        
        if (index === -1) {
            botConfig.members.push(novoMembro);
        } else {
            botConfig.members[index] = novoMembro;
        }

        // 7. Salvar no arquivo (Nota: Na Vercel isso dura apenas enquanto a instância está viva)
        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

        // 8. REDIRECIONAR PARA O INICIO.HTML (Com animação de carregamento)
        // Passamos os dados biografados adiante para as próximas páginas lerem
        res.writeHead(302, { 
            Location: `/inicio.html?u_name=${u_name}&u_icon=${u_icon}` 
        });
        res.end();

    } catch (error) {
        console.error("Erro no OAuth2:", error.response?.data || error.message);
        res.status(500).send("Ocorreu um erro ao processar sua verificação.");
    }
};