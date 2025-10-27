import { Client, GatewayIntentBits, ChannelType, PermissionsBitField, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

// --- CONFIGURAZIONE GLOBALE ---
const BOT_TOKEN = 'MTQzMTk2MDc0MzcxNjA2NTM5MA.Gc3rCC.Zmz67Gi0ZA0U50z8wTUxydgiS9CvBMmfSMDhns'; 
const TICKET_PANEL_CHANNEL_ID = '1431931296787071027'; 
const STAFF_ROLE_ID = '1431931072098340934'; 
const CITIZEN_ROLE_ID = '1431747832246960250';
const PRIORITARIA_ROLE_ID = '1431931076242182276';
const PRIORITARIA_CATEGORY_ID = '1431931152112816280'; 

const WELCOME_CHANNEL_ID = '1431931190289633352'; 
const RULES_CHANNEL_ID = '1431931197528866869'; 

// La costante NEXUS_LOGO_URL è stata rimossa perché non era affidabile.
// Useremo client.user.displayAvatarURL() per il thumbnail.


// --- CONFIGURAZIONI FAZIONI (RUOLI E LINK) ---
const LEGAL_FACTION = {
    ROLES: ['1431931086870679614', '1431931096521510952', '1431931104973295670', '1431931116817879081', '1431931127513350305'],
    LINK: 'https://discord.gg/QgHFZymY',
};
const ILLEGAL_FACTION = {
    ROLES: ['1431931135948099655'], 
    LINK: 'https://discord.gg/g7SP7MPA',
};
const FACTION_TICKET_CLOSING_DELAY_MS = 120000; 


// --- CONFIGURAZIONI PER COMANDI /CONVOCA ---
const CONVOCATION_CHANNEL_ID = '1431931305926328320'; 
const ASSISTANCE_VOICE_ID = '1431931307427893390'; 
const AZIONI_VOICE_ID = '1431931309214797915'; 


// Definisci TUTTE le opzioni con l'ID Categoria univoco e le descrizioni accorciate
const TICKET_CATEGORIES = [
    { label: 'Wipe / Permadeath', value: 'wipe_permadeath', emoji: '💀', description: 'Problemi o info su Wipe/Permadeath.', categoryId: '1431931149634113586' },
    { label: 'Modifica PG', value: 'modifica_pg', emoji: '👤', description: 'Richiesta di modifiche al personaggio.', categoryId: '1431931150779158689' },
    { label: 'Generale', value: 'generale', emoji: '📝', description: 'Domande o problemi generici.', categoryId: '1431931152112816280' },
    { label: 'Bandi AC', value: 'bandi_ac', emoji: '🚫', description: 'Contestazione di ban da Anti-Cheat.', categoryId: '1431931152721121302' },
    { label: 'Contesta Azioni Staff', value: 'contesta_azioni', emoji: '🔨', description: 'Contestazione di un azione Staff.', categoryId: '1431931154063163432' }, 
    { label: 'Rimborsi', value: 'rimborsi', emoji: '💰', description: 'Richiesta di rimborso per bug o problemi.', categoryId: '1431931154948161608' },
    { label: 'Contestazioni Ban', value: 'contestazioni_ban', emoji: '⛔', description: 'Contestazione di un ban permanente/temporaneo.', categoryId: '1431931157334720542' }, 
    { label: 'Acquisti', value: 'acquisti', emoji: '🛒', description: 'Problemi o domande relative ad acquisti.', categoryId: '1431931158840475698' },
    { label: 'Unban (Acquisti Pack)', value: 'unban_pack', emoji: '🎁', description: 'Richiesta Unban post acquisto Pack.', categoryId: '1431931160040046633' },
    { label: 'Richiesta Fazione Legale', value: 'fazione_legale', emoji: '👮', description: 'Richiedi il link della fazione Legale (Verifica Ruolo).', categoryId: '1431931161445269535' },
    { label: 'Richiesta Fazione Illegale', value: 'fazione_illegale', emoji: '🔪', description: 'Richiedi il link della fazione Illegale (Verifica Ruolo).', categoryId: '1431931161445269535' },
];

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildVoiceStates, 
    ] 
});

const prioritariaButtonRow = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId('prioritaria_ticket')
            .setLabel('Assistenza Prioritaria')
            .setStyle(ButtonStyle.Primary) 
            .setEmoji('💎'),
    );

const ticketSelectMenuRow = new ActionRowBuilder()
    .addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('select_ticket_category')
            .setPlaceholder('Seleziona la Categoria di Assistenza Standard...')
            .addOptions(TICKET_CATEGORIES.map(cat => ({
                label: cat.label,
                description: cat.description,
                value: cat.value,
                emoji: cat.emoji
            }))),
    );

const closeButtonRow = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('Chiudi Ticket')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔒'),
    );

const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

function hasAnyRequiredRole(member, requiredRoles) {
    if (!member || !requiredRoles || requiredRoles.length === 0) return false;
    return requiredRoles.some(roleId => member.roles.cache.has(roleId));
}

async function createTicketChannel(interaction, category, isPrioritaria = false) {
    await interaction.deferReply({ ephemeral: true });
    
    const user = interaction.user;
    const member = interaction.member;
    const guild = interaction.guild;
    
    const categoryId = isPrioritaria ? PRIORITARIA_CATEGORY_ID : category.categoryId;
    const channelNamePrefix = isPrioritaria ? 'priorita-' : `${category.value.substring(0, 8)}-`;

    const existingTicket = guild.channels.cache.find(c => 
        c.type === ChannelType.GuildText && 
        c.topic === user.id &&
        c.parentId === categoryId
    );

    if (existingTicket) {
        return interaction.editReply(`Hai già un ticket aperto in questa categoria: ${existingTicket}.`);
    }

    const isLegalRequest = category.value === 'fazione_legale';
    const isIllegalRequest = category.value === 'fazione_illegale';

    if (isLegalRequest || isIllegalRequest) {
        let factionData, failureMessage;

        if (isLegalRequest) {
            factionData = LEGAL_FACTION;
            failureMessage = "❌ **Accesso Negato:** Non possiedi uno dei ruoli necessari per la fazione Legale. Apri un ticket Generale se hai problemi.";
        } else if (isIllegalRequest) {
            factionData = ILLEGAL_FACTION;
            failureMessage = "❌ **Accesso Negato:** Non possiedi uno dei ruoli necessari per la fazione Illegale. Apri un ticket Generale se hai problemi.";
        }

        if (factionData && !hasAnyRequiredRole(member, factionData.ROLES)) {
            return interaction.editReply(failureMessage);
        }
        
        const factionPermissionOverwrites = [
            { id: guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] }, 
            { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }, 
            { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }, 
        ];

        const factionChannel = await guild.channels.create({
            name: `${category.value.substring(0, 10)}-${user.username.toLowerCase().substring(0, 10)}`,
            type: ChannelType.GuildText,
            parent: categoryId, 
            topic: user.id,
            permissionOverwrites: factionPermissionOverwrites,
        });

        const successEmbed = new EmbedBuilder()
            .setTitle(`✅ Link Fazione ${isLegalRequest ? 'Legale' : 'Illegale'} Sbloccato!`)
            .setDescription(`Ecco il link Discord della tua fazione, ${user}:\n\n**Link:** ${factionData.LINK}\n\n*Questo canale è temporaneo. Puoi chiuderlo immediatamente o attendere l'autochiusura.*`)
            .setColor(isLegalRequest ? 0x00AAFF : 0xFF3333); 
        
        await factionChannel.send({ embeds: [successEmbed], components: [closeButtonRow] });

        let timeRemaining = FACTION_TICKET_CLOSING_DELAY_MS / 1000; 
        const updateInterval = 5000; 

        const countdownMessage = await factionChannel.send(`**ATTENZIONE:** Questo ticket si chiuderà tra **${formatTime(timeRemaining)}**. Salva il link ora!`);
        
        timeRemaining -= (updateInterval / 1000); 

        const countdownInterval = setInterval(async () => {
            if (!client.channels.cache.get(factionChannel.id)) {
                clearInterval(countdownInterval);
                return;
            }

            if (timeRemaining > 0) {
                try {
                    await countdownMessage.edit(`**ATTENZIONE:** Questo ticket si chiuderà tra **${formatTime(timeRemaining)}**.`);
                } catch (e) {
                    clearInterval(countdownInterval); 
                    return;
                }
                timeRemaining -= (updateInterval / 1000); 

            } else {
                clearInterval(countdownInterval);
                
                try {
                    const channelToDelete = client.channels.cache.get(factionChannel.id);
                    if (channelToDelete && channelToDelete.deletable) {
                        await channelToDelete.send('Tempo scaduto. Chiusura in corso...');
                        setTimeout(() => channelToDelete.delete(), 2000);
                    }
                } catch (e) {
                    console.error(`Errore durante la chiusura automatica del ticket fazione: ${e.message}`);
                }
            }
        }, updateInterval);

        return interaction.editReply(`Il link della tua fazione è stato inviato in ${factionChannel}. Il canale si chiuderà con un conto alla rovescia di 2 minuti (o puoi chiuderlo manualmente).`);
    }

    try {
        const permissionOverwrites = [
            { id: guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] }, 
            { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }, 
            { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }, 
            { id: STAFF_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }, 
        ];

        if (isPrioritaria) {
             permissionOverwrites.push(
                { id: PRIORITARIA_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
            );
        }

        const newChannel = await guild.channels.create({
            name: `${channelNamePrefix}${user.username.toLowerCase().substring(0, 10)}`,
            type: ChannelType.GuildText,
            parent: categoryId, 
            topic: user.id,
            permissionOverwrites: permissionOverwrites,
        });

        const welcomeEmbed = new EmbedBuilder()
            .setTitle(`🎫 ${isPrioritaria ? 'Ticket PRIORITARIO' : 'Ticket Assistenza'}: ${isPrioritaria ? 'PRIORITARIA' : category.label} 🚀`)
            .setDescription(
                isPrioritaria 
                ? `**ASSISTENZA PRIORITARIA ATTIVA.** Lo staff risponderà immediatamente. Descrivi il tuo problema/richiesta in modo dettagliato.`
                : `**Descrivi il tuo problema/richiesta in modo dettagliato.** Lo staff risponderà appena possibile.`
            )
            .setColor(0x0099ff) 
            // Usa l'avatar del bot come thumbnail.
            .setThumbnail(client.user.displayAvatarURL());

        await newChannel.send({
            content: `${user}, ${guild.roles.cache.get(STAFF_ROLE_ID)}${isPrioritaria ? ` ${guild.roles.cache.get(PRIORITARIA_ROLE_ID)}` : ''} lo staff è stato notificato.`,
            embeds: [welcomeEmbed],
            components: [closeButtonRow] 
        });
        
        await interaction.editReply(`Il tuo ticket è stato creato in ${newChannel}.`);

    } catch (error) {
        console.error('Errore nella creazione del ticket standard/prioritario:', error);
        await interaction.editReply('Si è verificato un errore durante la creazione del ticket. Controlla i permessi del bot e gli ID Categoria.');
    }
}

async function sendWelcomeMessage(member) {
    const welcomeChannel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    
    if (!welcomeChannel || welcomeChannel.type !== ChannelType.GuildText) {
        console.error(`Canale di benvenuto con ID ${WELCOME_CHANNEL_ID} non trovato o non è un canale testuale.`);
        return;
    }

    const rulesChannel = `<#${RULES_CHANNEL_ID}>`;

    const welcomeEmbed = new EmbedBuilder()
        .setTitle(`🌟 Benvenuto su Nexus RP! 🌟`)
        .setDescription(
            `Ciao ${member.user}!\n\n` +
            `Siamo entusiasti di averti a bordo! Nexus RP è il luogo dove la tua avventura prende vita.\n\n` +
            `**Per cominciare, sei invitato a leggere attentamente il nostro regolamento server presente sul canale ${rulesChannel}**.\n\n` +
            `Una volta letto, potrai goderti appieno la tua esperienza. **BUON RP!**`
        )
        .setColor(0x00A3FF) 
        // Usa l'avatar del bot come thumbnail.
        .setThumbnail(client.user.displayAvatarURL()) 
        // L'immagine grande in basso (che era buggata) è stata rimossa
        .setFooter({ text: 'Inizia la tua avventura!' })
        .setTimestamp();
    
    try {
        await welcomeChannel.send({ content: `${member}`, embeds: [welcomeEmbed] });
    } catch (error) {
        console.error(`Errore nell'invio del messaggio di benvenuto a ${member.user.tag}:`, error);
    }
}


// =========================================================================
//                           LISTENER EVENTI
// =========================================================================

client.on('interactionCreate', async interaction => {
    
    // --- Gestione Comandi Slash ---
    if (interaction.isChatInputCommand()) {
        const { commandName, options, member, channelId } = interaction;

        if (commandName === 'setup_ticket_panel') {
            
            if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels) || channelId !== TICKET_PANEL_CHANNEL_ID) {
                return interaction.reply({ content: `Questo comando può essere eseguito solo da staff in <#${TICKET_PANEL_CHANNEL_ID}>.`, ephemeral: true });
            }
            
            const embed = new EmbedBuilder()
                .setTitle('🎫 Benvenuto nel Centro Assistenza Nexus 💎') 
                .setDescription(
                    'Apri un ticket per le tue esigenze e lo staff ti aiuterà nel più breve tempo possibile.\n\n' +
                    '**Seleziona la categoria standard nel menu a tendina qui sotto.**\n' +
                    `**Se hai il ruolo Prioritario, usa il pulsante sopra per un servizio più veloce.**`
                ) 
                .setColor(0x0099ff) 
                // Usa l'avatar del bot come thumbnail.
                .setThumbnail(client.user.displayAvatarURL()) 
                .setFooter({ text: 'Assistenza Nexus | Risposta 24/48h (Standard)' });

            await interaction.channel.send({ embeds: [embed], components: [prioritariaButtonRow, ticketSelectMenuRow] });
            return interaction.reply({ content: 'Pannello Ticket inviato!', ephemeral: true });
        }


        // --- Logica /convoca e /convoca_azioni ---
        if (commandName === 'convoca' || commandName === 'convoca_azioni') {
            await interaction.deferReply();
            
            if (channelId !== CONVOCATION_CHANNEL_ID) {
                return interaction.editReply({ content: '❌ Questo comando può essere usato solo nel canale convocazioni.', ephemeral: true });
            }

            if (!member.roles.cache.has(STAFF_ROLE_ID)) {
                return interaction.editReply({ content: '❌ Non hai i permessi per usare questo comando.', ephemeral: true });
            }

            const targetUser = options.getUser('utente');
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

            if (!targetMember) {
                return interaction.editReply({ content: '❌ Utente non trovato nel server.', ephemeral: true });
            }

            let dmTitle, convocationMessage, targetVoiceId;

            if (commandName === 'convoca') {
                dmTitle = `Sei stato convocato in **Assistenza Generale** dallo Staff ${member.displayName} (Nexus RP).`;
                convocationMessage = `${targetUser} è stato convocato in **Assistenza**.`;
                targetVoiceId = ASSISTANCE_VOICE_ID;
            } else if (commandName === 'convoca_azioni') {
                dmTitle = `Sei stato convocato in **Assistenza Azioni** dallo Staff ${member.displayName} (Nexus RP).`;
                convocationMessage = `${targetUser} è stato convocato in **Assistenza Azioni**.`;
                targetVoiceId = AZIONI_VOICE_ID;
            }

            const moveButton = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`convoca_move_${targetVoiceId}`) 
                    .setLabel('Collegati in assistenza')
                    .setStyle(ButtonStyle.Success)
            );

            try {
                // Invia DM
                await targetUser.send({
                    content: dmTitle,
                    components: [moveButton]
                });
                
                // Messaggio Pubblico di Conferma (INVIATO 3 VOLTE)
                await interaction.editReply({ content: convocationMessage }); // Prima risposta
                await interaction.channel.send(convocationMessage); 
                await interaction.channel.send(convocationMessage); 

            } catch (e) {
                console.error(`Errore nell'invio del DM a ${targetUser.tag}:`, e);
                await interaction.editReply({ content: `❌ Impossibile inviare la convocazione a ${targetUser}. Forse ha i DM disabilitati. **Messaggi pubblici inviati.**`, ephemeral: true });
                
                try {
                    await interaction.channel.send(convocationMessage); 
                    await interaction.channel.send(convocationMessage); 
                } catch (sendError) {
                    console.error('Errore durante il triplo invio pubblico:', sendError);
                }
            }
        }
    }

    // --- Gestione Interazione Pulsanti e Menu ---
    if (interaction.isButton()) {
        if (interaction.customId === 'close_ticket') {
            const member = interaction.member;
            
            if (!member.roles.cache.has(STAFF_ROLE_ID) && interaction.channel.topic !== interaction.user.id) {
                return interaction.reply({ content: "Non hai il permesso di chiudere questo ticket.", ephemeral: true });
            }

            const channel = interaction.channel;
            await interaction.reply({ content: `Il ticket verrà chiuso tra 5 secondi da ${interaction.user}...` });
            await new Promise(resolve => setTimeout(resolve, 5000));
            await channel.delete();
        }

        if (interaction.customId.startsWith('convoca_move_')) {
            await interaction.deferReply({ ephemeral: true });
            const voiceChannelId = interaction.customId.split('_').pop();
            const guild = client.guilds.cache.find(g => g.channels.cache.has(voiceChannelId)); 
            
            if (!guild) return interaction.editReply('❌ Errore: Impossibile trovare il server Discord. Riprova nel server.');

            const memberToMove = await guild.members.fetch(interaction.user.id).catch(() => null);
            const targetVoiceChannel = guild.channels.cache.get(voiceChannelId);

            if (!targetVoiceChannel || targetVoiceChannel.type !== ChannelType.GuildVoice) return interaction.editReply('❌ Errore: Canale vocale di destinazione non trovato o non valido.');
            if (!memberToMove || !memberToMove.voice.channel) return interaction.editReply(`❌ **Devi essere collegato a un canale vocale qualsiasi** sul server **${guild.name}** per poterti spostare automaticamente. Collegati prima e riprova a premere il pulsante.`);

            try {
                await memberToMove.voice.setChannel(targetVoiceChannel);
                await interaction.editReply(`✅ Ti sei collegato al canale: **${targetVoiceChannel.name}**. Lo Staff sarà presto con te.`);
            } catch (e) {
                console.error('Errore nello spostamento dell\'utente:', e);
                await interaction.editReply('❌ Si è verificato un errore durante il tuo spostamento. Assicurati che il bot abbia il permesso "Sposta Membri" nel server.');
            }
        }
        
        if (interaction.customId === 'prioritaria_ticket') {
            if (!interaction.member.roles.cache.has(PRIORITARIA_ROLE_ID)) {
                return interaction.reply({ content: "❌ Non hai il ruolo 'Assistenza Prioritaria' per utilizzare questo pulsante. Acquista il servizio per sbloccarlo.", ephemeral: true });
            }
            await createTicketChannel(interaction, { value: 'prioritaria', label: 'PRIORITARIA' }, true);
        }
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'select_ticket_category') {
        const categoryValue = interaction.values[0];
        const selectedCategory = TICKET_CATEGORIES.find(c => c.value === categoryValue);
        if (selectedCategory) {
            await createTicketChannel(interaction, selectedCategory, false);
        }
    }
});


client.on('ready', async () => {
    console.log(`Nexus Bot è online come ${client.user.tag}`);

    // --- LOGICA DI ASSEGNAZIONE RUOLI ALL'AVVIO ---
    const targetRole = client.guilds.cache.map(guild => guild.roles.cache.get(CITIZEN_ROLE_ID)).find(role => role);

    if (targetRole) {
        console.log(`Inizio verifica e assegnazione ruolo: 🧍 ${targetRole.name}`);
        
        for (const [guildId, guild] of client.guilds.cache) {
            await guild.members.fetch(); 

            let membersAssignedCount = 0;
            const membersWithoutRole = guild.members.cache.filter(member => !member.user.bot && !member.roles.cache.has(CITIZEN_ROLE_ID));
            
            if (membersWithoutRole.size > 0) {
                console.log(`Trovati ${membersWithoutRole.size} membri in ${guild.name} senza il ruolo. Inizio assegnazione...`);
                
                for (const [memberId, member] of membersWithoutRole) {
                    try {
                        await member.roles.add(CITIZEN_ROLE_ID);
                        membersAssignedCount++;
                        await new Promise(resolve => setTimeout(resolve, 500)); 
                    } catch (e) {
                        console.error(`Errore nell'assegnare il ruolo a ${member.user.tag}: Missing Permissions (Controlla la gerarchia dei ruoli!)`);
                    }
                }
                console.log(`Assegnazione completata per ${guild.name}. Ruoli assegnati: ${membersAssignedCount}.`);
            } else {
                console.log(`Nessun membro in ${guild.name} ha bisogno del ruolo ${targetRole.name}.`);
            }
        }
    } else {
        console.log(`ATTENZIONE: Ruolo Cittadino con ID ${CITIZEN_ROLE_ID} non trovato. L'assegnazione automatica è stata saltata.`);
    }

    // --- REGISTRAZIONE COMANDO SLASH ---
    const commandData = [
        {
            name: 'setup_ticket_panel',
            description: 'Invia il pannello per aprire i ticket (solo per staff).',
            default_member_permissions: PermissionsBitField.Flags.ManageChannels.toString(), 
        },
        {
            name: 'convoca',
            description: 'Convoca un utente in assistenza.',
            options: [{
                name: 'utente',
                description: 'L\'utente da convocare.',
                type: 6, 
                required: true,
            }],
            default_member_permissions: PermissionsBitField.Flags.ManageChannels.toString(), 
        },
        {
            name: 'convoca_azioni',
            description: 'Convoca un utente in assistenza azioni.',
            options: [{
                name: 'utente',
                description: 'L\'utente da convocare.',
                type: 6, 
                required: true,
            }],
            default_member_permissions: PermissionsBitField.Flags.ManageChannels.toString(), 
        }
    ];

    try {
        const guild = client.guilds.cache.first(); 

        if (guild) {
            await guild.commands.set(commandData);
            console.log(`Comandi slash registrati con successo in ${guild.name}.`);
        } else {
            await client.application.commands.set(commandData); 
            console.log('Comandi slash registrati globalmente.');
        }

    } catch (error) {
        console.error('ERRORE CRITICO nella registrazione dei comandi slash:', error);
    }
});

// Listener per assegnare il ruolo "Cittadino di Nexus" ai nuovi membri E INVIARE IL BENVENUTO
client.on('guildMemberAdd', async member => {
    if (member.user.bot) return;

    // 1. Assegna il ruolo Cittadino
    try {
        const citizenRole = member.guild.roles.cache.get(CITIZEN_ROLE_ID);
        if (citizenRole) {
            await member.roles.add(citizenRole);
            console.log(`Ruolo ${citizenRole.name} assegnato a ${member.user.tag}`);
        }
    } catch (e) {
        console.error(`Errore nell'assegnare il ruolo al nuovo membro ${member.user.tag}:`, e.message);
    }

    // 2. Invia il messaggio di Benvenuto
    await sendWelcomeMessage(member);
});



client.login(BOT_TOKEN);
