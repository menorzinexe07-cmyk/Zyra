/**
 * ULTRA MEGA REALISTA PRO MAX OS - MÓDULO BIÓGRAFO
 * Finalidade: Ofuscação de IDs e nomes para tráfego via URL
 */

const biografo = {
    // Tabela de tradução (Símbolos que você pediu)
    mapa: [
        { real: /a/g, fake: '&' },
        { real: /e/g, fake: '&&' },
        { real: /i/g, fake: '$' },
        { real: /o/g, fake: '!!' },
        { real: /=/g, fake: '%%' } // Evita o '=' do Base64 no link
    ],

    /**
     * Transforma texto real em "Biografado"
     */
    codificar: (texto) => {
        if (!texto) return '';
        
        // 1. Transforma em String e depois Base64
        let str = Buffer.from(texto.toString()).toString('base64');
        
        // 2. Aplica a substituição de caracteres (Biografar)
        biografo.mapa.forEach(reg => {
            str = str.replace(reg.real, reg.fake);
        });

        return encodeURIComponent(str); // Garante que o link seja clicável
    },

    /**
     * Transforma o "Biografado" de volta em texto real
     */
    decodificar: (texto) => {
        if (!texto) return '';

        let str = decodeURIComponent(texto);

        // 1. Reverte os símbolos para caracteres de Base64
        // Nota: Revertemos na ordem inversa ou tratamos os duplos (&&) primeiro
        str = str.replace(/&&/g, 'e');
        str = str.replace(/&/g, 'a');
        str = str.replace(/\$/g, 'i');
        str = str.replace(/!!/g, 'o');
        str = str.replace(/%%/g, '=');

        try {
            // 2. Converte de Base64 para UTF-8
            return Buffer.from(str, 'base64').toString('utf-8');
        } catch (err) {
            console.error("❌ Erro ao decodificar dado biografado:", err.message);
            return null;
        }
    }
};

module.exports = biografo; // codificar e decodificar já estão disponíveis
