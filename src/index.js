import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import express from 'express';
import { sequelize } from './core/Database.js';
import { Bot } from './core/Bot.js';
import { Account } from './models/Account.js';
import { Settings } from './models/Settings.js';
import './ping.js';

config();

// PO ZAHTEVU: server UVEK kreće čist (svaki restart/crash/deploy = kao
// prvi put). Ništa se ne pamti na disku - povratak stanja ide ručno
// preko "Učitaj JSON" dugmeta u panelu (export/import).
const DATA_DIR = (process.env.DATA_DIR || '').trim();
const dbPath = DATA_DIR ? path.join(DATA_DIR, 'database.db') : './database.db';
const cachePath = DATA_DIR ? path.join(DATA_DIR, 'cache') : './cache';

// UVEK čisto pri svakom pokretanju servera - restart, crash, redeploy,
// svejedno. Namerno bez uslova/env promenljive: baza i login keš se
// BRIŠU na SVAKI start, tako da server uvek kreće kao da je prvi put -
// samo hardkodovani SEED_ACCOUNTS nalog (ispod) postoji, sve ostalo se
// ručno vraća preko "Učitaj JSON" dugmeta u panelu.
try {
    await fs.rm(dbPath, { force: true });
    await fs.rm(cachePath, { recursive: true, force: true });
    console.log('Čist start: baza i cache obrisani.');
} catch (error) {
    console.error(`Greška pri čišćenju pre starta: ${error.message}`);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 10000;

// Ako je ADMIN_TOKEN postavljen u .env, admin panel/API traže taj kod.
// Ako nije postavljen, panel je otvoren svima koji dođu na URL (samo za lokalni rad!).
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

// accountId -> Bot instanca. Svi nalozi rade unutar OVOG istog procesa/servisa.
const bots = new Map();

// Startni nalog koji se automatski dodaje SAMO ako je baza prazna (prvo
// ikad pokretanje servisa). Posle toga se sve radi preko panela (možeš
// dodati još naloga preko "+" dugmeta na "/" ako i kada budeš hteo).
// NAPOMENA o "(hat3)" delu nadimka ispod: xat ugrađuje kod moći (pawn/hat/
// nameglow) DIREKTNO u tekst nadimka - vidi src/core/User.js koji baš te
// tagove ((hat...), (glow...)) skida kad čita nadimke DRUGIH korisnika, što
// potvrđuje da ih xat klijent parsira i prikazuje kao sličicu/efekat pored
// imena. Ograničenje: radi SAMO ako nalog "Diaxgalaksija" STVARNO poseduje
// tu moć (kupljenu/dodeljenu na xat.com) - ako je ne poseduje, xat taj deo
// jednostavno ignoriše i prikaže se samo čisto ime. "hat3" je primer/placeholder
// - zameni ga tačnim kodom moći koju ovaj nalog poseduje (proveri u xat
// chat-u, preko "Moje moći"/"My Powers", koji je tačan kod za tvoju sličicu).
const SEED_ACCOUNTS = [
    { username: 'Diaxgalaksija', apikey: 'bf29b66336128151', nickname: 'Diaxgalaksija(hat3)' },
];

// Nalog koji ŠALJE pozdravnu poruku (jedini). Fiksirano po username-u.
const PRIMARY_USERNAME = 'Diaxgalaksija';

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

function requireAuth (req, res, next) {
    if (!ADMIN_TOKEN) return next();
    if (req.header('x-admin-token') !== ADMIN_TOKEN) {
        return res.status(401).json({ error: 'Neispravan pristupni kod.' });
    }
    next();
}

// Svaka async ruta se propušta kroz ovo, da izuzetak ne obori ceo proces
// (Node inače gasi ceo server na "unhandled rejection") nego se vrati kao 500.
function safe (fn) {
    return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/**
 * Starts a Bot instance for a stored account and tracks it in `bots`.
 * @param {Account} account
 */
function startBot (account, isPrimary = false) {
    const bot = new Bot({
        username: account.username,
        apikey: account.apikey,
        nickname: account.nickname || account.username,
        messages: account.messages,
        aiEnabled: account.aiEnabled,
        isPrimary,
    });
    bots.set(account.id, bot);
    return bot;
}

/**
 * Re-determines which account is "primary" (the only one that sends the
 * welcome message) based on PRIMARY_USERNAME above, and updates every
 * running bot's isPrimary flag accordingly. Called after any account is
 * added or removed, and once at boot after all bots are started.
 */
async function syncPrimaryBot () {
    const accounts = await Account.findAll();
    const primary = accounts.find((a) => a.username === PRIMARY_USERNAME);
    const primaryId = primary?.id;

    for (const [id, bot] of bots.entries()) {
        bot.state.isPrimary = (id === primaryId);
    }
}

// ---------------------------------------------------------------------
// Jedinstvena "chat skripta" - JEDNA tabela poruka za CEO chat (ne po
// nalogu). Svaki red bira KOJI nalog (username) šalje tu poruku, tako da
// se simulira pravi razgovor između više naloga. Redosled slanja je
// TAČNO redosled redova u tabeli, u petlji (kad se stigne do kraja,
// kreće se ispočetka). delaySeconds na svakom redu = koliko sekundi
// čekati NAKON prethodnog reda pre slanja baš tog reda; na prvom redu
// 0 znači "pošalji odmah čim skripta krene/se restartuje".
// ---------------------------------------------------------------------
let scriptTimer = null;
let scriptRunId = 0;

function stopChatScript () {
    scriptRunId++; // "otkazuje" bilo koji zakazan setTimeout iz starog runId-a
    if (scriptTimer) {
        clearTimeout(scriptTimer);
        scriptTimer = null;
    }
}

/**
 * (Re)pokreće globalnu chat skriptu od početka. Poziva se pri startu
 * servera i svaki put kad se skripta izmeni preko panela.
 */
async function startChatScript () {
    stopChatScript();

    const settings = await Settings.findOne({ where: { id: 1 } });
    const script = settings?.chatScript || [];
    if (!script.length) return;

    const myRunId = scriptRunId;

    const sendRow = async (index) => {
        if (myRunId !== scriptRunId) return; // skripta je u međuvremenu izmenjena/zaustavljena

        const row = script[index % script.length];
        const account = await Account.findOne({ where: { username: row.username } });
        const bot = account ? bots.get(account.id) : null;

        if (bot?.state?.isConnected && row.text) {
            try {
                await bot.sendMessage(row.text);
            } catch (error) {
                console.error(`Chat skripta - greška pri slanju (${row.username}): ${error.message}`);
            }
        } else {
            console.error(`Chat skripta - nalog "${row.username}" nije povezan, red preskočen.`);
        }

        const next = index + 1;
        const nextRow = script[next % script.length];
        const delayMs = Math.max(0, Number(nextRow?.delaySeconds) || 0) * 1000;

        scriptTimer = setTimeout(() => sendRow(next), delayMs);
    };

    const firstDelayMs = Math.max(0, Number(script[0]?.delaySeconds) || 0) * 1000;
    scriptTimer = setTimeout(() => sendRow(0), firstDelayMs);
}

app.get('/api/accounts', requireAuth, safe(async (req, res) => {
    const accounts = await Account.findAll({ order: [['createdAt', 'ASC']] });
    res.json(accounts.map((a) => {
        const bot = bots.get(a.id);
        return {
            id: a.id,
            username: a.username,
            nickname: a.nickname || a.username,
            connected: Boolean(bot?.state?.isConnected),
            messages: a.messages,
            aiEnabled: a.aiEnabled,
        };
    }));
}));

app.post('/api/accounts', requireAuth, safe(async (req, res) => {
    const username = (req.body?.username || '').trim();
    const apikey = (req.body?.apikey || '').trim();
    const nickname = (req.body?.nickname || '').trim() || username;
    // Opciono - koristi se npr. kad se nalozi vraćaju iz JSON backup fajla,
    // da se poruke postave odmah pri kreiranju umesto u posebnom pozivu.
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    // Opciono - da li nalog sme da koristi !ai komandu. Podrazumevano true.
    const aiEnabled = req.body?.aiEnabled !== false;

    if (!username || !apikey) {
        return res.status(400).json({ error: 'Korisničko ime i API ključ su obavezni.' });
    }

    const existing = await Account.findOne({ where: { username } });
    if (existing) {
        return res.status(409).json({ error: 'Nalog sa tim korisničkim imenom je već dodat.' });
    }

    const account = await Account.create({ username, apikey, nickname, messages, aiEnabled });

    try {
        startBot(account);
        await syncPrimaryBot();
    } catch (error) {
        // Nalog ostaje sačuvan u bazi čak i ako pokretanje bota odmah ne uspe
        // (npr. loš API ključ) - videćeš ga kao offline u panelu.
        console.error(`Greška pri pokretanju bota ${username}: ${error.message}`);
    }

    res.status(201).json({ id: account.id, username: account.username, nickname: account.nickname, messages: account.messages, aiEnabled: account.aiEnabled });
}));

app.patch('/api/accounts/:id', requireAuth, safe(async (req, res) => {
    const id = Number(req.params.id);
    const account = await Account.findByPk(id);
    if (!account) {
        return res.status(404).json({ error: 'Nalog nije pronađen.' });
    }

    // Prvo primenimo SVA polja na account objekat (bez diranja živog bota),
    // pa tek onda jednom odlučimo kako da primenimo promenu na bota - ovo
    // izbegava da npr. restart zbog novog ključa koristi STARI nadimak
    // ako su ključ i nadimak stigli u istom zahtevu.
    let apikeyChanged = false;

    if (req.body?.apikey !== undefined && String(req.body.apikey).trim()) {
        account.apikey = String(req.body.apikey).trim();
        apikeyChanged = true;
    }

    if (req.body?.nickname !== undefined) {
        const nickname = (req.body.nickname || '').trim();
        if (!nickname) {
            return res.status(400).json({ error: 'Nickname je obavezan.' });
        }
        account.nickname = nickname;
    }

    // Lista auto-poruka PO NALOGU - zastarelo, zadržano samo radi
    // kompatibilnosti sa starim zapisima. Novi način je jedinstvena chat
    // skripta (/api/chat-script).
    if (req.body?.messages !== undefined) {
        if (!Array.isArray(req.body.messages)) {
            return res.status(400).json({ error: 'Poruke moraju biti niz.' });
        }
        account.messages = req.body.messages;
    }

    if (req.body?.aiEnabled !== undefined) {
        account.aiEnabled = req.body.aiEnabled !== false;
    }

    await account.save();

    const bot = bots.get(id);

    if (apikeyChanged) {
        // Nov ključ = u suštini druga sesija - gasimo stari bot i podižemo
        // NOV Bot sa novim ključem umesto da pokušavamo da "prebacimo"
        // postojeću konekciju (bezbednije, izbegava DUP).
        if (bot) {
            try {
                await bot.stop();
            } catch (error) {
                console.error(`Greška pri gašenju bota (promena ključa): ${error.message}`);
            }
            bots.delete(id);
        }
        try {
            startBot(account, account.username === PRIMARY_USERNAME);
        } catch (error) {
            console.error(`Greška pri ponovnom pokretanju bota ${account.username}: ${error.message}`);
        }
    } else if (bot) {
        // Bez promene ključa - primeni ostale izmene na živu konekciju.
        try {
            if (req.body?.nickname !== undefined) await bot.setNickname(account.nickname);
            if (req.body?.messages !== undefined) await bot.setMessages(account.messages);
            if (req.body?.aiEnabled !== undefined) await bot.setAiEnabled(account.aiEnabled);
        } catch (error) {
            console.error(`Greška pri primeni izmena na bota: ${error.message}`);
        }
    }

    res.json({
        id: account.id,
        username: account.username,
        nickname: account.nickname,
        messages: account.messages,
        aiEnabled: account.aiEnabled,
    });
}));

app.delete('/api/accounts/:id', requireAuth, safe(async (req, res) => {
    const id = Number(req.params.id);
    const account = await Account.findByPk(id);

    if (!account) {
        return res.status(404).json({ error: 'Nalog nije pronađen.' });
    }

    const bot = bots.get(id);
    if (bot) {
        try {
            await bot.stop();
        } catch (error) {
            console.error(`Greška pri gašenju bota: ${error.message}`);
        }
        bots.delete(id);
    }

    await account.destroy();
    await syncPrimaryBot();
    res.json({ success: true });
}));

// ---------------------------------------------------------------------
// Jedinstvena "chat skripta" (jedna tabela poruka za ceo chat).
// ---------------------------------------------------------------------

app.get('/api/chat-script', requireAuth, safe(async (req, res) => {
    const settings = await Settings.findOne({ where: { id: 1 } });
    res.json({ script: settings?.chatScript || [] });
}));

app.put('/api/chat-script', requireAuth, safe(async (req, res) => {
    if (!Array.isArray(req.body?.script)) {
        return res.status(400).json({ error: 'Skripta mora biti niz redova.' });
    }

    const script = req.body.script.map((row) => ({
        username: String(row.username || '').trim(),
        text: String(row.text || '').trim(),
        delaySeconds: Math.max(0, Number(row.delaySeconds) || 0),
    })).filter((row) => row.username && row.text);

    await Settings.update({ chatScript: script }, { where: { id: 1 } });
    await startChatScript();

    res.json({ script });
}));

// Sve neuhvaćene greške iz ruta završe ovde umesto da obore server.
app.use((err, req, res, next) => {
    console.error(`API error: ${err.message}\n${err.stack}`);
    if (res.headersSent) return next(err);
    res.status(500).json({ error: 'Došlo je do greške na serveru. Pokušaj ponovo.' });
});

// Poslednja linija odbrane: loguj i nastavi da radiš umesto da se ceo servis
// (i svi nalozi na njemu) ugase zbog jedne neočekivane greške.
process.on('unhandledRejection', (reason) => {
    console.error('Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
});

// Kad se server gasi (Ctrl+C u terminalu), lepo zatvori sve konekcije ka xat-u
// pre izlaska. Bez ovoga sesije ostaju "zaglavljene" na xat serveru i sledeći
// pokušaj povezivanja dobija DUP grešku.
async function shutdown () {
    console.log('Gašenje servera, zatvaram sve konekcije paralelno...');
    stopChatScript();
    // Svi nalozi se gase ISTOVREMENO (ne jedan po jedan) - svaki bot.stop()
    // sad radi graceful close (do 2s po nalogu), pa sekvencijalno gašenje
    // sa npr. 10 naloga bi moglo da potraje i 20s, što lako pojede vreme
    // koje Render/host daje procesu između SIGTERM i SIGKILL. Paralelno,
    // celo gašenje traje koliko i JEDAN najsporiji nalog (~2s max).
    await Promise.all(
        [...bots.values()].map((bot) =>
            bot.stop().catch((error) => console.error(`Greška pri gašenju bota: ${error.message}`))
        )
    );
    process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

(async () => {
    await sequelize.authenticate();
    await sequelize.sync();

    // Napravi red sa podešavanjima PRE nego što se ijedan bot pokrene, da
    // izbegnemo trku ("race condition") kad više naloga startuje istovremeno
    // i svaki pokuša da napravi isti red u bazi.
    await Settings.findOrCreate({ where: { id: 1 }, defaults: { id: 1 } });

    const accounts = await Account.findAll({ order: [['createdAt', 'ASC']] });

    // Jednokratno seedovanje: ako baza još nema NIJEDAN nalog (prvo ikad
    // pokretanje), ubaci startne naloge. Posle toga sve ide preko panela.
    if (accounts.length === 0) {
        for (const acc of SEED_ACCOUNTS) {
            const created = await Account.create(acc);
            accounts.push(created);
            console.log(`Dodat startni nalog: ${created.username}`);
        }
    }

    // Naloge palimo sa malim razmakom (ne sve u istom trenutku) - simultano
    // logovanje više naloga ka xat-u je čest okidač za DUP/koliziju.
    for (let i = 0; i < accounts.length; i++) {
        const account = accounts[i];
        try {
            startBot(account, account.username === PRIMARY_USERNAME);
        } catch (error) {
            console.error(`Greška pri pokretanju naloga ${account.username}: ${error.message}`);
        }
        if (i < accounts.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 4000));
        }
    }

    // Dodatna provera da baš tačno JEDAN nalog (PRIMARY_USERNAME) ima
    // isPrimary=true, čak i ako je npr. nalog sa tim username-om dodat
    // kasnije preko panela pa nije bio u ovoj petlji od starta.
    await syncPrimaryBot();

    // Pokreni jedinstvenu chat skriptu (ako ima redova) tek kad su svi
    // nalozi podignuti.
    try {
        await startChatScript();
    } catch (error) {
        console.error(`Greška pri pokretanju chat skripte: ${error.message}`);
    }

    console.log(`Pokrenuto naloga: ${accounts.length}`);
})();
