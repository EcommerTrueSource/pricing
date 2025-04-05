export const CONTRACT_NOTIFICATION_TEMPLATES = {
    FIRST_ATTEMPT: (razaoSocial: string, contractUrl: string) => {
        return `Olá *${razaoSocial}*! 👋

Esperamos que esteja tudo bem com você.

Somos da *True Source* e gostaríamos de informá-lo(a) sobre uma atualização importante na nossa política de preço mínimo autorizado.

📝 Segue o link do contrato para assinatura: ${contractUrl}

⏱️ *Prazo para assinatura:* 15 dias a partir do recebimento desta mensagem.

Além disso, pedimos gentilmente que nos informe:
• URLs dos sites onde vende nossos produtos
• Marketplaces onde atua
• Nome da loja utilizado

🔗 O envio deve ser feito através do formulário:
https://forms.gle/A7y4JjwpA71tjoko7

Estamos à disposição para esclarecer qualquer dúvida!

Agradecemos sua parceria e atenção! 🙏

Cordialmente,
*Equipe True Source*`;
    },

    SECOND_ATTEMPT: (razaoSocial: string, contractUrl: string) => {
        return `Olá *${razaoSocial}*! 👋

Esperamos encontrá-lo(a) bem.

📢 Gostaríamos de gentilmente lembrá-lo(a) sobre a *atualização da nossa política de preço mínimo autorizado*.

Notamos que o contrato enviado há 3 dias ainda aguarda sua assinatura:
🔗 ${contractUrl}

⏱️ *Lembramos que o prazo para assinatura é de 15 dias* a partir do primeiro contato.

Também aguardamos as informações sobre:
• Sites onde comercializa nossos produtos
• Marketplaces onde atua
• Nome da sua loja

📋 Preencha essas informações no formulário:
https://forms.gle/A7y4JjwpA71tjoko7

Nossa equipe está à disposição para ajudá-lo(a) com o processo de assinatura ou esclarecer dúvidas.

Agradecemos sua atenção e parceria contínua! 🤝

Atenciosamente,
*Equipe True Source*`;
    },

    THIRD_ATTEMPT: (razaoSocial: string, contractUrl: string) => {
        return `Olá *${razaoSocial}*! 👋

*⚠️ AVISO IMPORTANTE*

Esperamos que esteja bem. Esta é nossa *terceira e última comunicação* referente à atualização da política de preço mínimo autorizado da True Source.

O contrato enviado há 7 dias ainda aguarda sua assinatura, e o prazo está se esgotando:
🔗 ${contractUrl}

⏱️ Para mantermos nossa parceria comercial ativa, é *indispensável* a assinatura deste documento dentro do prazo estabelecido de 15 dias.

Lembramos também da importância de nos informar:
• Sites onde comercializa nossos produtos
• Marketplaces onde atua
• Nome da sua loja

📋 Através do formulário:
https://forms.gle/A7y4JjwpA71tjoko7

Nossa equipe está inteiramente à disposição para auxiliá-lo(a) no processo de assinatura.

Contamos com sua compreensão e resposta para continuarmos com nossa parceria comercial. 🤝

Atenciosamente,
*Equipe True Source*`;
    },
};
