import { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, Routes, API } from 'discord.js';
import { createServer } from 'http';
import { inspect } from 'util';

// Il flag DEVE essere definito qui, non importato da discord.js
const EPHEMERAL_FLAG = 1 << 6; 

// --- CONFIGURAZIONE GLOBALE ---
const BOT_TOKEN = process.env.BOT_TOKEN; 

// ID CANALI E RUOLI (DEVI VERIFICARE TUTTI QUESTI ID)
const TICKET_PANEL_CHANNEL_ID = '1431931296787071027'; 
const STAFF_ROLE_ID = '1431931072098340934'; 
const CITIZEN_ROLE_ID = '1431247832249603250';
const PRIORITARIA_ROLE_ID = '1431931076242182276'; 
const PRIORITARIA_CATEGORY_ID = '1431931152110261530'; 
const WELCOME_CHANNEL_ID = '143209311299433352';
const RULES_CHANNEL_ID = '1432093119752886839';
const CONVOCA_CHANNEL_ID = '1431931305926328320'; 

// ID DEI CANALI VOCALI DI ASSISTENZA
const ASSISTENZA_VOCALE_ID_GENERALE = '1431931307427893390'; 
const ASSISTENZA_VOCALE_ID_AZIONI = '1431931309214797915'; 

// LINK IMMAGINE
const NEXUS_LOGO_URL = 'https://cdn.discordapp.com/attachments/1404849559712039033/1432377198555304068/download.png?ex=6900d4b8&is=68ff8338&hm=4a6ac31ff8d490142256f11ca941629947183785bb51744dc3d5ff9f8ef9cd0a&';
// ------------------------------

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages 
    ]
});

function keepAlive() {
    const port = process.env.PORT || 3000;
    createServer((req, res) => {
        res.writeHead(200);
        res.end('NexusBotJS is running!');
    }).listen(port, () => console.log(`HTTP server listening on port ${port}`));
}

client.once('ready', async () => {
    console.log(`Bot pronto! Connesso come ${client.user.tag}`);
    keepAlive();
    // Registrazione globale per risolvere problemi di cache
    await registerSlashCommandsGlobally(); 
});

// Funzione per inviare o modificare il pannello dei ticket
async function sendTicketPanel(channelId) {
    const channel = client.channels.cache.get(channelId);
    if (!channel) {
        console.error(`Canale per il pannello ticket non trovato: ${channelId}`);
        return;
    }

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('💎 Benvenuto nel Centro Assistenza Nexus 💎')
        .setDescription(
            'Apri un ticket per le tue esigenze e lo staff ti aiuterà nel più breve tempo possibile.\n\n' +
            '**Seleziona la categoria standard nel menu a tendina qui sotto.**\n' +
            `Se hai il ruolo Prioritario, usa il pulsante sopra per un servizio più veloce.\n\n` +
            'Assistenza Nexus | Risposta 24/48h (Standard)'
        )
        .setThumbnail(NEXUS_LOGO_URL) 
        .setFooter({ text: 'Nexus RP | Sistema Ticket' });

    // Menu a tendina con le CATEGORIE CORRETTE E EMOJI
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_ticket_standard')
        .setPlaceholder('Seleziona la Categoria di Assistenza...')
        .addOptions([
            { label: 'Ticket - Generale', value: 'standard_generale', description: 'Per domande o problemi di carattere generale.', emoji: '❓' },
            { label: 'Ticket - Permadeath/Wipe', value: 'standard_permadeath_wipe', description: 'Problemi o discussioni relative a Permadeath o Wipe.', emoji: '💀' },
            { label: 'Ticket - Modifica PG', value: 'standard_modifica_pg', description: 'Per richieste di modifica al proprio personaggio.', emoji: '✏️' },
            { label: 'Ticket - Bandi AC', value: 'standard_bandi_ac', description: 'Per discutere di bandi e provvedimenti dell\'Admin/Community.', emoji: '🛡️' },
            { label: 'Ticket - Contesazioni azioni', value: 'standard_contestazioni_azioni', description: 'Per contestare azioni di gioco o dello staff.', emoji: '⚔️' },
            { label: 'Ticket - Rimborsi', value: 'standard_rimborsi', description: 'Per richiedere rimborsi per perdite dovute a bug o problemi del server.', emoji: '💸' },
            { label: 'Ticket - Contesazioni BAN', value: 'standard_contestazioni_ban', description: 'Per contestare un ban o una sospensione ricevuta.', emoji: '🔨' },
            { label: 'Ticket - Acquisti', value: 'standard_acquisti', description: 'Per problemi o domande relative ad acquisti in gioco o donazioni.', emoji: '🛒' },
            { label: 'Ticket - UnBan', value: 'standard_unban', description: 'Per appellarsi a un ban o sospensione.', emoji: '🔑' },
            { label: 'Ticket - Richiesta Fazioni', value: 'standard_richiesta_fazioni', description: 'Per richieste o informazioni sull\'apertura di una fazione.', emoji: '🏛️' },
        ]);

    // Bottone per l'assistenza prioritaria
    const priorityButton = new ButtonBuilder()
        .setCustomId('button_ticket_priority')
        .setLabel('Assistenza Prioritaria')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('💎');

    const actionRowSelect = new ActionRowBuilder().addComponents(selectMenu);
    const actionRowButton = new ActionRowBuilder().addComponents(priorityButton);

    try {
        const messages = await channel.messages.fetch({ limit: 10 });
        const existingMessage = messages.find(m => m.author.id === client.user.id && m.embeds.length > 0 && m.embeds[0].title === '💎 Benvenuto nel Centro Assistenza Nexus 💎');

        if (existingMessage) {
            await existingMessage.edit({ embeds: [embed], components: [actionRowButton, actionRowSelect] });
            console.log('Pannello ticket esistente modificato con successo.');
        } else {
            await channel.send({ embeds: [embed], components: [actionRowButton, actionRowSelect] });
            console.log('Nuovo pannello ticket inviato con successo.');
        }
    } catch (e) {
        console.error("Errore durante l'invio/modifica del pannello ticket:", e);
    }
}

async function createTicket(interaction, type, isPriority = false) {
    await interaction.deferReply({ flags: EPHEMERAL_FLAG }); 

    const member = interaction.member;

    if (isPriority && !member.roles.cache.has(PRIORITARIA_ROLE_ID)) {
        return interaction.editReply({ content: 'Non hai il ruolo necessario per aprire un ticket di assistenza prioritaria.', flags: EPHEMERAL_FLAG });
    }

    const guild = interaction.guild;

    const existingTicket = guild.channels.cache.find(c => 
        c.name.startsWith('ticket-') && 
        c.permissionOverwrites.cache.has(member.id) 
    );

    if (existingTicket) {
        return interaction.editReply({ content: `Hai già un ticket aperto in ${existingTicket}!`, flags: EPHEMERAL_FLAG });
    }
    
    // Logica Categoria
    const categoryId = isPriority ? PRIORITARIA_CATEGORY_ID : null; 

    try {
        const ticketChannel = await guild.channels.create({
            name: `ticket-${member.user.username.toLowerCase().replace(/[^a-z0-9-]/g, '').substring(0, 20)}`,
            type: ChannelType.GuildText,
            parent: categoryId, 
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                { id: STAFF_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ],
        });

        const welcomeEmbed = new EmbedBuilder()
            .setColor(isPriority ? '#FFD700' : '#5865F2')
            .setTitle(isPriority ? '💎 Ticket Prioritario Aperto' : '🎫 Ticket Assistenza Aperto')
            .setDescription(`Benvenuto, ${member}!\nIl tuo ticket è stato aperto per la categoria: **${type}**.\nLo staff è stato notificato e ti risponderà al più presto.`)
            .setThumbnail(NEXUS_LOGO_URL)
            .setFooter({ text: 'Usa il comando /close per chiudere il ticket quando hai finito.' });

        const closeButton = new ButtonBuilder()
            .setCustomId('button_ticket_close')
            .setLabel('Chiudi Ticket')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔒');

        const actionRow = new ActionRowBuilder().addComponents(closeButton);

        await ticketChannel.send({ embeds: [welcomeEmbed], components: [actionRow] });
        await ticketChannel.send({ content: `<@&${STAFF_ROLE_ID}> ${isPriority ? '<@&'+PRIORITARIA_ROLE_ID+'>' : ''}` });

        await interaction.editReply({ content: `Il tuo ticket è stato aperto in ${ticketChannel}!`, flags: EPHEMERAL_FLAG });
    } catch (error) {
        console.error('Errore durante la creazione del ticket:', error);
        await interaction.editReply({ content: 'Si è verificato un errore durante l\'apertura del ticket.', flags: EPHEMERAL_FLAG });
    }
}

async function handleConvoca(interaction, convocaType) {
    // Inizia la risposta differita per evitare il timeout
    await interaction.deferReply({ flags: EPHEMERAL_FLAG });

    const staffRole = interaction.guild.roles.cache.get(STAFF_ROLE_ID);
    const convocaChannel = interaction.guild.channels.cache.get(CONVOCA_CHANNEL_ID);
    const motivo = interaction.options.getString('motivo');
    const targetUser = interaction.options.getUser('utente');
    
    // Sceglie l'ID del canale vocale in base al tipo di convocazione
    const assistenzaVocaleID = convocaType === 'azioni' ? ASSISTENZA_VOCALE_ID_AZIONI : ASSISTENZA_VOCALE_ID_GENERALE;
    const assistenzaTypeLabel = convocaType === 'azioni' ? 'Azioni/Contestazioni' : 'Generale/Informazioni';

    if (!staffRole || !convocaChannel) {
        return interaction.editReply({ content: 'Errore di configurazione del comando Convoca (canale o ruolo staff non trovato. Verifica gli ID).', flags: EPHEMERAL_FLAG });
    }

    // 1. CREA INVITO DINAMICO (o un link statico come fallback)
    let inviteLink = null;
    try {
        const voiceChannel = interaction.guild.channels.cache.get(assistenzaVocaleID);
        if (voiceChannel && voiceChannel.type === ChannelType.GuildVoice) {
            // Crea un invito con 10 minuti di validità e 1 utilizzo
            const invite = await voiceChannel.createInvite({
                maxUses: 1, 
                maxAge: 600, // 10 minuti
                reason: `Convocazione per ${targetUser.tag}`
            });
            inviteLink = invite.url;
        }
    } catch (error) {
        console.warn("Impossibile creare l'invito dinamico. Usando link diretto (verifica che il bot abbia i permessi 'Create Instant Invite'):", error);
        // Fallback: link diretto al canale vocale.
        inviteLink = `https://discord.com/channels/${interaction.guild.id}/${assistenzaVocaleID}`;
    }

    // 2. INVIA MESSAGGIO PRIVATO (DM) CON BOTTONE ALL'UTENTE CONVOCATO
    const dmEmbed = new EmbedBuilder()
        .setColor('#FF0000') 
        .setTitle(`🚨 SEI STATO CONVOCATO IN ASSISTENZA 🚨`)
        .setDescription(`Sei stato convocato dallo Staff di Nexus RP per il seguente motivo:\n\n**Tipo Convocazione:** ${assistenzaTypeLabel}\n**Motivo:** ${motivo}\n\nClicca sul pulsante qui sotto per collegarti immediatamente al canale vocale di assistenza.`)
        .setThumbnail(NEXUS_LOGO_URL);

    const connectButton = new ButtonBuilder()
        .setLabel('Connettiti al Canale Assistenza')
        .setStyle(ButtonStyle.Link)
        .setURL(inviteLink);

    const dmActionRow = new ActionRowBuilder().addComponents(connectButton);

    try {
        await targetUser.send({ 
            embeds: [dmEmbed], 
            components: [dmActionRow] 
        });
        
        // Risposta effimera all'utente che ha eseguito il comando (lo staff)
        await interaction.editReply({ content: `Hai convocato ${targetUser.tag} per il motivo: **${motivo}**. Gli è stato inviato un messaggio privato con il link all'assistenza.`, flags: EPHEMERAL_FLAG });

    } catch (error) {
        console.error(`Impossibile inviare DM a ${targetUser.tag}:`, error);
        await interaction.editReply({ content: `Hai convocato ${targetUser.tag} per il motivo: **${motivo}**. ATTENZIONE: Non è stato possibile inviare il messaggio privato. Lo staff è stato comunque notificato.`, flags: EPHEMERAL_FLAG });
    }
    
    // 3. INVIA MESSAGGIO PUBBLICO NEL CANALE CONVOCA
    const convocaEmbed = new EmbedBuilder()
        .setColor('#FF0000') 
        .setTitle(`🔔 Nuova Convocazione Pubblica - ${assistenzaTypeLabel.toUpperCase()}`)
        .setDescription(`L'utente ${targetUser} è stato convocato in Assistenza per il motivo: **${motivo}**!`)
        .addFields(
            { name: 'Tipo', value: assistenzaTypeLabel, inline: true },
            { name: 'Utente Convocato', value: `${targetUser.tag}`, inline: true },
            { name: 'Collegamento Assistenza', value: `[Clicca qui per collegarti](${inviteLink})`, inline: false }
        )
        .setTimestamp();
        
    await convocaChannel.send({ 
        content: `<@&${staffRole.id}>, c'è una nuova convocazione!`, 
        embeds: [convocaEmbed] 
    });
}

client.on('guildMemberAdd', async member => {
    const welcomeChannel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    const rulesChannel = member.guild.channels.cache.get(RULES_CHANNEL_ID);

    if (!welcomeChannel) return;

    const welcomeEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('☀️ Benvenuto su Nexus RP! ☀️')
        .setDescription(
            `Ciao ${member}!
            Siamo entusiasti di averti a bordo! Nexus RP è il luogo dove la tua avventura prende vita.

            Per cominciare, sei invitato a leggere attentamente il nostro **regolamento server** presente sul canale ${rulesChannel}.

            Una volta letto, potrai goderti appieno la tua esperienza. **BUON RP!**`
        )
        .setThumbnail(NEXUS_LOGO_URL); 

    await welcomeChannel.send({ content: `${member}`, embeds: [welcomeEmbed] });
});

client.on('interactionCreate', async interaction => {
    // Gestisce il timeout se il bot si è appena riavviato
    if (client.isReady() === false) {
        return interaction.reply({ content: 'Il bot si sta ancora avviando. Riprova tra un minuto.', flags: EPHEMERAL_FLAG });
    }
    
    if (interaction.isCommand()) {
        const { commandName } = interaction;

        if (commandName === 'setup_ticket_panel') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) && 
                !interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
                return interaction.reply({ content: 'Non hai il permesso di eseguire questo comando.', flags: EPHEMERAL_FLAG });
            }

            await interaction.deferReply({ flags: EPHEMERAL_FLAG });
            await sendTicketPanel(TICKET_PANEL_CHANNEL_ID);
            return interaction.editReply({ content: 'Pannello ticket inviato/aggiornato con successo!', flags: EPHEMERAL_FLAG });
        }
        
        if (commandName === 'convoca') { 
            return handleConvoca(interaction, 'generale');
        }
        
        if (commandName === 'convoca_azioni') { 
            return handleConvoca(interaction, 'azioni');
        }
        
        if (commandName === 'close') {
            if (!interaction.channel.name.startsWith('ticket-')) {
                return interaction.reply({ content: 'Questo comando può essere usato solo in un canale ticket.', flags: EPHEMERAL_FLAG });
            }

            await interaction.reply({ content: 'Chiusura del ticket in corso...', flags: EPHEMERAL_FLAG }); 
            setTimeout(() => interaction.channel.delete().catch(console.error), 5000); 
        }
    }

    // Gestione del menu a tendina (Assistenza Standard)
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_ticket_standard') {
        const type = interaction.values[0].replace('standard_', '');
        await createTicket(interaction, type, false);
    }

    // Gestione del bottone (Assistenza Prioritaria)
    if (interaction.isButton() && interaction.customId === 'button_ticket_priority') {
        await createTicket(interaction, 'Prioritaria', true);
    }

    // Gestione del bottone di chiusura ticket
    if (interaction.isButton() && interaction.customId === 'button_ticket_close') {
        if (!interaction.channel.name.startsWith('ticket-')) {
            return interaction.reply({ content: 'Questo comando può essere usato solo in un canale ticket.', flags: EPHEMERAL_FLAG });
        }

        await interaction.reply({ content: 'Chiusura del ticket in corso...', flags: EPHEMERAL_FLAG });
        setTimeout(() => interaction.channel.delete().catch(console.error), 5000); 
    }
});


// Funzione per registrare i comandi slash GLOBALMENTE
async function registerSlashCommandsGlobally() {
    const commonOptions = [
        {
            name: 'motivo',
            description: 'Il motivo della convocazione. (Obbligatorio)',
            type: 3, // STRING
            required: true, 
        },
        {
            name: 'utente',
            description: 'L\'utente da convocare.',
            type: 6, // USER
            required: true, 
        },
    ];
    
    const commands = [
        {
            name: 'setup_ticket_panel',
            description: 'Invia o aggiorna il pannello per l\'apertura dei ticket.',
        },
        {
            name: 'close',
            description: 'Chiude il canale ticket corrente.',
        },
        { 
            name: 'convoca',
            description: 'Convoca un utente per un colloquio in assistenza generale.',
            options: commonOptions,
        },
        { 
            name: 'convoca_azioni',
            description: 'Convoca un utente per un colloquio su azioni/contestazioni.',
            options: commonOptions,
        },
    ];

    try {
        const rest = client.application.commands;
        await rest.set(commands); 
        console.log('Comandi slash registrati globalmente con successo.');
    } catch (error) {
        console.error('Errore durante la registrazione dei comandi slash:', inspect(error, true, 5));
    }
}

client.login(BOT_TOKEN).catch(err => {
    console.error("ERRORE DI LOGIN:", err);
});
