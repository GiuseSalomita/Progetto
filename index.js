import { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createServer } from 'http';
import { inspect } from 'util';

// DEFINIZIONE DEL FLAG TEMPORANEO (Risolve i deprecation warning)
const EPHEMERAL_FLAG = 1 << 6; 

// --- CONFIGURAZIONE GLOBALE ---
const BOT_TOKEN = process.env.BOT_TOKEN; 

// ID CANALI E RUOLI AGGIORNATI (STAFF_ROLE_ID MODIFICATO)
const TICKET_PANEL_CHANNEL_ID = '1431931296787071027'; 
const STAFF_ROLE_ID = '1431931072098340934'; // <<--- NUOVO ID RUOLO STAFF
const CITIZEN_ROLE_ID = '1431247832249603250';
const PRIORITARIA_ROLE_ID = '1431931076242182276'; 
const PRIORITARIA_CATEGORY_ID = '1431931152110261530'; 
const WELCOME_CHANNEL_ID = '143209311299433352';
const RULES_CHANNEL_ID = '1432093119752886839';
const CONVOCA_CHANNEL_ID = '1431931305926328320'; 

// LINK DI DISCORD CORRETTO PER RISOLVERE L'ERRORE IMAGUR
const NEXUS_LOGO_URL = 'https://cdn.discordapp.com/attachments/1404849559712039033/1432377198555304068/download.png?ex=6900d4b8&is=68ff8338&hm=4a6ac31ff8d490142256f11ca941629947183785bb51744dc3d5ff9f8ef9cd0a&';
// ------------------------------

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
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
    await registerSlashCommands(); 
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

    // Menu a tendina per l'assistenza standard con le CATEGORIE CORRETTE
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_ticket_standard')
        .setPlaceholder('Seleziona la Categoria di Assistenza Standard...')
        .addOptions([
            { label: 'Domanda Generale', value: 'standard_general', description: 'Per domande generiche o informazioni.' },
            { label: 'Problema Tecnico', value: 'standard_tecnico', description: 'Per problemi con il server o il gioco.' },
            { label: 'Richiesta Unban', value: 'standard_unban', description: 'Per appellarsi a un ban o sospensione.' },
            { label: 'Segnalazione', value: 'standard_segnalazione', description: 'Per segnalare un utente o comportamento.' },
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
    const categoryId = isPriority ? PRIORITARIA_CATEGORY_ID : null; 
    const category = categoryId ? guild.channels.cache.get(categoryId) : null;

    const existingTicket = guild.channels.cache.find(c => 
        c.name.startsWith('ticket-') && 
        c.permissionOverwrites.cache.has(member.id) 
    );

    if (existingTicket) {
        return interaction.editReply({ content: `Hai già un ticket aperto in ${existingTicket}!`, flags: EPHEMERAL_FLAG });
    }

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
            const staffRole = interaction.guild.roles.cache.get(STAFF_ROLE_ID);
            const convocaChannel = interaction.guild.channels.cache.get(CONVOCA_CHANNEL_ID);
            const motivo = interaction.options.getString('motivo');

            // Questa condizione verrà superata con l'ID corretto
            if (!staffRole || !convocaChannel) {
                return interaction.reply({ content: 'Errore di configurazione del comando Convoca (canale o ruolo staff non trovato).', flags: EPHEMERAL_FLAG });
            }
            
            await interaction.reply({ content: `Hai richiesto una convocazione per il motivo: **${motivo}**. Lo staff verrà notificato in ${convocaChannel}.`, flags: EPHEMERAL_FLAG });

            const convocaEmbed = new EmbedBuilder()
                .setColor('#FF0000') 
                .setTitle(`🔔 Nuova Convocazione Richiesta`)
                .setDescription(`L'utente ${interaction.member} ha richiesto una convocazione.`)
                .addFields(
                    { name: 'Richiesta da', value: `${interaction.member.user.tag} (${interaction.member.id})`, inline: true },
                    { name: 'Motivo', value: motivo, inline: false }
                )
                .setTimestamp();
                
            await convocaChannel.send({ 
                content: `<@&${staffRole.id}>, c'è una nuova convocazione.`, 
                embeds: [convocaEmbed] 
            });
            
            return;
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


// Funzione per registrare i comandi slash 
async function registerSlashCommands() {
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
            description: 'Convoca un utente per un colloquio con lo staff.',
            options: [
                {
                    name: 'motivo',
                    description: 'Il motivo della convocazione.',
                    type: 3, // STRING
                    required: true,
                },
            ],
        },
    ];

    try {
        const client_id = client.user.id;
        const guild_id = client.guilds.cache.first()?.id; 

        if (!guild_id) {
            console.warn("Attenzione: Nessuna gilda trovata. I comandi slash potrebbero non registrarsi immediatamente.");
            return;
        }
        
        const rest = client.application.commands;
        await rest.set(commands, guild_id);
        
        console.log('Comandi slash registrati con successo.');
    } catch (error) {
        console.error('Errore durante la registrazione dei comandi slash:', inspect(error, true, 5));
    }
}

client.login(BOT_TOKEN).catch(err => {
    console.error("ERRORE DI LOGIN:", err);
});
